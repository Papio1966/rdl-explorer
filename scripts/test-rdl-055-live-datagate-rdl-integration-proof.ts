import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDistributionPullReceipt } from "../src/rdl/distributionPullReceipt";
import { createMultiRdlCompositionDraft, exactEntityKey } from "../src/rdl/multiRdlComposition";
import {
  RDL055_REQUIRED_SCENARIOS,
  RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION,
  type LiveDataGateRdlIntegrationEvidence,
  verifyLiveDataGateRdlIntegrationEvidence,
} from "../src/rdl/liveDataGateIntegrationProof";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

const cfihos = { sourceKey:"cfihos", releaseKey:"cfihos-2.0", packageKey:"cfihos-2.0-a", entityType:"tag_class", nativeIdentifier:"CF-CP", name:"Centrifugal Pump", properties:["design pressure","flow"] };
const ccus = { sourceKey:"ccus", releaseKey:"ccus-2.0", packageKey:"ccus-2.0-b", entityType:"tag_class", nativeIdentifier:"CC-CP", name:"Centrifugal Pump", properties:["design pressure","co2 phase"] };
const composition = createMultiRdlCompositionDraft({
  targetLayer:"company",
  targetContextKey:"COMPANY-RDL-5",
  compositionKind:"multi_source_merge",
  targetEntityType:"tag_class",
  targetNativeIdentifier:"COMPANY-TC-00421",
  targetName:"Centrifugal Pump",
  contributors:[cfihos,ccus],
  componentDecisions:[
    { componentKind:"property", componentKey:"design pressure", resolution:"combine", selectedContributorKeys:[exactEntityKey(cfihos),exactEntityKey(ccus)], rationale:"Company decision retains both exact source contributors." },
  ],
  rationale:"Create one governed Company class while preserving exact source identities.",
});
assert.equal(composition.boundary.exactSourceIdentityRetained,true);
assert.equal(composition.boundary.sameNameDoesNotImplyEquivalence,true);
assert.equal(composition.boundary.dataGateOwnsComposition,false);

const receipt = createDistributionPullReceipt({
  consumerKey:"datagate-live-proof",
  pulledAt:"2026-09-12T18:00:00.000Z",
  releaseIdentity:{ releaseId:155, releaseKey:"company-effective", releaseVersion:"5.0.0", publicationStatus:"active" },
  packageIdentity:{ manifestChecksum:A, distributionChecksum:B, packageChecksum:C, etag:`sha256-${B}` },
  verification:{ contractCompatible:true, schemaCompatible:true, releaseIdentityVerified:true, integrityVerified:true, contentCurrent:true, issues:[] },
});
assert.equal(receipt.status,"verified");
assert.equal(receipt.safeToUseForValidation,true);
assert.equal(receipt.boundary.rdlWriteBackRequired,false);

const scenarios = RDL055_REQUIRED_SCENARIOS.map((scenarioId) => ({scenarioId,passed:true,evidenceRef:`evidence:${scenarioId.toLowerCase()}`}));
const evidence: LiveDataGateRdlIntegrationEvidence = {
  schemaVersion:RDL_LIVE_DATAGATE_INTEGRATION_PROOF_SCHEMA_VERSION,
  rdlBaselineSha:"e135042561d986e44ea179f6b4f5441d923a1db0",
  consumerSystem:"DataGate",
  consumerContractId:receipt.consumerContract.consumerContractId,
  consumerContractVersion:receipt.consumerContract.consumerContractVersion,
  externalRequestKey:"DG-PSE-055-001",
  proposalBundleId:"bundle-55001",
  proposalSourceLevel:"project",
  proposalTargetLevel:"project",
  proposalStatus:"accepted",
  proposalDecisionId:"proposal-event-55004",
  proposalDecisionStatus:"accepted",
  publicationLinked:true,
  publishedReleaseId:155,
  distributionReleaseId:155,
  manifestSchemaVersion:receipt.consumerContract.manifestSchemaVersion,
  packageSchemaVersion:receipt.consumerContract.packageSchemaVersion,
  manifestChecksum:receipt.packageIdentity.manifestChecksum,
  distributionChecksum:receipt.packageIdentity.distributionChecksum,
  packageChecksum:receipt.packageIdentity.packageChecksum,
  compatibilityStatus:"compatible",
  stalenessStatus:"current",
  consumerReceiptId:receipt.receiptKey,
  consumerReceiptStatus:receipt.status,
  safeToUseForValidation:receipt.safeToUseForValidation,
  idempotentReplaySameBundleId:true,
  multiSourceProvenancePreserved:composition.contributors.length===2,
  sameNameAutomaticEquivalence:false,
  historicalProjectBaselineUnchanged:true,
  dataGateToRdlDatabaseAccess:false,
  rdlToDataGateDatabaseMutation:false,
  scenarios,
};

