import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateDistributionConsumerCompatibility,
  RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS,
  RDL_DISTRIBUTION_COMPATIBILITY_REQUIRED_FIELDS,
  RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE,
  RDL_DISTRIBUTION_CONSUMER_CONTRACT,
  RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY,
  type DistributionCompatibilityProbe,
} from "../src/rdl/distributionConsumerCompatibility";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function mustInclude(path: string, content: string, expected: string): void {
  assert.ok(content.includes(expected), `${path} must include ${expected}`);
}

const docPath = "docs/development/RDL_052_DISTRIBUTION_CONSUMER_COMPATIBILITY_HARNESS.md";
const modelPath = "src/rdl/distributionConsumerCompatibility.ts";
const scriptPath = "scripts/test-rdl-052-distribution-consumer-compatibility-harness.ts";
const rdl051DocPath = "docs/development/RDL_051_PUBLICATION_DISTRIBUTION_READINESS_DATAGATE_CONSUMERS.md";
const manifestPath = "api/distribution/manifest.ts";
const packagePath = "api/distribution/package.ts";

const doc = read(docPath);
const model = read(modelPath);
const script = read(scriptPath);
const rdl051Doc = read(rdl051DocPath);
const manifest = read(manifestPath);
const pkg = read(packagePath);

for (const expected of [
  "Distribution Consumer Compatibility Harness",
  "rdl-distribution-consumer",
  "v1",
  "rdl-distribution-manifest/v1",
  "rdl-distribution-package/v1",
  "release id",
  "release key",
  "release version",
  "publication status",
  "generated timestamp",
  "manifest checksum",
  "package checksum",
  "distribution checksum",
  "ETag",
  "stale content",
  "incompatible contract",
  "reject_before_project_validation",
  "read-only API/contract consumption",
  "direct DataGate-to-RDL database mutation",
]) {
  mustInclude(docPath, doc, expected);
}

for (const expected of [
  "RDL_DISTRIBUTION_CONSUMER_CONTRACT",
  "RDL_DISTRIBUTION_COMPATIBILITY_REQUIRED_FIELDS",
  "RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY",
  "RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE",
  "evaluateDistributionConsumerCompatibility",
  "incompatible_contract_detected",
  "stale_content_detected",
  "direct_database_mutation_attempt_rejected",
  "reject_before_project_validation",
  "read-only API/contract consumption",
  "prohibited",
]) {
  mustInclude(modelPath, model, expected);
}

for (const expected of [
  "evaluateDistributionConsumerCompatibility",
  "RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE",
  "stale_content_detected",
  "incompatible_contract_detected",
  "direct_database_mutation_attempt_rejected",
]) {
  mustInclude(scriptPath, script, expected);
}

for (const expected of [
  RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractId,
  RDL_DISTRIBUTION_CONSUMER_CONTRACT.manifestSchemaVersion,
  RDL_DISTRIBUTION_CONSUMER_CONTRACT.packageSchemaVersion,
  "read-only API/contract consumption",
  "direct DataGate-to-RDL database mutation",
]) {
  mustInclude(rdl051DocPath, rdl051Doc, expected);
}

for (const expected of [
  "rdl-distribution-consumer",
  "rdl-distribution-manifest/v1",
  "contractId",
  "contractVersion",
  "releaseIdentity",
  "manifestChecksum",
  "distributionChecksum",
  "ETag",
  "X-RDL-Read-Only-Consumer",
  "directDatabaseMutation",
  "DataGate",
]) {
  mustInclude(manifestPath, manifest, expected);
}

for (const expected of [
  "rdl-distribution-consumer",
  "rdl-distribution-package/v1",
  "contractId",
  "contractVersion",
  "releaseIdentity",
  "packageIdentity",
  "packageChecksum",
  "manifestChecksum",
  "distributionChecksum",
  "ETag",
  "X-RDL-Read-Only-Consumer",
  "directDatabaseMutation",
  "DataGate",
]) {
  mustInclude(packagePath, pkg, expected);
}

assert.equal(RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractId, "rdl-distribution-consumer");
assert.equal(RDL_DISTRIBUTION_CONSUMER_CONTRACT.consumerContractVersion, "v1");
assert.equal(RDL_DISTRIBUTION_CONSUMER_CONTRACT.manifestSchemaVersion, "rdl-distribution-manifest/v1");
assert.equal(RDL_DISTRIBUTION_CONSUMER_CONTRACT.packageSchemaVersion, "rdl-distribution-package/v1");
assert.equal(RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY.consumerAccess, "read-only API/contract consumption");
assert.equal(RDL_DISTRIBUTION_DATAGATE_CONSUMER_BOUNDARY.directDataGateToRdlDatabaseMutation, "prohibited");

for (const field of [
  "releaseId",
  "releaseKey",
  "releaseVersion",
  "publicationStatus",
  "generatedAt",
  "manifestChecksum",
  "packageChecksum",
  "distributionChecksum",
  "etag",
]) {
  assert.ok(RDL_DISTRIBUTION_COMPATIBILITY_REQUIRED_FIELDS.some((requiredField) => requiredField.name === field), `required consumer field missing: ${field}`);
}

const compatible = evaluateDistributionConsumerCompatibility(RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE);
assert.equal(compatible.compatible, true);
assert.equal(compatible.rejected, false);
assert.equal(compatible.preValidationGate, "pass");
assert.equal(compatible.directDataGateToRdlDatabaseMutation, "prohibited");

const staleProbe: DistributionCompatibilityProbe = {
  ...RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE,
  releaseVersion: "3.5.0",
  previousReleaseIdentity: { releaseId: "101", releaseKey: "company-effective", releaseVersion: "3.4.0" },
};
const stale = evaluateDistributionConsumerCompatibility(staleProbe);
assert.equal(stale.compatible, false);
assert.equal(stale.rejected, true);
assert.equal(stale.staleContentDetected, true);
assert.equal(stale.preValidationGate, "reject_before_project_validation");
assert.ok(stale.rejectionReasons.includes(RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.staleContent));

const incompatible = evaluateDistributionConsumerCompatibility({
  ...RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE,
  contractId: "wrong-contract",
});
assert.equal(incompatible.compatible, false);
assert.equal(incompatible.incompatibleContractDetected, true);
assert.equal(incompatible.preValidationGate, "reject_before_project_validation");
assert.ok(incompatible.rejectionReasons.includes(RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.incompatibleContract));

const missingIntegrity = evaluateDistributionConsumerCompatibility({
  ...RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE,
  packageChecksum: "",
});
assert.equal(missingIntegrity.compatible, false);
assert.equal(missingIntegrity.preValidationGate, "reject_before_project_validation");
assert.ok(missingIntegrity.rejectionReasons.some((reason) => reason.includes("packageChecksum")));

const mutationAttempt = evaluateDistributionConsumerCompatibility({
  ...RDL_DISTRIBUTION_CONSUMER_COMPATIBILITY_FIXTURE,
  directDataGateToRdlDatabaseMutation: "attempted",
});
assert.equal(mutationAttempt.compatible, false);
assert.equal(mutationAttempt.preValidationGate, "reject_before_project_validation");
assert.ok(mutationAttempt.rejectionReasons.includes(RDL_DISTRIBUTION_COMPATIBILITY_REJECTION_REASONS.directDatabaseMutation));

console.log("PASS - RDL-052 distribution consumer compatibility harness contract: DataGate-like consumers must verify release identity, schema versions, integrity fingerprints, stale-content signals and read-only API/contract boundaries before project validation");
