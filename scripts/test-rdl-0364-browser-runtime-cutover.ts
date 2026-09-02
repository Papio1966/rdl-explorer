import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeReadService } from "../server/rdl/RdlRuntimeReadService.ts";
import {
  loadRdlBrowseRuntime,
  parseRdlBrowserReadMode,
} from "../src/rdl/runtimeDualRead.ts";
import type { RdlRelationshipIndexRecord } from "../src/rdl/entityDetail.ts";
import type { RdlSearchRecord } from "../src/rdl/search.ts";

const root = process.cwd();
const browseSource = readFileSync(resolve(root, "src/components/RdlReleaseAwareBrowse.tsx"), "utf8");
const runtimeSource = readFileSync(resolve(root, "src/rdl/runtimeDualRead.ts"), "utf8");
const searchSource = readFileSync(resolve(root, "src/rdl/search.ts"), "utf8");
const detailSource = readFileSync(resolve(root, "src/rdl/entityDetail.ts"), "utf8");

assert.equal(parseRdlBrowserReadMode(undefined, true), "api", "production builds must default shared browse authority to the runtime API");
assert.equal(parseRdlBrowserReadMode(undefined, false), "json", "development/Vite browser tests must retain the explicit JSON-safe default");
for (const mode of ["json", "dual", "api"] as const) assert.equal(parseRdlBrowserReadMode(mode), mode);
assert.throws(() => parseRdlBrowserReadMode("latest"), /Expected json, dual or api/);
assert.ok(browseSource.includes("loadRdlBrowseRuntime({ sourceKey, releaseKey, entityType })"), "shared browse must read through the runtime authority boundary");
assert.ok(!browseSource.includes("loadRdlSearchIndex") && !browseSource.includes("loadRdlRelationshipIndex"), "shared browse must not directly load JSON projections after production cutover");
assert.ok(browseSource.includes("data-read-mode={state.readMode}"), "shared browse must expose active read authority for diagnostics");
assert.ok(runtimeSource.includes('production ? "api" : "json"'), "runtime boundary must encode API production authority and JSON development fallback explicitly");
assert.ok(runtimeSource.includes('mode === "api"') && runtimeSource.includes('mode === "json"'), "runtime boundary must retain explicit API and JSON modes");
assert.ok(runtimeSource.includes('return { mode, ...runtime }'), "API/dual modes must render runtime API records rather than silently returning JSON");
assert.ok(runtimeSource.includes('"/api/rdl-runtime/search"') && runtimeSource.includes('"/api/rdl-runtime/relationships"'), "shared browser cutover must use the RDL-036.2 API");
assert.ok(runtimeSource.includes('relationshipType: "entity_parent"'), "shared browse must fetch only authoritative hierarchy relationships");
assert.ok(runtimeSource.includes("PAGE_LIMIT = 500"), "runtime paging must respect the API maximum");
assert.ok(runtimeSource.includes("changed package identity during pagination"), "runtime API pagination must fail closed on package drift");
assert.ok(runtimeSource.includes("RDL browser runtime API read failed"), "API authority failures must be explicit");
assert.ok(!runtimeSource.toLocaleLowerCase().includes("cfihos"), "runtime browser authority must remain source-neutral");
assert.ok(searchSource.includes("/rdl-search-index.json"), "global search stays JSON-backed until a separately scoped cutover");
assert.ok(detailSource.includes("/rdl-relationship-index.json"), "canonical detail stays JSON-backed until a separately scoped cutover");

const searchOracle = JSON.parse(readFileSync(resolve(root, "public/rdl-search-index.json"), "utf8")) as RdlSearchRecord[];
const relationshipOracle = JSON.parse(readFileSync(resolve(root, "public/rdl-relationship-index.json"), "utf8")) as RdlRelationshipIndexRecord[];
const service = new RdlRuntimeReadService(getRdlDatabaseClient());

function scoped(sourceKey: string, releaseKey: string, entityType: string) {
  const records = searchOracle.filter((record) =>
    record.sourceKey === sourceKey && record.releaseKey === releaseKey && record.entityType === entityType,
  );
  const packageKeys = new Set(records.map((record) => record.packageKey));
  const relationships = relationshipOracle.filter((row) =>
    row.sourceKey === sourceKey
    && row.releaseKey === releaseKey
    && packageKeys.has(row.packageKey)
    && row.relationshipType === "entity_parent"
    && row.sourceEntityType === entityType
    && row.targetEntityType === entityType,
  );
  return { records, relationships };
}

