import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeProjectionRepository } from "../server/rdl/RdlRuntimeProjectionRepository.ts";
import { RdlRuntimeReadService } from "../server/rdl/RdlRuntimeReadService.ts";

type RelationshipOracle = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  attributes: Record<string, string>;
  sourceSheet: string;
};

const root = process.cwd();
const repositorySource = readFileSync(resolve(root, "server/rdl/RdlRuntimeProjectionRepository.ts"), "utf8");
const serviceSource = readFileSync(resolve(root, "server/rdl/RdlRuntimeReadService.ts"), "utf8");
const oracle = JSON.parse(readFileSync(resolve(root, "public/rdl-relationship-index.json"), "utf8")) as RelationshipOracle[];

assert.ok(
  serviceSource.includes('input.relationshipType === "entity_parent"')
    && serviceSource.includes("projectEntityParentRecords"),
  "RDL-038.2 service fast path is missing",
);
assert.ok(
  repositorySource.includes("async projectEntityParentRecords")
    && repositorySource.includes("rel.relationship_type_code = 'entity_parent'")
    && repositorySource.includes("p.package_status = 'validated'")
    && repositorySource.includes("s.source_key =")
    && repositorySource.includes("r.release_key ="),
  "RDL-038.2 targeted repository contract is incomplete",
);
assert.ok(
  repositorySource.includes("projectRelationshipRecords")
    && serviceSource.includes(": await this.projection.projectRelationshipRecords"),
  "non-hierarchy relationship fallback must remain intact",
);

const repository = new RdlRuntimeProjectionRepository(getRdlDatabaseClient());
for (const [sourceKey, releaseKey] of [
  ["cfihos", "cfihos-2.0"],
  ["ccus", "ccus-2.0-candidate"],
  ["water-desalination", "water-desalination-2.0-candidate"],
] as const) {
  const expected = oracle.filter((record) =>
    record.sourceKey === sourceKey
    && record.releaseKey === releaseKey
    && record.relationshipType === "entity_parent"
  );
  const startedAt = performance.now();
  const actual = await repository.projectEntityParentRecords(sourceKey, releaseKey);
  const elapsedMs = performance.now() - startedAt;
  assert.deepEqual(actual, expected, `${sourceKey}/${releaseKey} targeted entity_parent projection changed semantics`);
  console.log(`PASS RDL-038.2 ${sourceKey}/${releaseKey}: ${actual.length} entity_parent rows exact oracle parity; targeted_read_ms=${elapsedMs.toFixed(1)}`);
}

const service = new RdlRuntimeReadService(getRdlDatabaseClient());
const expectedTagParents = oracle.filter((record) =>
  record.sourceKey === "cfihos"
  && record.releaseKey === "cfihos-2.0"
  && record.relationshipType === "entity_parent"
  && record.sourceEntityType === "tag_class"
);
const page = await service.relationships({
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
  relationshipType: "entity_parent",
  sourceEntityType: "tag_class",
  offset: 0,
  limit: 25,
});
assert.equal(page.total, expectedTagParents.length, "targeted service filtering changed total semantics");
assert.deepEqual(page.items, expectedTagParents.slice(0, 25), "targeted service pagination changed hierarchy ordering");
assert.equal(page.sourceKey, "cfihos");
assert.equal(page.releaseKey, "cfihos-2.0");

console.log(`PASS RDL-038.2 service hierarchy fast path: CFIHOS Tag Class parents=${page.total}`);
console.log("PASS RDL-038.2 targeted hierarchy runtime read contract");
