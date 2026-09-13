import { RDL_DISTRIBUTION_CONSUMER_CONTRACT } from "./distributionConsumerCompatibility";

export const RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION = "rdl-live-datagate-integration-proof/v1" as const;

export const RDL055_REQUIRED_SCENARIOS = [
  "POSITIVE-01",
  "POSITIVE-02",
  "NEGATIVE-01",
  "NEGATIVE-02",
  "NEGATIVE-03",
  "NEGATIVE-04",
  "NEGATIVE-05",
  "NEGATIVE-06",
  "NEGATIVE-07",
  "NEGATIVE-08",
  "NEGATIVE-09",
  "BOUNDARY-01",
  "BOUNDARY-02",
  "HISTORY-01",
] as const;

export type Rdl055ScenarioId = typeof RDL055_REQUIRED_SCENARIOS[number];

export type Rdl055ScenarioEvidence = {
  scenarioId: Rdl055ScenarioId;
  passed: boolean;
  evidenceRef: string;
  detail?: string;
};

export type LiveDataGateRdlIntegrationEvidence = {
  schemaVersion: typeof RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION;
  rdlBaselineSha: string;
  consumerSystem: string;
  consumerContractId: string;
  consumerContractVersion: string;
  externalRequestKey: string;
  proposalBundleId: string;
  proposalSourceLevel: "project";
  proposalTargetLevel: "project" | "asset" | "company" | "industry";
  proposalStatus: "accepted";
  proposalDecisionId: string;
  proposalDecisionStatus: "accepted";
  publicationLinked: true;
  publishedReleaseId: number;
  distributionReleaseId: number;
  manifestSchemaVersion: string;
  packageSchemaVersion: string;
  manifestChecksum: string;
  distributionChecksum: string;
  packageChecksum?: string;
  compatibilityStatus: "compatible";
  stalenessStatus: "current";
  consumerReceiptId: string;
  consumerReceiptStatus: "verified";
  safeToUseForValidation: true;
  idempotentReplaySameBundleId: true;
  multiSourceProvenancePreserved: true;
  sameNameAutomaticEquivalence: false;
  historicalProjectBaselineUnchanged: true;
  dataGateToRdlDatabaseAccess: false;
  rdlToDataGateDatabaseMutation: false;
  scenarios: readonly Rdl055ScenarioEvidence[];
};

export type LiveDataGateRdlIntegrationProofResult = {
  schemaVersion: typeof RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION;
  passed: boolean;
  issues: string[];
  correlation: {
    externalRequestKey: string;
    proposalBundleId: string;
    proposalDecisionId: string;
    publishedReleaseId: number;
    consumerReceiptId: string;
  };
  boundary: {
    publicContractsOnly: true;
    dataGateToRdlDatabaseAccess: false;
    rdlToDataGateDatabaseMutation: false;
    dataGateOwnsComposition: false;
  };
};

const SHA1 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function requiredText(value: string, field: string, issues: string[]) {
  if (!value.trim()) issues.push(`${field} is required`);
}

function sha256(value: string | undefined, field: string, issues: string[]) {
  if (value === undefined) return;
  if (!SHA256.test(value)) issues.push(`${field} must be a SHA-256 hexadecimal value`);
}

