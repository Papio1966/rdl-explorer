import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeProjectionRepository } from "../server/rdl/RdlRuntimeProjectionRepository.ts";
import { RdlRuntimeReadService } from "../server/rdl/RdlRuntimeReadService.ts";
import { projectRdlEntityDetail, type RdlRelationshipIndexRecord } from "../src/rdl/entityDetail.ts";
import type { RdlSearchRecord } from "../src/rdl/search.ts";

type DetailIdentity = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  nativeIdentifier: string;
};

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const repositorySource = read("server/rdl/RdlRuntimeProjectionRepository.ts");
const serviceSource = read("server/rdl/RdlRuntimeReadService.ts");
const detailSource = read("src/rdl/entityDetail.ts");
const searchOracle = JSON.parse(read("public/rdl-search-index.json")) as RdlSearchRecord[];
const relationshipOracle = JSON.parse(read("public/rdl-relationship-index.json")) as RdlRelationshipIndexRecord[];

assert.ok(repositorySource.includes("async projectDetailProjection("), "targeted canonical-detail repository method is missing");
assert.ok(repositorySource.includes("WITH RECURSIVE selected_package AS"), "targeted detail read must resolve the exact package and ancestor chain in PostgreSQL");
assert.ok(repositorySource.includes("loadDetailRelationships") && repositorySource.includes("detailEntityClosure") && repositorySource.includes("projectDetailRelationships"), "targeted canonical-detail semantic closure is incomplete");
assert.ok(serviceSource.includes("this.projection.projectDetailProjection("), "runtime detail service is not using the targeted projection");
assert.ok(!serviceSource.includes("this.projection.project(input.sourceKey, input.releaseKey)"), "runtime detail service regressed to full-release projection");
assert.ok(serviceSource.includes("projectRdlEntityDetail("), "shared canonical detail projector must remain the semantic authority");
assert.ok(detailSource.includes("export function projectRdlEntityDetail"), "canonical detail projector moved or disappeared");

function expected(identity: DetailIdentity) {
  return projectRdlEntityDetail(
    searchOracle,
    relationshipOracle,
    identity.sourceKey,
    identity.releaseKey,
    identity.entityType,
    identity.nativeIdentifier,
  );
}

function identityFromRelationship(
  sourceKey: string,
  releaseKey: string,
  relationshipType: string,
  endpoint: "source" | "target" = "source",
): DetailIdentity | null {
  const row = relationshipOracle.find((item) =>
    item.sourceKey === sourceKey
    && item.releaseKey === releaseKey
    && item.relationshipType === relationshipType
  );
  if (!row) return null;
  return endpoint === "source"
    ? { sourceKey, releaseKey, entityType: row.sourceEntityType, nativeIdentifier: row.sourceNativeIdentifier }
    : { sourceKey, releaseKey, entityType: row.targetEntityType, nativeIdentifier: row.targetNativeIdentifier };
}

const candidates: Array<[string, DetailIdentity | null]> = [
  ["CFIHOS property controlled values", identityFromRelationship("cfihos", "cfihos-2.0", "property_controlled_value")],
  ["CFIHOS property mapping", identityFromRelationship("cfihos", "cfihos-2.0", "mapping_property_standard")],
  ["CFIHOS source standard mappings", identityFromRelationship("cfihos", "cfihos-2.0", "mapping_property_standard", "target")],
  ["CFIHOS controlled value standard", identityFromRelationship("cfihos", "cfihos-2.0", "controlled_value_source_standard")],
  ["CFIHOS information requirement", identityFromRelationship("cfihos", "cfihos-2.0", "information_requirement_document")],
  ["CFIHOS unit of measure", identityFromRelationship("cfihos", "cfihos-2.0", "property_unit", "target")],
  ["CCUS document", identityFromRelationship("ccus", "ccus-2.0-candidate", "document_discipline")],
  ["CCUS discipline", identityFromRelationship("ccus", "ccus-2.0-candidate", "document_discipline", "target")],
  ["Water equipment hierarchy", identityFromRelationship("water-desalination", "water-desalination-2.0-candidate", "entity_parent")],
];

const historical = searchOracle.find((item) =>
  item.sourceKey === "water-desalination" && item.releaseKey === "water-desalination-0.1-draft"
);
if (historical) {
  candidates.push(["Water historical release", {
    sourceKey: historical.sourceKey,
    releaseKey: historical.releaseKey,
    entityType: historical.entityType,
    nativeIdentifier: historical.nativeIdentifier,
  }]);
}

const unique = new Map<string, [string, DetailIdentity]>();
for (const [label, identity] of candidates) {
  if (!identity) continue;
  unique.set(`${identity.sourceKey}|${identity.releaseKey}|${identity.entityType}|${identity.nativeIdentifier}`, [label, identity]);
}
assert.ok(unique.size >= 6, "RDL-038.3 regression set is unexpectedly small");

const client = getRdlDatabaseClient();
const repository = new RdlRuntimeProjectionRepository(client);
const service = new RdlRuntimeReadService(client);

for (const [label, identity] of unique.values()) {
  const oracle = expected(identity);
  assert.ok(oracle, `${label} JSON oracle detail must exist`);
  const fullReleaseEntityCount = searchOracle.filter((record) =>
    record.sourceKey === identity.sourceKey && record.releaseKey === identity.releaseKey
  ).length;

  const projectionStartedAt = performance.now();
  const projection = await repository.projectDetailProjection(
    identity.sourceKey,
    identity.releaseKey,
    identity.entityType,
    identity.nativeIdentifier,
  );
  const projectionMs = performance.now() - projectionStartedAt;
  assert.ok(projection.searchRecords.length > 0, `${label} targeted closure lost the anchor entity`);
  assert.ok(projection.searchRecords.length < fullReleaseEntityCount || fullReleaseEntityCount <= 1, `${label} targeted closure unexpectedly materialized the full release search projection`);

  const actualStartedAt = performance.now();
  const actual = await service.detail(identity);
  const detailMs = performance.now() - actualStartedAt;
  assert.deepEqual(actual.detail, oracle, `${label} targeted PostgreSQL detail changed canonical semantics`);
  assert.equal(actual.packageKey, oracle.record.packageKey, `${label} package identity changed`);
  console.log(`PASS RDL-038.3 ${label}: closure_entities=${projection.searchRecords.length} closure_relationships=${projection.relationshipRecords.length} projection_ms=${projectionMs.toFixed(1)} targeted_detail_ms=${detailMs.toFixed(1)}`);
}

const missing = await service.detail({
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
  entityType: "property",
  nativeIdentifier: "RDL-0383-NOT-A-REAL-ENTITY",
});
assert.equal(missing.detail, null, "missing canonical identity must remain null without fallback");

console.log(`PASS RDL-038.3 targeted canonical-detail parity across ${unique.size} representative identities`);
console.log("PASS RDL-038.3 targeted canonical detail runtime read contract");
