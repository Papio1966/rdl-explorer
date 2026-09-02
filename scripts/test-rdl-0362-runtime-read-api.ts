import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import relationshipsHandler from "../api/rdl-runtime/relationships.ts";
import searchHandler from "../api/rdl-runtime/search.ts";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeProjectionRepository } from "../server/rdl/RdlRuntimeProjectionRepository.ts";

type Query = Record<string, string | string[] | undefined>;
type TestResponse = {
  statusCode: number;
  body: any;
  headers: Record<string, string | number>;
  status(code: number): TestResponse;
  json(value: unknown): void;
  setHeader(name: string, value: string | number): void;
};

type SearchOracle = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  nativeIdentifier: string;
};

type RelationshipOracle = {
  sourceKey: string;
  releaseKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
};

const root = process.cwd();
const searchSource = readFileSync(resolve(root, "api/rdl-runtime/search.ts"), "utf8");
const relationshipSource = readFileSync(resolve(root, "api/rdl-runtime/relationships.ts"), "utf8");
const sharedSource = readFileSync(resolve(root, "api/rdl-runtime/_shared.ts"), "utf8");
const serviceSource = readFileSync(resolve(root, "server/rdl/RdlRuntimeReadService.ts"), "utf8");
const projectionSource = readFileSync(resolve(root, "server/rdl/RdlRuntimeProjectionRepository.ts"), "utf8");
const browserSearchSource = readFileSync(resolve(root, "src/rdl/search.ts"), "utf8");
const browserDetailSource = readFileSync(resolve(root, "src/rdl/entityDetail.ts"), "utf8");

assert.ok(searchSource.includes('"rdl-runtime-search/v1"'), "search API schema version must be explicit");
assert.ok(relationshipSource.includes('"rdl-runtime-relationships/v1"'), "relationship API schema version must be explicit");
assert.ok(searchSource.includes("sourceKey") && searchSource.includes("releaseKey"), "search API must require exact source/release inputs");
assert.ok(relationshipSource.includes("sourceKey") && relationshipSource.includes("releaseKey"), "relationship API must require exact source/release inputs");
assert.ok(sharedSource.includes("getRdlDatabaseClient"), "runtime API must use the server-side pooled PostgreSQL client");
assert.ok(sharedSource.includes("Cache-Control") === false, "cache policy must remain centralized in api/_runtime");
assert.ok(serviceSource.includes("RDL_RUNTIME_PAGE_MAX = 500"), "runtime API pagination must be bounded");
assert.ok(serviceSource.includes("package_status = 'validated'"), "runtime API must resolve only validated packages");
assert.ok(serviceSource.includes("s.source_key =") && serviceSource.includes("r.release_key ="), "runtime API release resolution must be exact source+release");
assert.ok(projectionSource.includes("projectSearchRecords") && projectionSource.includes("projectRelationshipRecords"), "036.2 must add efficient projection-specific read methods");
assert.ok(!searchSource.includes("rdl-search-index.json") && !relationshipSource.includes("rdl-relationship-index.json"), "runtime API must not read browser JSON oracles");
assert.ok(!searchSource.includes("cfihos") && !relationshipSource.includes("cfihos") && !serviceSource.includes('sourceKey = "cfihos"'), "runtime API must remain source-neutral");
assert.ok(browserSearchSource.includes("rdl-search-index.json"), "036.2 must leave browser search on the existing JSON oracle");
assert.ok(browserDetailSource.includes("rdl-relationship-index.json"), "036.2 must leave browser detail relationships on the existing JSON oracle");

const searchOracle = JSON.parse(readFileSync(resolve(root, "public/rdl-search-index.json"), "utf8")) as SearchOracle[];
const relationshipOracle = JSON.parse(readFileSync(resolve(root, "public/rdl-relationship-index.json"), "utf8")) as RelationshipOracle[];

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
    },
    setHeader(name: string, value: string | number) {
      this.headers[name.toLowerCase()] = value;
    },
  };
}

async function call(handler: typeof searchHandler, query: Query, method = "GET") {
  const res = response();
  await handler({ method, headers: {}, query }, res);
  return res;
}

const cfihosTags = searchOracle.filter((record) =>
  record.sourceKey === "cfihos"
  && record.releaseKey === "cfihos-2.0"
  && record.entityType === "tag_class",
);
const tagPage1 = await call(searchHandler, {
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
  entityType: "tag_class",
  offset: "0",
  limit: "5",
});
assert.equal(tagPage1.statusCode, 200);
assert.equal(tagPage1.body.schemaVersion, "rdl-runtime-search/v1");
assert.equal(tagPage1.body.sourceKey, "cfihos");
assert.equal(tagPage1.body.releaseKey, "cfihos-2.0");
assert.equal(tagPage1.body.total, cfihosTags.length);
assert.deepEqual(tagPage1.body.items.map((item: SearchOracle) => item.nativeIdentifier), cfihosTags.slice(0, 5).map((item) => item.nativeIdentifier));
assert.equal(tagPage1.headers["cache-control"], "no-store");
assert.ok(tagPage1.headers["x-request-id"], "runtime API must expose request correlation ID");

