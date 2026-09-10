import type { PsqlJsonClient } from "../db/PsqlJsonClient.ts";

export type ProposalBundleReviewState = "ready_for_review" | "incomplete_fail_closed" | "invalid_fail_closed" | "terminal";

export type ProposalBundleQueueItem = {
  proposalBundleId: number;
  externalProposalId: number;
  proposalKey: string;
  consumerKey: string;
  requestKey: string;
  sourceSystem: string;
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
  proposalStatus: string;
  reviewVersion: number;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  reviewState: ProposalBundleReviewState;
  canAccept: boolean;
  failClosedReason?: string;
};

export type ProposalBundleComponentReadback = {
  componentKey: string;
  componentKind: string;
  componentAction: string;
  entityTypeCode: string;
  nativeIdentifier: string;
  componentStatus: string;
  requiredFieldsMissing: unknown[];
  componentPayload: Record<string, unknown>;
};

export type ProposalBundleDependencyReadback = {
  dependencyKey: string;
  sourceComponentKey: string;
  dependencyType: string;
  required: boolean;
  satisfiedBy: string;
  targetComponentKey?: string;
  targetEntityTypeCode?: string;
  targetNativeIdentifier?: string;
  satisfactionDetail: Record<string, unknown>;
};

export type ProposalBundleEventReadback = {
  action: string;
  actorKey: string;
  rationale: string;
  eventPayload: Record<string, unknown>;
  occurredAt: string;
};

export type ProposalBundleDetailReadback = ProposalBundleQueueItem & {
  components: ProposalBundleComponentReadback[];
  dependencies: ProposalBundleDependencyReadback[];
  events: ProposalBundleEventReadback[];
  governanceBoundary: {
    acceptanceDoesNotPublish: true;
    promotionAuthority: "RDL_EXPLORER_ONLY";
    publicationAuthority: "RDL_EXPLORER_ONLY";
    directDataGateDatabaseMutation: "PROHIBITED";
  };
};

export type ProposalBundleQueueFilters = {
  sourceSystem?: string;
  proposalStatus?: string;
  completenessStatus?: "complete" | "incomplete_candidate";
  targetContextKey?: string;
  limit?: number;
};

export class ExternalStandardsProposalBundleReadbackService {
  constructor(private readonly client: PsqlJsonClient) {}

  async list(filters: ProposalBundleQueueFilters = {}): Promise<ProposalBundleQueueItem[]> {
    const where: string[] = [];
    if (filters.sourceSystem) where.push(`source_system = ${sqlLiteral(filters.sourceSystem)}`);
    if (filters.proposalStatus) where.push(`proposal_status = ${sqlLiteral(filters.proposalStatus)}`);
    if (filters.completenessStatus) where.push(`completeness_status = ${sqlLiteral(filters.completenessStatus)}`);
    if (filters.targetContextKey) where.push(`target_context_key = ${sqlLiteral(filters.targetContextKey)}`);
    const rows = await this.client.query<ProposalBundleQueueRow>(`
      SELECT *
      FROM rdl.external_standards_proposal_bundle_queue
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC, proposal_bundle_id DESC
      LIMIT ${boundedLimit(filters.limit)}
    `);
    return rows.map(mapQueueRow);
  }

  async detailById(proposalBundleId: number): Promise<ProposalBundleDetailReadback | undefined> {
    const rows = await this.client.query<ProposalBundleQueueRow>(`
      SELECT *
      FROM rdl.external_standards_proposal_bundle_queue
      WHERE proposal_bundle_id = ${positiveInteger(proposalBundleId, "proposalBundleId")}
      LIMIT 1
    `);
    return rows[0] ? this.detailFromQueueRow(rows[0]) : undefined;
  }

  async detailByRequest(sourceSystem: string, requestKey: string): Promise<ProposalBundleDetailReadback | undefined> {
    const rows = await this.client.query<ProposalBundleQueueRow>(`
      SELECT *
      FROM rdl.external_standards_proposal_bundle_queue
      WHERE source_system = ${sqlLiteral(sourceSystem)}
        AND request_key = ${sqlLiteral(requestKey)}
      LIMIT 1
    `);
    return rows[0] ? this.detailFromQueueRow(rows[0]) : undefined;
  }

  private async detailFromQueueRow(row: ProposalBundleQueueRow): Promise<ProposalBundleDetailReadback> {
    const queueItem = mapQueueRow(row);
    const proposalBundleId = queueItem.proposalBundleId;
    const [components, dependencies, events] = await Promise.all([
      this.client.query<ProposalBundleComponentRow>(`
        SELECT component_key, component_kind, component_action, entity_type_code,
               native_identifier, component_status, required_fields_missing, component_payload
        FROM rdl.external_standards_proposal_bundle_component
        WHERE proposal_bundle_id = ${proposalBundleId}
        ORDER BY proposal_bundle_component_id
      `),
      this.client.query<ProposalBundleDependencyRow>(`
        SELECT dependency_key, source_component_key, dependency_type, required, satisfied_by,
               target_component_key, target_entity_type_code, target_native_identifier, satisfaction_detail
        FROM rdl.external_standards_proposal_bundle_dependency
        WHERE proposal_bundle_id = ${proposalBundleId}
        ORDER BY proposal_bundle_dependency_id
      `),
      this.client.query<ProposalBundleEventRow>(`
        SELECT action, actor_key, rationale, event_payload, occurred_at
        FROM rdl.external_standards_proposal_bundle_event
        WHERE proposal_bundle_id = ${proposalBundleId}
        ORDER BY proposal_bundle_event_id
      `),
    ]);
    return {
      ...queueItem,
      components: components.map(mapComponentRow),
      dependencies: dependencies.map(mapDependencyRow),
      events: events.map(mapEventRow),
      governanceBoundary: {
        acceptanceDoesNotPublish: true,
        promotionAuthority: "RDL_EXPLORER_ONLY",
        publicationAuthority: "RDL_EXPLORER_ONLY",
        directDataGateDatabaseMutation: "PROHIBITED",
      },
    };
  }
}