const passed = verifyLiveDataGateRdlIntegrationEvidence(evidence);
assert.equal(passed.passed,true,passed.issues.join("; "));
assert.deepEqual(passed.issues,[]);
assert.equal(passed.correlation.publishedReleaseId,155);
assert.equal(passed.boundary.publicContractsOnly,true);
assert.equal(passed.boundary.dataGateOwnsComposition,false);

for (const [name,changed] of [
  ["schema mismatch",{...evidence,packageSchemaVersion:"rdl-distribution-package/v999"}],
  ["release mismatch",{...evidence,distributionReleaseId:156}],
  ["integrity malformed",{...evidence,distributionChecksum:"bad"}],
  ["stale",{...evidence,stalenessStatus:"stale" as never}],
  ["unsafe receipt",{...evidence,safeToUseForValidation:false as never}],
  ["cross-db",{...evidence,dataGateToRdlDatabaseAccess:true as never}],
  ["same-name collapse",{...evidence,sameNameAutomaticEquivalence:true as never}],
  ["history rewrite",{...evidence,historicalProjectBaselineUnchanged:false as never}],
  ["missing negative path",{...evidence,scenarios:scenarios.filter((item)=>item.scenarioId!=="NEGATIVE-07")}],
] as const) {
  const result = verifyLiveDataGateRdlIntegrationEvidence(changed as LiveDataGateRdlIntegrationEvidence);
  assert.equal(result.passed,false,`${name} must fail closed`);
  assert.ok(result.issues.length>0,`${name} must produce a reason`);
}

const proposalMigration = readFileSync("database/migrations/025_create_external_standards_proposal_bundle_contract.sql","utf8");
assert.match(proposalMigration,/UNIQUE \(source_system, external_request_key\)/);
assert.match(proposalMigration,/incomplete proposal bundle cannot be accepted/);
assert.match(proposalMigration,/publication_result/);
const proposalApi = readFileSync("api/proposals/bundle-submit.ts","utf8");
assert.match(proposalApi,/rdl-external-standards-proposal-bundle\/v1/);
const statusApi = readFileSync("api/proposals/bundle-status.ts","utf8");
assert.match(statusApi,/rdl-external-standards-proposal-bundle-status\/v1/);
const reviewApi = readFileSync("api/proposals/bundle-review.ts","utf8");
assert.match(reviewApi,/rdl-external-standards-proposal-bundle-review\/v1/);

const manifestApi = readFileSync("api/distribution/manifest.ts","utf8");
const packageApi = readFileSync("api/distribution/package.ts","utf8");
for (const source of [manifestApi,packageApi]) {
  assert.match(source,/RDL_DISTRIBUTION_CONTRACT_ID/);
  assert.match(source,/RDL_DISTRIBUTION_CONTRACT_VERSION/);
  assert.match(source,/staleContentDetection/);
}

const source = readFileSync("src/rdl/liveDataGateIntegrationProof.ts","utf8");
assert.doesNotMatch(source,/from\s+["']pg["']|INSERT\s+INTO|UPDATE\s+rdl\.|DELETE\s+FROM\s+rdl\.|fetch\s*\(/i);
const docs = readFileSync("docs/development/RDL_055_LIVE_DATAGATE_RDL_INTEGRATION_PROOF.md","utf8");
for (const phrase of [
  "public contracts only",
  "does not claim that the synthetic fixture is a live DataGate execution",
  "DataGate-to-RDL database access remains prohibited",
  "RDL-to-DataGate database mutation remains prohibited",
  "RDL-054 multi-source provenance",
  "historical project baseline",
]) assert.ok(docs.includes(phrase),`missing RDL-055 architecture statement: ${phrase}`);

console.log("PASS - RDL-055 RDL-side integration-proof harness: public-contract correlation, RDL-054 provenance, consumer receipt safety, mandatory negative paths and cross-database boundaries fail closed");
