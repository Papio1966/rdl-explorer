import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import detailHandler from "../api/rdl-runtime/detail.ts";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeReadService, type RdlRuntimeDetailResult } from "../server/rdl/RdlRuntimeReadService.ts";
import {
  projectRdlEntityDetail,
  type RdlEntityDetailProjection,
  type RdlRelationshipIndexRecord,
} from "../src/rdl/entityDetail.ts";
import { loadRdlEntityDetailRuntime } from "../src/rdl/runtimeDetail.ts";
import {
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
} from "../src/rdl/runtimeDualRead.ts";
import type { RdlSearchRecord } from "../src/rdl/search.ts";

type Query = Record<string, string | string[] | undefined>;
type TestResponse = {
  statusCode: number;
  body: any;
  headers: Record<string, string | number>;
  status(code: number): TestResponse;
  json(value: unknown): void;
  setHeader(name: string, value: string | number): void;
};

type DetailIdentity = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  nativeIdentifier: string;
};

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const searchOracle = JSON.parse(read("public/rdl-search-index.json")) as RdlSearchRecord[];
const relationshipOracle = JSON.parse(read("public/rdl-relationship-index.json")) as RdlRelationshipIndexRecord[];

const detailSource = read("src/rdl/entityDetail.ts");
const runtimeDetailSource = read("src/rdl/runtimeDetail.ts");
const pageSource = read("src/pages/RdlEntityPage.tsx");
const serviceSource = read("server/rdl/RdlRuntimeReadService.ts");
const handlerSource = read("api/rdl-runtime/detail.ts");
const browseSource = read("src/components/RdlReleaseAwareBrowse.tsx");
const searchPageSource = read("src/pages/RdlSearchPage.tsx");

assert.ok(detailSource.includes("export function projectRdlEntityDetail"), "canonical detail semantics must be exposed as one pure shared projector");
assert.ok(detailSource.includes("return projectRdlEntityDetail(entities, relationships"), "JSON rollback detail loader must delegate to the shared projector");
assert.ok(detailSource.includes("item.releaseKey === record.releaseKey") && detailSource.includes("item.packageKey === record.packageKey"), "detail projection must remain release/package isolated");
assert.ok(detailSource.includes("effectiveClassProperties") && detailSource.includes('assignmentType: depth === 0 ? "direct" : "inherited"'), "effective inherited class properties must remain in the canonical projector");
for (const token of [
  "usedByClasses",
  "requiredByClasses",
  "disciplines",
  "documentTypes",
  "unitsOfMeasure",
  "allowedValues",
  "informationRequirements",
  "sourceStandards",
  "propertyMappings",
  "controlledValues",
]) {
  assert.ok(detailSource.includes(token), `rich detail projector lost ${token}`);
}

assert.ok(pageSource.includes("loadRdlEntityDetailRuntime"), "canonical detail page must use the runtime authority adapter");
assert.ok(!pageSource.includes('import { loadRdlEntityDetail,'), "canonical detail page must not directly own the JSON detail loader");
assert.ok(pageSource.includes('aria-label="On this page"') && pageSource.includes("rdl-picklist-values"), "canonical rich-detail rendering/accessibility must remain intact");
assert.ok(runtimeDetailSource.includes('if (mode === "api")'), "detail runtime must expose explicit API authority mode");
assert.ok(runtimeDetailSource.includes('if (mode === "json") return json'), "detail runtime must retain explicit JSON rollback mode");
assert.ok(runtimeDetailSource.includes("RdlBrowserDualReadError") && runtimeDetailSource.includes("RdlBrowserRuntimeReadError"), "detail runtime must fail closed for dual mismatches and API failures");
assert.ok(runtimeDetailSource.includes('"rdl-runtime-detail/v1"'), "browser detail client must validate the detail API schema");
assert.ok(runtimeDetailSource.includes("record.packageKey !== payload.packageKey"), "browser detail client must verify package identity");