async function serviceFetch(input: RequestInfo | URL): Promise<Response> {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(raw, "http://rdl-explorer.local");
  const value = (name: string) => url.searchParams.get(name) ?? undefined;
  const number = (name: string) => {
    const rawValue = value(name);
    return rawValue === undefined ? undefined : Number(rawValue);
  };
  try {
    if (url.pathname === "/api/rdl-runtime/search") {
      const result = await service.search({
        sourceKey: value("sourceKey") ?? "",
        releaseKey: value("releaseKey") ?? "",
        entityType: value("entityType"),
        q: value("q"),
        offset: number("offset"),
        limit: number("limit"),
      });
      return jsonResponse(200, { schemaVersion: "rdl-runtime-search/v1", ...result });
    }
    if (url.pathname === "/api/rdl-runtime/relationships") {
      const result = await service.relationships({
        sourceKey: value("sourceKey") ?? "",
        releaseKey: value("releaseKey") ?? "",
        relationshipType: value("relationshipType"),
        sourceEntityType: value("sourceEntityType"),
        sourceNativeIdentifier: value("sourceNativeIdentifier"),
        targetEntityType: value("targetEntityType"),
        targetNativeIdentifier: value("targetNativeIdentifier"),
        offset: number("offset"),
        limit: number("limit"),
      });
      return jsonResponse(200, { schemaVersion: "rdl-runtime-relationships/v1", ...result });
    }
    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Runtime read failed" });
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let jsonFetches = 0;
const jsonSelection = scoped("water-desalination", "water-desalination-2.0-candidate", "tag_class");
const jsonResult = await loadRdlBrowseRuntime({
  sourceKey: "water-desalination",
  releaseKey: "water-desalination-2.0-candidate",
  entityType: "tag_class",
  mode: "json",
  jsonRecords: searchOracle,
  jsonRelationships: relationshipOracle,
  fetcher: async () => {
    jsonFetches += 1;
    return jsonResponse(500, { error: "must not be called" });
  },
});
assert.equal(jsonFetches, 0, "explicit JSON rollback must not call the runtime API");
assert.deepEqual(jsonResult.records, jsonSelection.records);

const waterFamilies = [
  "tag_class",
  "equipment_class",
  "document_type",
  "property",
  "source_standard",
  "discipline",
  "unit_of_measure",
] as const;

for (const entityType of waterFamilies) {
  const expected = scoped("water-desalination", "water-desalination-2.0-candidate", entityType);
  const result = await loadRdlBrowseRuntime({
    sourceKey: "water-desalination",
    releaseKey: "water-desalination-2.0-candidate",
    entityType,
    mode: "api",
    fetcher: serviceFetch,
  });
  assert.equal(result.mode, "api");
  assert.deepEqual(result.records, expected.records, `${entityType} API records differ from the committed rollback oracle`);
  assert.deepEqual(result.relationships, expected.relationships, `${entityType} API hierarchy differs from the committed rollback oracle`);
  console.log(`PASS RDL-036.4 Water API authority: ${entityType} records=${result.records.length} parents=${result.relationships.length}`);
}

const ccusExpected = scoped("ccus", "ccus-2.0-candidate", "equipment_class");
const ccusResult = await loadRdlBrowseRuntime({
  sourceKey: "ccus",
  releaseKey: "ccus-2.0-candidate",
  entityType: "equipment_class",
  mode: "api",
  fetcher: serviceFetch,
});
assert.deepEqual(ccusResult.records, ccusExpected.records);
assert.deepEqual(ccusResult.relationships, ccusExpected.relationships);
console.log(`PASS RDL-036.4 CCUS API authority: equipment_class records=${ccusResult.records.length} parents=${ccusResult.relationships.length}`);

const dualExpected = scoped("water-desalination", "water-desalination-2.0-candidate", "property");
const dualResult = await loadRdlBrowseRuntime({
  sourceKey: "water-desalination",
  releaseKey: "water-desalination-2.0-candidate",
  entityType: "property",
  mode: "dual",
  fetcher: serviceFetch,
  jsonRecords: searchOracle,
  jsonRelationships: relationshipOracle,
});
assert.equal(dualResult.mode, "dual");
assert.deepEqual(dualResult.records, dualExpected.records, "dual mode must render the API candidate only after exact JSON parity");

const originalError = console.error;
console.error = () => undefined;
try {
  await assert.rejects(
    loadRdlBrowseRuntime({
      sourceKey: "water-desalination",
      releaseKey: "water-desalination-2.0-candidate",
      entityType: "property",
      mode: "api",
      fetcher: async () => jsonResponse(503, { error: "database unavailable" }),
    }),
    /runtime API read failed/,
    "API authority must fail closed instead of silently falling back to JSON",
  );
} finally {
  console.error = originalError;
}

console.log("PASS RDL-036.4 production default is PostgreSQL runtime API; development/CI default remains explicit JSON");
console.log("PASS RDL-036.4 JSON rollback and dual-read modes remain available without silent fallback");
console.log("PASS RDL-036.4 shared browse runtime authority cutover contract");
