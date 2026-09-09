import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type ExternalProposalStatus = "received" | "in_review" | "accepted" | "rejected" | "withdrawn";

export type ExternalProposalRecord = {
  externalProposalId: number;
  proposalKey: string;
  consumerKey: string;
  requestKey: string;
  proposalSha256: string;
  proposerKey: string;
  sourceSystem: string;
  sourceLevel: string;
  targetLevel: string;
  targetContextKey: string;
  parentPackageId: number;
  changeKind: string;
  entityTypeCode: string;
  nativeIdentifier: string;
  deltaPayload: unknown;
  sourceEvidence: unknown;
  rationale: string;
  promotionTargetLevel?: string;
  promotionTargetContextKey?: string;
  proposalStatus: ExternalProposalStatus;
  reviewVersion: number;
  reviewedBy?: string;
  reviewRationale?: string;
  reviewedAt?: string;
  publicationResult: unknown;
  createdAt: string;
  updatedAt: string;
};

export class ExternalStandardsProposalRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async submit(input: {
    consumerKey: string;
    requestKey: string;
    proposalSha256: string;
    proposerKey: string;
    sourceSystem: string;
    sourceLevel: string;
    targetLevel: string;
    targetContextKey: string;
    parentPackageId: number;
    changeKind: string;
    entityTypeCode: string;
    nativeIdentifier: string;
    deltaPayload: unknown;
    sourceEvidence: unknown;
    rationale: string;
    promotionTargetLevel?: string;
    promotionTargetContextKey?: string;
  }): Promise<ExternalProposalRecord> {
    const rows = await this.client.query<any>(`
      SELECT *
      FROM rdl.submit_external_standards_proposal(
        ${sqlLiteral(input.consumerKey)},
        ${sqlLiteral(input.requestKey)},
        ${sqlLiteral(input.proposalSha256)},
        ${sqlLiteral(input.proposerKey)},
        ${sqlLiteral(input.sourceSystem)},
        ${sqlLiteral(input.sourceLevel)},
        ${sqlLiteral(input.targetLevel)},
        ${sqlLiteral(input.targetContextKey)},
        ${Number(input.parentPackageId)},
        ${sqlLiteral(input.changeKind)},
        ${sqlLiteral(input.entityTypeCode)},
        ${sqlLiteral(input.nativeIdentifier)},
        ${sqlLiteral(JSON.stringify(input.deltaPayload ?? {}))}::jsonb,
        ${sqlLiteral(JSON.stringify(input.sourceEvidence ?? {}))}::jsonb,
        ${sqlLiteral(input.rationale)},
        ${nullableText(input.promotionTargetLevel)},
        ${nullableText(input.promotionTargetContextKey)}
      )
    `);
    return mapProposal(rows[0]);
  }

  async review(input: {
    proposalId: number;
    action: "start_review" | "accept" | "reject" | "withdraw" | "link_publication";
    actorKey: string;
    rationale: string;
    expectedVersion: number;
    evidence?: unknown;
    publicationResult?: unknown;
  }): Promise<ExternalProposalRecord> {
    const rows = await this.client.query<any>(`
      SELECT *
      FROM rdl.review_external_standards_proposal(
        ${Number(input.proposalId)},
        ${sqlLiteral(input.action)},
        ${sqlLiteral(input.actorKey)},
        ${sqlLiteral(input.rationale)},
        ${Number(input.expectedVersion)},
        ${sqlLiteral(JSON.stringify(input.evidence ?? {}))}::jsonb,
        ${sqlLiteral(JSON.stringify(input.publicationResult ?? {}))}::jsonb
      )
    `);
    return mapProposal(rows[0]);
  }

  async byRequest(consumerKey: string, requestKey: string): Promise<ExternalProposalRecord | undefined> {
    const rows = await this.client.query<any>(`
      SELECT *
      FROM rdl.external_standards_proposal
      WHERE consumer_key = ${sqlLiteral(consumerKey)}
        AND request_key = ${sqlLiteral(requestKey)}
      LIMIT 1
    `);
    return rows[0] ? mapProposal(rows[0]) : undefined;
  }

  async byId(proposalId: number): Promise<ExternalProposalRecord | undefined> {
    const rows = await this.client.query<any>(`
      SELECT *
      FROM rdl.external_standards_proposal
      WHERE external_proposal_id = ${Number(proposalId)}
      LIMIT 1
    `);
    return rows[0] ? mapProposal(rows[0]) : undefined;
  }

  async list(consumerKey: string, limit = 100): Promise<ExternalProposalRecord[]> {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const rows = await this.client.query<any>(`
      SELECT *
      FROM rdl.external_standards_proposal
      WHERE consumer_key = ${sqlLiteral(consumerKey)}
      ORDER BY created_at DESC, external_proposal_id DESC
      LIMIT ${safeLimit}
    `);
    return rows.map(mapProposal);
  }
}

function nullableText(value: string | undefined) {
  return value && value.trim() ? sqlLiteral(value.trim()) : "NULL";
}

function mapProposal(row: any): ExternalProposalRecord {
  return {
    externalProposalId: Number(row.external_proposal_id),
    proposalKey: String(row.proposal_key),
    consumerKey: String(row.consumer_key),
    requestKey: String(row.request_key),
    proposalSha256: String(row.proposal_sha256),
    proposerKey: String(row.proposer_key),
    sourceSystem: String(row.source_system),
    sourceLevel: String(row.source_level),
    targetLevel: String(row.target_level),
    targetContextKey: String(row.target_context_key),
    parentPackageId: Number(row.parent_package_id),
    changeKind: String(row.change_kind),
    entityTypeCode: String(row.entity_type_code),
    nativeIdentifier: String(row.native_identifier),
    deltaPayload: row.delta_payload ?? {},
    sourceEvidence: row.source_evidence ?? {},
    rationale: String(row.rationale),
    promotionTargetLevel: row.promotion_target_level ?? undefined,
    promotionTargetContextKey: row.promotion_target_context_key ?? undefined,
    proposalStatus: row.proposal_status,
    reviewVersion: Number(row.review_version),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewRationale: row.review_rationale ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    publicationResult: row.publication_result ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
