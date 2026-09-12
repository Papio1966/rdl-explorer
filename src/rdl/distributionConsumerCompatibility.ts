export const RDL_DISTRIBUTION_CONSUMER_CONTRACT = {
  consumerContractId: "rdl-distribution-consumer",
  consumerContractVersion: "v1",
  manifestSchemaVersion: "rdl-distribution-manifest/v1",
  packageSchemaVersion: "rdl-distribution-package/v1",
} as const;

export type DistributionConsumerField = {
  readonly name: string;
  readonly purpose: string;
  readonly rejectWhenMissing: true;
};

export const RDL_DISTRIBUTION_COMPATIBILITY_REQUIRED_FIELDS: readonly DistributionConsumerField[] = [
  { name: "releaseId", purpose: "Pins the exact governed release consumed by DataGate.", rejectWhenMissing: true },
  { name: "releaseKey", purpose: "Pins the governed release family or context key.", rejectWhenMissing: true },
  { name: "releaseVersion", purpose: "Pins the semantic release version.", rejectWhenMissing: true },
  { name: "publicationStatus", purpose: "Confirms the package is a governed published distribution.", rejectWhenMissing: true },
  { name: "generatedAt", purpose: "Supports stale content detection and audit readback.", rejectWhenMissing: true },
  { name: "manifestChecksum", purpose: "Verifies the manifest identity and prevents silent drift.", rejectWhenMissing: true },
  { name: "packageChecksum", purpose: "Verifies the package identity consumed before project validation.", rejectWhenMissing: true },
  { name: "distributionChecksum", purpose: "Verifies end-to-end distribution integrity.", rejectWhenMissing: true },
  { name: "etag", purpose: "Provides an ETag or equivalent integrity token for cache validation.", rejectWhenMissing: true },
] as const;

export const RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY = {
  consumerAccess: "read-only API/contract consumption",
  dataGateConsumerBoundary: "DataGate consumes governed RDL distribution output by API contract only.",
  directDataGateToRdlDatabaseMutation: "prohibited",
  rdlExplorerMustNotMutateDataGateProjectState: true,
  dataGateMustNotMutateRdlExplorerGovernanceState: true,
} as const;

export const RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS = {
  incompatibleContract: "incompatible_contract_detected",
  missingRequiredField: "missing_required_consumer_field",
  staleContent: "stale_content_detected",
  directDatabaseMutation: "direct_database_mutation_attempt_rejected",
} as const;

export type DistributionReleaseIdentity = {
  readonly releaseId: string;
  readonly releaseKey: string;
  readonly releaseVersion: string;
};

export type DistributionCompatibilityProbe = {
  readonly contractId?: string;
  readonly contractVersion?: string;
  readonly manifestSchemaVersion?: string;
  readonly packageSchemaVersion?: string;
  readonly releaseId?: string | number;
  readonly releaseKey?: string;
  readonly releaseVersion?: string;
  readonly publicationStatus?: string;
  readonly generatedAt?: string;
  readonly manifestChecksum?: string;
  readonly packageChecksum?: string;
  readonly distributionChecksum?: string;
  readonly etag?: string;
  readonly consumerAccess?: string;
  readonly directDataGateToRdlDatabaseMutation?: string;
  readonly previousReleaseIdentity?: DistributionReleaseIdentity;
};

export type DistributionConsumerCompatibilityResult = {
  readonly compatible: boolean;
  readonly rejected: boolean;
  readonly staleContentDetected: boolean;
  readonly incompatibleContractDetected: boolean;
  readonly rejectionReasons: readonly string[];
  readonly preValidationGate: "pass" | "reject_before_project_validation";
  readonly dataGateConsumerBoundary: string;
  readonly directDataGateToRdlDatabaseMutation: "prohibited";
};

function hasText(value: unknown): boolean {
  return (typeof value === "string" && value.trim().length > 0) || typeof value === "number";
}

function valueFromProbe(probe: DistributionCompatibilityProbe, fieldName: string): unknown {
  return (probe as Record<string, unknown>)[fieldName];
}

function releaseIdentity(probe: DistributionCompatibilityProbe): DistributionReleaseIdentity {
  return {
    releaseId: String(probe.releaseId ?? ""),
    releaseKey: probe.releaseKey ?? "",
    releaseVersion: probe.releaseVersion ?? "",
  };
}

function sameReleaseIdentity(left: DistributionReleaseIdentity, right: DistributionReleaseIdentity): boolean {
  return left.releaseId === right.releaseId && left.releaseKey === right.releaseKey && left.releaseVersion === right.releaseVersion;
}

export function evaluateDistributionConsumerCompatibility(probe: DistributionCompatibilityProbe): DistributionConsumerCompatibilityResult {
  const rejectionReasons: string[] = [];
  const contract = RDL_DISTRIBUTION_CONSUMER_CONTRACT;
  const incompatibleContractDetected =
    probe.contractId !== contract.consumerContractId ||
    probe.contractVersion !== contract.consumerContractVersion ||
    probe.manifestSchemaVersion !== contract.manifestSchemaVersion ||
    probe.packageSchemaVersion !== contract.packageSchemaVersion;

  if (incompatibleContractDetected) {
    rejectionReasons.push(RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.incompatibleContract);
  }

  for (const field of RDL_DISTRIBUTION_COMPATIBILITY_REQUIRED_FIELDS) {
    if (!hasText(valueFromProbe(probe, field.name))) {
      rejectionReasons.push(`${RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.missingRequiredField}:${field.name}`);
    }
  }

  const staleContentDetected = Boolean(
    probe.previousReleaseIdentity && !sameReleaseIdentity(probe.previousReleaseIdentity, releaseIdentity(probe)),
  );
  if (staleContentDetected) {
    rejectionReasons.push(RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.staleContent);
  }

  if (probe.directDataGateToRdlDatabaseMutation !== RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY.directDataGateToRdlDatabaseMutation) {
    rejectionReasons.push(RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.directDatabaseMutation);
  }

  return {
    compatible: rejectionReasons.length === 0,
    rejected: rejectionReasons.length > 0,
    staleContentDetected,
    incompatibleContractDetected,
    rejectionReasons,
    preValidationGate: rejectionReasons.length === 0 ? "pass" : "reject_before_project_validation",
    dataGateConsumerBoundary: RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY.consumerAccess,
    directDataGateToRdlDatabaseMutation: "prohibited",
  };
}

export const RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE: DistributionCompatibilityProbe = {
  contractId: RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractId,
  contractVersion: RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractVersion,
  manifestSchemaVersion: RDL_DISTRIBUTION_CONSUMER_CONTRACT.manifestSchemaVersion,
  packageSchemaVersion: RDL_DISTRIBUTION_CONSUMER_CONTRACT.packageSchemaVersion,
  releaseId: "101",
  releaseKey: "company-effective",
  releaseVersion: "3.4.0",
  publicationStatus: "published",
  generatedAt: "2026-09-12T00:00:00.000Z",
  manifestChecksum: "sha256-manifest-example",
  packageChecksum: "sha256-package-example",
  distributionChecksum: "sha256-distribution-example",
  etag: "sha256-distribution-example",
  consumerAccess: RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY.consumerAccess,
  directDataGateToRdlDatabaseMutation: RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY.directDataGateToRdlDatabaseMutation,
};