const tagPage2 = await call(searchHandler, {
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
  entityType: "tag_class",
  offset: "5",
  limit: "5",
});
assert.equal(tagPage2.statusCode, 200);
assert.deepEqual(
  [...tagPage1.body.items, ...tagPage2.body.items].map((item: SearchOracle) => item.nativeIdentifier),
  cfihosTags.slice(0, 10).map((item) => item.nativeIdentifier),
  "search pagination must be deterministic",
);

for (const [sourceKey, releaseKey, entityType] of [
  ["ccus", "ccus-2.0-candidate", "property"],
  ["water-desalination", "water-desalination-2.0-candidate", "unit_of_measure"],
] as const) {
  const expected = searchOracle.filter((record) => record.sourceKey === sourceKey && record.releaseKey === releaseKey && record.entityType === entityType);
  const res = await call(searchHandler, { sourceKey, releaseKey, entityType, limit: "7" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, expected.length);
  assert.deepEqual(res.body.items.map((item: SearchOracle) => item.nativeIdentifier), expected.slice(0, 7).map((item) => item.nativeIdentifier));
}

const querySearch = await call(searchHandler, {
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
  q: "centrifugal pump",
  limit: "20",
});
assert.equal(querySearch.statusCode, 200);
assert.ok(querySearch.body.total > 0, "search query should match indexed runtime metadata");
assert.ok(querySearch.body.items.every((item: SearchOracle) => item.sourceKey === "cfihos" && item.releaseKey === "cfihos-2.0"));

const cfihosTagParents = relationshipOracle.filter((record) =>
  record.sourceKey === "cfihos"
  && record.releaseKey === "cfihos-2.0"
  && record.relationshipType === "entity_parent"
  && record.sourceEntityType === "tag_class",
);
const parentPage = await call(relationshipsHandler as typeof searchHandler, {
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
  relationshipType: "entity_parent",
  sourceEntityType: "tag_class",
  offset: "0",
  limit: "10",
});
assert.equal(parentPage.statusCode, 200);
assert.equal(parentPage.body.schemaVersion, "rdl-runtime-relationships/v1");
assert.equal(parentPage.body.total, cfihosTagParents.length);
assert.deepEqual(
  parentPage.body.items.map((item: RelationshipOracle) => [item.sourceNativeIdentifier, item.targetNativeIdentifier]),
  cfihosTagParents.slice(0, 10).map((item) => [item.sourceNativeIdentifier, item.targetNativeIdentifier]),
);

const missingRelease = await call(searchHandler, { sourceKey: "cfihos", releaseKey: "not-a-release" });
assert.equal(missingRelease.statusCode, 404, "unknown explicit release must fail closed instead of substituting latest");
assert.match(String(missingRelease.body.error), /not found/i);

const missingScope = await call(searchHandler, { sourceKey: "cfihos" });
assert.equal(missingScope.statusCode, 400, "sourceKey + releaseKey are both mandatory");

const excessiveLimit = await call(searchHandler, { sourceKey: "cfihos", releaseKey: "cfihos-2.0", limit: "501" });
assert.equal(excessiveLimit.statusCode, 400, "page size above the API maximum must fail closed");

const wrongMethod = await call(searchHandler, {}, "POST");
assert.equal(wrongMethod.statusCode, 405);

// The additive 036.2 read methods must not alter the proven 036.1 projection.
// Water / Desalination is intentionally used here as a small complete release so the
// check is meaningful without repeating the expensive five-release 036.1 parity gate.
const projection = new RdlRuntimeProjectionRepository(getRdlDatabaseClient());
const waterFull = await projection.project("water-desalination", "water-desalination-2.0-candidate");
const waterSearch = await projection.projectSearchRecords("water-desalination", "water-desalination-2.0-candidate");
const waterRelationships = await projection.projectRelationshipRecords("water-desalination", "water-desalination-2.0-candidate");
assert.deepEqual(waterSearch, waterFull.searchRecords, "search-only projection must equal the established 036.1 projection");
assert.deepEqual(waterRelationships, waterFull.relationshipRecords, "relationship-only projection must equal the established 036.1 projection");

console.log(`PASS RDL-036.2 exact-scope search API: CFIHOS Tag Classes=${cfihosTags.length}; deterministic pagination and CCUS/Water genericity`);
console.log(`PASS RDL-036.2 exact-scope relationship API: CFIHOS Tag Class parents=${cfihosTagParents.length}`);
console.log("PASS RDL-036.2 unknown releases fail closed; pagination is bounded; browser JSON runtime remains unchanged");
console.log("PASS RDL-036.2 additive projection methods preserve the established RDL-036.1 projection on Water / Desalination 2.0 candidate");
console.log("PASS RDL-036.2 generic PostgreSQL runtime read API contract");