assert.ok(serviceSource.includes("async detail(query: RdlRuntimeDetailQuery)"), "server runtime service must expose exact canonical detail reads");
assert.ok(serviceSource.includes("normalizeDetailQuery") && serviceSource.includes('required("entityType"') && serviceSource.includes('required("nativeIdentifier"'), "detail service must require explicit entity identity");
assert.ok(serviceSource.includes("this.projection.project(input.sourceKey, input.releaseKey)"), "detail service must use the proven PostgreSQL release projection exactly once");
assert.ok(serviceSource.includes("projectRdlEntityDetail("), "server detail authority must reuse the same rich-detail projector as JSON rollback");
assert.ok(serviceSource.includes("detail.record.packageKey !== release.packageKey"), "server detail authority must fail closed across package identity changes");
assert.ok(handlerSource.includes('"rdl-runtime-detail/v1"'), "detail API schema version must be explicit");
assert.ok(handlerSource.includes("sourceKey") && handlerSource.includes("releaseKey") && handlerSource.includes("entityType") && handlerSource.includes("nativeIdentifier"), "detail API must require full canonical identity");
assert.ok(!handlerSource.includes("rdl-search-index.json") && !handlerSource.includes("rdl-relationship-index.json"), "detail API must not read browser JSON oracles");
assert.ok(!handlerSource.includes("cfihos") && !runtimeDetailSource.includes('sourceKey === "cfihos"'), "runtime detail boundary must remain source-neutral");
assert.ok(browseSource.includes("loadRdlBrowseRuntime"), "RDL-036.4 shared browse authority must remain intact");
assert.ok(searchPageSource.includes("loadRdlGlobalSearchRuntime"), "RDL-037.1 global search authority must remain intact");

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
): DetailIdentity {
  const row = relationshipOracle.find((item) =>
    item.sourceKey === sourceKey
    && item.releaseKey === releaseKey
    && item.relationshipType === relationshipType,
  );
  assert.ok(row, `${sourceKey}/${releaseKey} must contain ${relationshipType}`);
  return endpoint === "source"
    ? { sourceKey, releaseKey, entityType: row.sourceEntityType, nativeIdentifier: row.sourceNativeIdentifier }
    : { sourceKey, releaseKey, entityType: row.targetEntityType, nativeIdentifier: row.targetNativeIdentifier };
}

const cfihosProperty = identityFromRelationship("cfihos", "cfihos-2.0", "property_controlled_value");
const ccusDocument = identityFromRelationship("ccus", "ccus-2.0-candidate", "document_discipline");
const waterClass = identityFromRelationship("water-desalination", "water-desalination-2.0-candidate", "entity_parent");
const historicalRecord = searchOracle.find((item) => item.sourceKey === "water-desalination" && item.releaseKey === "water-desalination-0.1-draft");
assert.ok(historicalRecord, "Water / Desalination historical release regression anchor is missing");
const waterHistorical: DetailIdentity = {
  sourceKey: historicalRecord.sourceKey,
  releaseKey: historicalRecord.releaseKey,
  entityType: historicalRecord.entityType,
  nativeIdentifier: historicalRecord.nativeIdentifier,
};

const service = new RdlRuntimeReadService(getRdlDatabaseClient());

async function assertServiceParity(identity: DetailIdentity, label: string) {
  const oracle = expected(identity);
  assert.ok(oracle, `${label} JSON oracle detail must exist`);
  const actual = await service.detail(identity);
  assert.deepEqual(actual.detail, oracle, `${label} PostgreSQL detail projection must equal the JSON rollback/reference oracle`);
  assert.equal(actual.sourceKey, identity.sourceKey);
  assert.equal(actual.releaseKey, identity.releaseKey);
  assert.equal(actual.packageKey, oracle.record.packageKey);
  console.log(`PASS RDL-037.2 PostgreSQL rich-detail parity ${label}: ${identity.entityType}/${identity.nativeIdentifier}`);
  return actual;
}

const cfihosActual = await assertServiceParity(cfihosProperty, "CFIHOS");
assert.ok((cfihosActual.detail?.allowedValues.length ?? 0) > 0, "CFIHOS property detail must preserve controlled values");
const ccusActual = await assertServiceParity(ccusDocument, "CCUS");
assert.ok((ccusActual.detail?.disciplines.length ?? 0) > 0, "CCUS document detail must preserve discipline relationships");
const waterActual = await assertServiceParity(waterClass, "Water current");
assert.ok((waterActual.detail?.hierarchy.parents.length ?? 0) > 0, "Water class detail must preserve authoritative hierarchy");
const historicalActual = await assertServiceParity(waterHistorical, "Water historical");
assert.equal(historicalActual.detail?.record.releaseKey, "water-desalination-0.1-draft", "historical detail must remain pinned to its explicit release");

