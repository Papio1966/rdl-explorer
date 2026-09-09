import type { PsqlJsonClient } from "../db/PsqlJsonClient.ts";

export type ExternalProposalBundleStatus = "received" | "in_review" | "accepted" | "rejected" | "withdrawn";

export type ExternalProposalBundleRecord = {
  proposalBundleId: number;
  externalProposalId: number;
  proposalKey: string;
  consumerKey: string;
  requestKey: string;
  sourceSystem: string;
  externalRequestKey: string;
  sourceBundleKey: string;
  sourcePseId?: string;
  sourceLevel: string;
  targetLevel: string;
  targetContextKey: string;
  parentPackageId: number;
  parentPackageKey: string;
  bundleSha256: string;
  validationStatus: string;
  completenessStatus: "complete" | "incomplete_candidate";
  componentCount: number;
  dependencyCount: number;
  missingDependencyCount: number;
  proposalStatus: ExternalProposalBundleStatus;
  reviewVersion: number;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export class ExternalStandardsProposalBundleRepository {
  constructor(private readonly client: PsqlJsonClient) {}

  async submit(input: {
    consumerKey: string;
    requestKey: string;
    bundleSha256: string;
    proposerKey: string;
    sourceSystem: string;
    sourceLevel: string;
    targetLevel: string;
    targetContextKey: string;
    parentPackageId: number;
    bundlePayload: unknown;
    sourceEvidence: unknown;
    rationale: string;
    promotionTargetLevel?: string;
    promotionTargetContextKey?: string;
  }): Promise<ExternalProposalBundleRecord> {
    const rows = await this.client.query<BundleRow>(`
      SELECT *
      FROM rdl.submit_external_standards_proposal_bundle(
        ${sqlLiteral(input.consumerKey)},
        ${sqlLiteral(input.requestKey)},
        ${sqlLiteral(input.bundleSha256)},
        ${sqlLiteral(input.proposerKey)},
        ${sqlLiteral(input.sourceSystem)},
        ${sqlLiteral(input.sourceLevel)},
        ${sqlLiteral(input.targetLevel)},
        ${sqlLiteral(input.targetContextKey)},
        ${Number(input.parentPackageId)},
        ${sqlLiteral(JSON.stringify(input.bundlePayload ?? {}))}::jsonb,
        ${sqlLiteral(JSON.stringify(input.sourceEvidence ?? {}))}::jsonb,
        ${sqlLiteral(input.rationale)},
        ${nullableText(input.promotionTargetLevel)},
        ${nullableText(input.promotionTargetContextKey)}
      )
    `);
    return this.byBundleId(Number(rows[0].proposal_bundle_id)) as Promise<ExternalProposalBundleRecord>;
  }

  async review(input: {
    proposalBundleId: number;
    action: "start_review" | "accept" | "reject" | "withdraw" | "link_publication";
    actorKey: string;
    rationale: string;
    expectedVersion: number;
    evidence?: unknown;
    publicationResult?: unknown;
  }): Promise<ExternalProposalBundleRecord> {
    const rows = await this.client.query<BundleRow>(`
      SELECT *
      FROM rdl.review_external_standards_proposal_bundle(
        ${Number(input.proposalBundleId)},
        ${sqlLiteral(input.action)},
        ${sqlLiteral(input.actorKey)},
        ${sqlLiteral(input.rationale)},
        ${Number(input.expectedVersion)},
        ${sqlLiteral(JSON.stringify(input.evidence ?? {}))}::jsonb,
        ${sqlLiteral(JSON.stringify(input.publicationResult ?? {}))}::jsonb
      )
    `);
    return this.byBundleId(Number(rows[0].proposal_bundle_id)) as Promise<ExternalProposalBundleRecord>;
  }

  async byRequest(consumerKey: string, requestKey: string): Promise<ExternalProposalBundleRecord | undefined> {
    const rows = await this.client.query<BundleQueueRow>(`
      SELECT *
      FROM rdl.external_standards_proposal_bundle_queue
      WHERE consumer_key = ${sqlLiteral(consumerKey)}
        AND request_key = ${sqlLiteral(requestKey)}
      LIMIT 1
    `);
    return rows[0] ? mapRow(rows[0]) : undefined;
  }

  async byBundleId(proposalBundleId: number): Promise<ExternalProposalBundleRecord | undefined> {
    const rows = await this.client.query<BundleQueueRow>(`
      SELECT *
      FROM rdl.external_standards_proposal_bundle_queue
      WHERE proposal_bundle_id = ${Number(proposalBundleId)}
      LIMIT 1
    `);
    return rows[0] ? mapRow(rows[0]) : undefined;
  }

  async list(consumerKey: string, limit: number): Promise<ExternalProposalBundleRecord[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const rows = await this.client.query<BundleQueueRow>(`
      SELECT *
      FROM rdl.external_standards_proposal_bundle_queue
      WHERE consumer_key = ${sqlLiteral(consumerKey)}
      ORDER BY created_at DESC, proposal_bundle_id DESC
      LIMIT ${safeLimit}
    `);
    return rows.map(mapRow);
  }
}

type BundleRow = {
  proposal_bundle_id: number | string;
};

type BundleQueueRow = {
  proposal_bundle_id: number | string;
  external_proposal_id: number | string;
  proposal_key: string;
  consumer_key: string;
  request_key: string;
  source_system: string;
  external_request_key: string;
  source_bundle_key: string;
  source_pse_id?: string | null;
  source_level: string;
  target_level: string;
  target_context_key: string;
  parent_package_id: number | string;
  parent_package_key: string;
  bundle_sha256: string;
  validation_status: string;
  completeness_status: "complete" | "incomplete_candidate";
  component_count: number | string;
  dependency_count: number | string;
  missing_dependency_count: number | string;
  proposal_status: ExternalProposalBundleStatus;
  review_version: number | string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: BundleQueueRow): ExternalProposalBundleRecord {
  return {
    proposalBundleId: Number(row.proposal_bundle_id),
    externalProposalId: Number(row.external_proposal_id),
    proposalKey: row.proposal_key,
    consumerKey: row.consumer_key,
    requestKey: row.request_key,
    sourceSystem: row.source_system,
    externalRequestKey: row.external_request_key,
    sourceBundleKey: row.source_bundle_key,
    sourcePseId: row.source_pse_id ?? undefined,
    sourceLevel: row.source_level,
    targetLevel: row.target_level,
    targetContextKey: row.target_context_key,
    parentPackageId: Number(row.parent_package_id),
    parentPackageKey: row.parent_package_key,
    bundleSha256: row.bundle_sha256,
    validationStatus: row.validation_status,
    completenessStatus: row.completeness_status,
    componentCount: Number(row.component_count),
    dependencyCount: Number(row.dependency_count),
    missingDependencyCount: Number(row.missing_dependency_count),
    proposalStatus: row.proposal_status,
    reviewVersion: Number(row.review_version),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sqlLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function nullableText(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? sqlLiteral(trimmed) : "NULL";
}