export function verifyLiveDataGateRdlIntegrationEvidence(input: LiveDataGateRdlIntegrationEvidence): LiveDataGateRdlIntegrationProofResult {
  const issues: string[] = [];

  if (input.schemaVersion !== RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION) issues.push("integration proof schema is incompatible");
  if (!SHA1.test(input.rdlBaselineSha)) issues.push("rdlBaselineSha must identify one exact git commit");
  requiredText(input.consumerSystem, "consumerSystem", issues);
  requiredText(input.externalRequestKey, "externalRequestKey", issues);
  requiredText(input.proposalBundleId, "proposalBundleId", issues);
  requiredText(input.proposalDecisionId, "proposalDecisionId", issues);
  requiredText(input.consumerReceiptId, "consumerReceiptId", issues);

  if (input.consumerContractId !== RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractId) issues.push("consumer contract id is incompatible");
  if (input.consumerContractVersion !== RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractVersion) issues.push("consumer contract version is incompatible");
  if (input.manifestSchemaVersion !== RDL_DISTRIBUTION_CONSUMER_CONTRACT.manifestSchemaVersion) issues.push("manifest schema is incompatible");
  if (input.packageSchemaVersion !== RDL_DISTRIBUTION_CONSUMER_CONTRACT.packageSchemaVersion) issues.push("package schema is incompatible");

  if (input.proposalSourceLevel !== "project") issues.push("first live proof must originate from the project/L4 layer");
  if (input.proposalStatus !== "accepted" || input.proposalDecisionStatus !== "accepted") issues.push("proposal must have an explicit accepted governance outcome");
  if (!input.publicationLinked) issues.push("accepted proposal must be explicitly linked to a publication result");
  if (!Number.isSafeInteger(input.publishedReleaseId) || input.publishedReleaseId <= 0) issues.push("publishedReleaseId must be a positive safe integer");
  if (input.distributionReleaseId !== input.publishedReleaseId) issues.push("distribution release must equal the publication-linked release");

  sha256(input.manifestChecksum, "manifestChecksum", issues);
  sha256(input.distributionChecksum, "distributionChecksum", issues);
  sha256(input.packageChecksum, "packageChecksum", issues);

  if (input.compatibilityStatus !== "compatible") issues.push("consumer/package compatibility must pass");
  if (input.stalenessStatus !== "current") issues.push("stale or superseded content cannot pass the live proof");
  if (input.consumerReceiptStatus !== "verified" || !input.safeToUseForValidation) issues.push("consumer receipt must be verified and safe for validation");
  if (!input.idempotentReplaySameBundleId) issues.push("proposal retry/idempotency proof is missing");
  if (!input.multiSourceProvenancePreserved) issues.push("RDL-054 multi-source provenance must survive the published/consumer boundary");
  if (input.sameNameAutomaticEquivalence) issues.push("same-name source entities must not be automatically equated");
  if (!input.historicalProjectBaselineUnchanged) issues.push("historical project baseline preservation must be proven");
  if (input.dataGateToRdlDatabaseAccess) issues.push("DataGate-to-RDL database access is prohibited");
  if (input.rdlToDataGateDatabaseMutation) issues.push("RDL-to-DataGate database mutation is prohibited");

  const byId = new Map<Rdl055ScenarioId, Rdl055ScenarioEvidence>();
  for (const scenario of input.scenarios) {
    if (byId.has(scenario.scenarioId)) issues.push(`duplicate scenario evidence: ${scenario.scenarioId}`);
    byId.set(scenario.scenarioId, scenario);
    requiredText(scenario.evidenceRef, `${scenario.scenarioId}.evidenceRef`, issues);
  }
  for (const id of RDL055_REQUIRED_SCENARIOS) {
    const scenario = byId.get(id);
    if (!scenario) issues.push(`missing mandatory scenario: ${id}`);
    else if (!scenario.passed) issues.push(`mandatory scenario failed: ${id}`);
  }

  return {
    schemaVersion: RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION,
    passed: issues.length === 0,
    issues: [...new Set(issues)].sort(),
    correlation: {
      externalRequestKey: input.externalRequestKey,
      proposalBundleId: input.proposalBundleId,
      proposalDecisionId: input.proposalDecisionId,
      publishedReleaseId: input.publishedReleaseId,
      consumerReceiptId: input.consumerReceiptId,
    },
    boundary: {
      publicContractsOnly: true,
      dataGateToRdlDatabaseAccess: false,
      rdlToDataGateDatabaseMutation: false,
      dataGateOwnsComposition: false,
    },
  };
}