const missing = await service.detail({
  sourceKey: "water-desalination",
  releaseKey: "water-desalination-2.0-candidate",
  entityType: "property",
  nativeIdentifier: "RDL-0372-NOT-A-REAL-ENTITY",
});
assert.equal(missing.detail, null, "missing entity inside a valid explicit release must return null without substituting another identity");

function runtimeResponse(result: RdlRuntimeDetailResult, detail: RdlEntityDetailProjection | null = result.detail) {
  return new Response(JSON.stringify({ schemaVersion: "rdl-runtime-detail/v1", ...result, detail }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function fetcherFor(result: RdlRuntimeDetailResult) {
  let calls = 0;
  const fetcher = async (input: RequestInfo | URL) => {
    calls += 1;
    const url = new URL(String(input), "http://rdl.test");
    assert.equal(url.pathname, "/api/rdl-runtime/detail");
    assert.equal(url.searchParams.get("sourceKey"), result.sourceKey);
    assert.equal(url.searchParams.get("releaseKey"), result.releaseKey);
    return runtimeResponse(result);
  };
  return { fetcher, calls: () => calls };
}

const waterExpected = expected(waterClass);
assert.ok(waterExpected);
const apiFetch = fetcherFor(waterActual);
const apiDetail = await loadRdlEntityDetailRuntime({ ...waterClass, mode: "api", fetcher: apiFetch.fetcher });
assert.deepEqual(apiDetail, waterExpected, "API mode must render the PostgreSQL candidate");
assert.equal(apiFetch.calls(), 1, "canonical browser detail must use one same-origin runtime API request");

let jsonApiCalls = 0;
const jsonDetail = await loadRdlEntityDetailRuntime({
  ...waterClass,
  mode: "json",
  jsonRecords: searchOracle,
  jsonRelationships: relationshipOracle,
  fetcher: async () => {
    jsonApiCalls += 1;
    throw new Error("JSON rollback mode must not call the runtime API");
  },
});
assert.deepEqual(jsonDetail, waterExpected);
assert.equal(jsonApiCalls, 0, "explicit JSON rollback mode must be API-independent");

const dualFetch = fetcherFor(waterActual);
const dualDetail = await loadRdlEntityDetailRuntime({
  ...waterClass,
  mode: "dual",
  jsonRecords: searchOracle,
  jsonRelationships: relationshipOracle,
  fetcher: dualFetch.fetcher,
});
assert.deepEqual(dualDetail, waterExpected, "dual mode must return the API detail only after exact JSON parity");
assert.equal(dualFetch.calls(), 1);

const mutated = structuredClone(waterActual);
assert.ok(mutated.detail);
mutated.detail.record.name = `${mutated.detail.record.name} [mismatch]`;
await assert.rejects(
  loadRdlEntityDetailRuntime({
    ...waterClass,
    mode: "dual",
    jsonRecords: searchOracle,
    jsonRelationships: relationshipOracle,
    fetcher: async () => runtimeResponse(mutated),
  }),
  RdlBrowserDualReadError,
  "dual-read mismatch must fail closed",
);

await assert.rejects(
  loadRdlEntityDetailRuntime({
    ...waterClass,
    mode: "api",
    fetcher: async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
  }),
  RdlBrowserRuntimeReadError,
  "API authority failure must fail closed without JSON substitution",
);

const historicalFetch = fetcherFor(historicalActual);
const historicalApi = await loadRdlEntityDetailRuntime({ ...waterHistorical, mode: "api", fetcher: historicalFetch.fetcher });
assert.equal(historicalApi?.record.releaseKey, "water-desalination-0.1-draft");
assert.equal(historicalFetch.calls(), 1);

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

async function callHandler(query: Query, method = "GET") {
  const res = response();
  await detailHandler({ method, headers: {}, query }, res);
  return res;
}

const missingScope = await callHandler({ sourceKey: "cfihos", releaseKey: "cfihos-2.0", entityType: "property" });
assert.equal(missingScope.statusCode, 400, "detail API must reject incomplete canonical identity before database projection");
const wrongMethod = await callHandler({}, "POST");
assert.equal(wrongMethod.statusCode, 405, "detail API must remain GET-only");

console.log("PASS RDL-037.2 canonical detail browser modes: api authority, JSON rollback, dual parity and fail-closed mismatch/unavailable behavior");
console.log("PASS RDL-037.2 explicit historical detail remains release-isolated and missing identities do not substitute another entity");
console.log("PASS RDL-037.2 canonical entity detail runtime convergence contract");
