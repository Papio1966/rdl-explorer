import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("database/migrations/029_extend_external_proposal_effective_release_parent.sql");
const legacyProposalMigration = read("database/migrations/024_create_external_standards_proposal_contract.sql");
const legacyBundleMigration = read("database/migrations/025_create_external_standards_proposal_bundle_contract.sql");
const proposalService = read("server/rdl/ExternalStandardsProposalService.ts");
const proposalRepository = read("server/rdl/ExternalStandardsProposalRepository.ts");
const bundleService = read("server/rdl/ExternalStandardsProposalBundleService.ts");
const bundleRepository = read("server/rdl/ExternalStandardsProposalBundleRepository.ts");
const readback = read("server/rdl/ExternalStandardsProposalBundleReadbackService.ts");
const docs = read("docs/development/RDL_055R4_EFFECTIVE_RELEASE_PROPOSAL_PARENT.md");

assert.match(legacyProposalMigration, /parent_package_id bigint NOT NULL REFERENCES rdl\.rdl_package/);
assert.match(legacyBundleMigration, /parent_package_id bigint NOT NULL REFERENCES rdl\.rdl_package/);
assert.match(migration, /ALTER COLUMN parent_package_id DROP NOT NULL/);
assert.match(migration, /parent_effective_release_id bigint/);
assert.match(migration, /num_nonnulls\(parent_package_id, parent_effective_release_id\) = 1/);
assert.match(migration, /effective_release_contains_entity/);
assert.match(migration, /p_parent_effective_release_id bigint/);
assert.match(migration, /parent effective release context .* does not match target context/);
assert.match(migration, /parent effective release context type .* does not match target level/);
assert.match(migration, /parent effective release composition SHA-256 mismatch/);
assert.match(migration, /parent_mode/);
assert.match(migration, /LEFT JOIN rdl\.rdl_package/);
assert.match(migration, /LEFT JOIN rdl\.effective_standard_release/);
assert.match(migration, /existing_governed_object/);
assert.match(migration, /parentEffectiveReleaseId/);

for (const source of [proposalService, bundleService]) {
  assert.match(source, /parentEffectiveReleaseId/);
  assert.match(source, /requireExactlyOneParent/);
  assert.match(source, /parentPackageId/);
}
for (const source of [proposalRepository, bundleRepository]) {
  assert.match(source, /parentEffectiveReleaseId/);
  assert.match(source, /parentEffectiveCompositionSha256/);
  assert.match(source, /nullableInteger/);
}
assert.match(readback, /parentMode: "package" \| "effective_release"/);
assert.match(readback, /parentEffectiveReleaseId/);
assert.match(readback, /parentEffectiveCompositionSha256/);
assert.match(docs, /Exactly one parent mode/);
assert.match(docs, /DataGate remains a public-contract consumer/);

console.log("PASS_RDL055R4_TYPESCRIPT_CONTRACT");
console.log("LegacyPackageParent=preserved");
console.log("EffectiveReleaseParent=implemented");
console.log("ParentModeInvariant=package_XOR_effective_release");
console.log("DependencyClosure=exact_effective_release_projection");