type ProposalBundleQueueRow = {
  proposal_bundle_id: number | string;
  external_proposal_id: number | string;
  proposal_key: string;
  consumer_key: string;
  request_key: string;
  source_system: string;
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
  proposal_status: string;
  review_version: number | string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type ProposalBundleComponentRow = {
  component_key: string;
  component_kind: string;
  component_action: string;
  entity_type_code: string;
  native_identifier: string;
  component_status: string;
  required_fields_missing: unknown;
  component_payload: unknown;
};

type ProposalBundleDependencyRow = {
  dependency_key: string;
  source_component_key: string;
  dependency_type: string;
  required: boolean;
  satisfied_by: string;
  target_component_key?: string | null;
  target_entity_type_code?: string | null;
  target_native_identifier?: string | null;
  satisfaction_detail: unknown;
};

type ProposalBundleEventRow = {
  action: string;
  actor_key: string;
  rationale: string;
  event_payload: unknown;
  occurred_at: string;
};

function mapQueueRow(row: ProposalBundleQueueRow): ProposalBundleQueueItem {
  const missingDependencyCount = Number(row.missing_dependency_count);
  const proposalStatus = row.proposal_status;
  const validationStatus = row.validation_status;
  const completenessStatus = row.completeness_status;
  const canAccept = validationStatus === "schema_validated" && completenessStatus === "complete" && missingDependencyCount === 0 && !isTerminalStatus(proposalStatus);
  return {
    proposalBundleId: Number(row.proposal_bundle_id),
    externalProposalId: Number(row.external_proposal_id),
    proposalKey: row.proposal_key,
    consumerKey: row.consumer_key,
    requestKey: row.request_key,
    sourceSystem: row.source_system,
    sourceBundleKey: row.source_bundle_key,
    sourcePseId: row.source_pse_id ?? undefined,
    sourceLevel: row.source_level,
    targetLevel: row.target_level,
    targetContextKey: row.target_context_key,
    parentPackageId: Number(row.parent_package_id),
    parentPackageKey: row.parent_package_key,
    bundleSha256: row.bundle_sha256,
    validationStatus,
    completenessStatus,
    componentCount: Number(row.component_count),
    dependencyCount: Number(row.dependency_count),
    missingDependencyCount,
    proposalStatus,
    reviewVersion: Number(row.review_version),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewState: reviewState(validationStatus, completenessStatus, proposalStatus, missingDependencyCount),
    canAccept,
    failClosedReason: canAccept ? undefined : failClosedReason(validationStatus, completenessStatus, proposalStatus, missingDependencyCount),
  };
}

function mapComponentRow(row: ProposalBundleComponentRow): ProposalBundleComponentReadback {
  return {
    componentKey: row.component_key,
    componentKind: row.component_kind,
    componentAction: row.component_action,
    entityTypeCode: row.entity_type_code,
    nativeIdentifier: row.native_identifier,
    componentStatus: row.component_status,
    requiredFieldsMissing: arrayValue(row.required_fields_missing),
    componentPayload: objectValue(row.component_payload),
  };
}

function mapDependencyRow(row: ProposalBundleDependencyRow): ProposalBundleDependencyReadback {
  return {
    dependencyKey: row.dependency_key,
    sourceComponentKey: row.source_component_key,
    dependencyType: row.dependency_type,
    required: Boolean(row.required),
    satisfiedBy: row.satisfied_by,
    targetComponentKey: row.target_component_key ?? undefined,
    targetEntityTypeCode: row.target_entity_type_code ?? undefined,
    targetNativeIdentifier: row.target_native_identifier ?? undefined,
    satisfactionDetail: objectValue(row.satisfaction_detail),
  };
}

function mapEventRow(row: ProposalBundleEventRow): ProposalBundleEventReadback {
  return {
    action: row.action,
    actorKey: row.actor_key,
    rationale: row.rationale,
    eventPayload: objectValue(row.event_payload),
    occurredAt: row.occurred_at,
  };
}

function reviewState(validationStatus: string, completenessStatus: string, proposalStatus: string, missingDependencyCount: number): ProposalBundleReviewState {
  if (isTerminalStatus(proposalStatus)) return "terminal";
  if (validationStatus === "invalid") return "invalid_fail_closed";
  if (completenessStatus !== "complete" || missingDependencyCount > 0) return "incomplete_fail_closed";
  return "ready_for_review";
}

function failClosedReason(validationStatus: string, completenessStatus: string, proposalStatus: string, missingDependencyCount: number): string | undefined {
  if (isTerminalStatus(proposalStatus)) return `Proposal status is terminal: ${proposalStatus}.`;
  if (validationStatus === "invalid") return "Bundle validation status is invalid.";
  if (completenessStatus !== "complete") return "Bundle is an incomplete candidate and must fail closed on accept.";
  if (missingDependencyCount > 0) return `Bundle has ${missingDependencyCount} missing required dependencies.`;
  return undefined;
}

function isTerminalStatus(status: string): boolean {
  return status === "accepted" || status === "rejected" || status === "withdrawn";
}

function boundedLimit(limit: number | undefined): number {
  const numeric = Number(limit ?? 100);
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(1, Math.min(250, Math.trunc(numeric)));
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sqlLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}
