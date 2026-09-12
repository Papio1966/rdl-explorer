import { RDL_DISTRIBUTION_CONSUMER_CONTRACT } from "./distributionConsumerCompatibility";

export const RDL_CONSUMER_PULL_RECEIPT_SCHEMA_VERSION = "rdl-consumer-pull-receipt/v1" as const;
export const RDL_CONSUMER_PULL_RECEIPT_CONTRACT_VERSION = "v1" as const;

export type DistributionPullReceiptStatus = "verified" | "stale" | "incompatible" | "rejected";

export type DistributionPullReleaseIdentity = {
  releaseId: number;
  releaseKey: string;
  releaseVersion: string;
  publicationStatus: string;
};

export type DistributionPullPackageIdentity = {
  manifestChecksum: string;
  distributionChecksum: string;
  packageChecksum?: string;
  etag: string;
};

export type DistributionPullVerification = {
  contractCompatible: boolean;
  schemaCompatible: boolean;
  releaseIdentityVerified: boolean;
  integrityVerified: boolean;
  contentCurrent: boolean;
  issues?: readonly string[];
};

export type CreateDistributionPullReceiptInput = {
  consumerKey: string;
  pulledAt: string;
  releaseIdentity: DistributionPullReleaseIdentity;
  packageIdentity: DistributionPullPackageIdentity;
  verification: DistributionPullVerification;
};

export type DistributionPullReceipt = {
  schemaVersion: typeof RDL_CONSUMER_PULL_RECEIPT_SCHEMA_VERSION;
  receiptContractVersion: typeof RDL_CONSUMER_PULL_RECEIPT_CONTRACT_VERSION;
  consumerContract: {
    consumerContractId: typeof RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractId;
    consumerContractVersion: typeof RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractVersion;
    manifestSchemaVersion: typeof RDL_DISTRIBUTION_CONSUMER_CONTRACT.manifestSchemaVersion;
    packageSchemaVersion: typeof RDL_DISTRIBUTION_CONSUMER_CONTRACT.packageSchemaVersion;
  };
  consumerKey: string;
  pulledAt: string;
  receiptKey: string;
  releaseIdentity: DistributionPullReleaseIdentity;
  packageIdentity: DistributionPullPackageIdentity;
  verification: {
    contractCompatible: boolean;
    schemaCompatible: boolean;
    releaseIdentityVerified: boolean;
    integrityVerified: boolean;
    contentCurrent: boolean;
    issues: string[];
  };
  status: DistributionPullReceiptStatus;
  safeToUseForValidation: boolean;
  boundary: {
    persistenceOwner: "consumer";
    consumerAccess: "read-only API/contract consumption";
    rdlWriteBackRequired: false;
    directDataGateToRdlDatabaseMutation: "prohibited";
  };
};

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function sha256(value: string, field: string): string {
  const normalized = requiredText(value, field).toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) throw new Error(`${field} must be a SHA-256 hexadecimal value.`);
  return normalized;
}

function optionalSha256(value: string | undefined, field: string): string | undefined {
  return value === undefined ? undefined : sha256(value, field);
}

function isoTimestamp(value: string): string {
  const normalized = requiredText(value, "pulledAt");
  const instant = new Date(normalized);
  if (Number.isNaN(instant.getTime())) throw new Error("pulledAt must be a valid ISO-8601 timestamp.");
  return instant.toISOString();
}

function receiptStatus(verification: DistributionPullVerification): DistributionPullReceiptStatus {
  if (!verification.contractCompatible || !verification.schemaCompatible) return "incompatible";
  if (!verification.contentCurrent) return "stale";
  if (!verification.releaseIdentityVerified || !verification.integrityVerified) return "rejected";
  return "verified";
}

function normalizedIssues(issues: readonly string[] | undefined): string[] {
  return [...new Set((issues ?? []).map((issue) => issue.trim()).filter(Boolean))].sort();
}

function receiptKey(parts: {
  consumerKey: string;
  pulledAt: string;
  releaseId: number;
  releaseKey: string;
  releaseVersion: string;
  distributionChecksum: string;
}): string {
  return [
    "rdl-pull-receipt",
    encodeURIComponent(parts.consumerKey),
    String(parts.releaseId),
    encodeURIComponent(parts.releaseKey),
    encodeURIComponent(parts.releaseVersion),
    parts.distributionChecksum,
    encodeURIComponent(parts.pulledAt),
  ].join(":");
}

export function createDistributionPullReceipt(input: CreateDistributionPullReceiptInput): DistributionPullReceipt {
  const consumerKey = requiredText(input.consumerKey, "consumerKey");
  const pulledAt = isoTimestamp(input.pulledAt);
  const releaseId = input.releaseIdentity.releaseId;
  if (!Number.isSafeInteger(releaseId) || releaseId <= 0) throw new Error("releaseIdentity.releaseId must be a positive safe integer.");

  const releaseIdentity: DistributionPullReleaseIdentity = {
    releaseId,
    releaseKey: requiredText(input.releaseIdentity.releaseKey, "releaseIdentity.releaseKey"),
    releaseVersion: requiredText(input.releaseIdentity.releaseVersion, "releaseIdentity.releaseVersion"),
    publicationStatus: requiredText(input.releaseIdentity.publicationStatus, "releaseIdentity.publicationStatus"),
  };

  const packageIdentity: DistributionPullPackageIdentity = {
    manifestChecksum: sha256(input.packageIdentity.manifestChecksum, "packageIdentity.manifestChecksum"),
    distributionChecksum: sha256(input.packageIdentity.distributionChecksum, "packageIdentity.distributionChecksum"),
    packageChecksum: optionalSha256(input.packageIdentity.packageChecksum, "packageIdentity.packageChecksum"),
    etag: requiredText(input.packageIdentity.etag, "packageIdentity.etag"),
  };

  const status = receiptStatus(input.verification);
  const issues = normalizedIssues(input.verification.issues);

  return {
    schemaVersion: RDL_CONSUMER_PULL_RECEIPT_SCHEMA_VERSION,
    receiptContractVersion: RDL_CONSUMER_PULL_RECEIPT_CONTRACT_VERSION,
    consumerContract: {
      consumerContractId: RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractId,
      consumerContractVersion: RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractVersion,
      manifestSchemaVersion: RDL_DISTRIBUTION_CONSUMER_CONTRACT.manifestSchemaVersion,
      packageSchemaVersion: RDL_DISTRIBUTION_CONSUMER_CONTRACT.packageSchemaVersion,
    },
    consumerKey,
    pulledAt,
    receiptKey: receiptKey({
      consumerKey,
      pulledAt,
      releaseId,
      releaseKey: releaseIdentity.releaseKey,
      releaseVersion: releaseIdentity.releaseVersion,
      distributionChecksum: packageIdentity.distributionChecksum,
    }),
    releaseIdentity,
    packageIdentity,
    verification: {
      contractCompatible: input.verification.contractCompatible,
      schemaCompatible: input.verification.schemaCompatible,
      releaseIdentityVerified: input.verification.releaseIdentityVerified,
      integrityVerified: input.verification.integrityVerified,
      contentCurrent: input.verification.contentCurrent,
      issues,
    },
    status,
    safeToUseForValidation: status === "verified",
    boundary: {
      persistenceOwner: "consumer",
      consumerAccess: "read-only API/contract consumption",
      rdlWriteBackRequired: false,
      directDataGateToRdlDatabaseMutation: "prohibited",
    },
  };
}
