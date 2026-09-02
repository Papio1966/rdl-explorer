import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeReadService } from "../server/rdl/RdlRuntimeReadService.ts";
import {
  parseRdlBrowserReadMode,
  verifyRdlBrowseDualRead,
} from "../src/rdl/runtimeDualRead.ts";
import type { RdlRelationshipIndexRecord } from "../src/rdl/entityDetail.ts";
import type { RdlSearchRecord } from "../src/rdl/search.ts";

const root = process.cwd();
const browseSource = readFileSync(resolve(root, "src/components/RdlReleaseAwareBrowse.tsx"), "utf8");
const dualSource = readFileSync(resolve(root, "src/rdl/runtimeDualRead.ts"), "utf8");
const searchSource = readFileSync(resolve(root, "src/rdl/search.ts"), "utf8");
const detailSource = readFileSync(resolve(root, "src/rdl/entityDetail.ts"), "utf8");

assert.equal(parseRdlBrowserReadMode(undefined, false), "json", "RDL-036.3 development/browser-test default must remain JSON-safe");
assert.equal(parseRdlBrowserReadMode(undefined, true), "api", "RDL-036.4 production default must cut over to the runtime API");
assert.equal(parseRdlBrowserReadMode("dual"), "dual");
assert.equal(parseRdlBrowserReadMode("api"), "api");
assert.throws(() => parseRdlBrowserReadMode("postgresql"), /Expected json, dual or api/);
assert.ok(browseSource.includes("loadRdlBrowseRuntime"), "shared browse must delegate read authority to the runtime boundary");
assert.ok(!browseSource.includes("loadRdlSearchIndex") && !browseSource.includes("loadRdlRelationshipIndex"), "shared browse must no longer load JSON indexes directly after cutover");
assert.ok(browseSource.includes("data-read-mode={state.readMode}"), "shared browse must expose the configured read mode for diagnostics/E2E");
assert.ok(dualSource.includes('VITE_RDL_BROWSER_READ_MODE') && dualSource.includes('mode === "json"') && dualSource.includes('mode === "api"'), "browser runtime modes must preserve JSON rollback and API authority");
assert.ok(dualSource.includes('"/api/rdl-runtime/search"') && dualSource.includes('"/api/rdl-runtime/relationships"'), "dual-read must use the RDL-036.2 runtime API");
assert.ok(dualSource.includes('relationshipType: "entity_parent"'), "browse dual-read must compare authoritative hierarchy relationships only");
assert.ok(dualSource.includes("PAGE_LIMIT = 500"), "dual-read pagination must respect the RDL-036.2 API maximum");
assert.ok(dualSource.includes("RDL browser dual-read mismatch"), "dual-read mismatch must be explicit and observable");
assert.ok(!dualSource.includes("cfihos"), "dual-read implementation must remain source-neutral");
assert.ok(searchSource.includes("/rdl-search-index.json"), "global browser search must remain JSON-backed in RDL-036.3");
assert.ok(detailSource.includes("/rdl-relationship-index.json"), "canonical detail relationships must remain JSON-backed in RDL-036.3");

const searchOracle = JSON.parse(readFileSync(resolve(root, "public/rdl-search-index.json"), "utf8")) as RdlSearchRecord[];
const relationshipOracle = JSON.parse(readFileSync(resolve(root, "public/rdl-relationship-index.json"), "utf8")) as RdlRelationshipIndexRecord[];
const service = new RdlRuntimeReadService(getRdlDatabaseClient());

function scoped(sourceKey: string, releaseKey: string, entityType: string) {
  const records = searchOracle.filter((record) =>
    record.sourceKey === sourceKey
    && record.releaseKey === releaseKey
    && record.entityType === entityType,
  );
  const packageKeys = new Set(records.map((record) => record.packageKey));
  const relationships = relationshipOracle.filter((relationship) =>
    relationship.sourceKey === sourceKey
    && relationship.releaseKey === releaseKey
    && packageKeys.has(relationship.packageKey),
  );
  return { sourceKey, releaseKey, entityType, records, relationships };
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let jsonModeFetches = 0;
await verifyRdlBrowseDualRead({
  ...scoped("water-desalination", "water-desalination-2.0-candidate", "tag_class"),
  mode: "json",
  fetcher: async () => {
    jsonModeFetches += 1;
    return jsonResponse(500, { error: "should not be called" });
  },
});
assert.equal(jsonModeFetches, 0, "safe JSON mode must not depend on the PostgreSQL API");

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
  const selection = scoped("water-desalination", "water-desalination-2.0-candidate", entityType);
  await verifyRdlBrowseDualRead({ ...selection, mode: "dual", fetcher: serviceFetch });
  const parents = selection.relationships.filter((row) =>
    row.relationshipType === "entity_parent"
    && row.sourceEntityType === entityType
    && row.targetEntityType === entityType,
  ).length;
  console.log(`PASS RDL-036.3 Water dual read: ${entityType} records=${selection.records.length} parents=${parents}`);
}

const ccusEquipment = scoped("ccus", "ccus-2.0-candidate", "equipment_class");
await verifyRdlBrowseDualRead({ ...ccusEquipment, mode: "dual", fetcher: serviceFetch });
console.log(`PASS RDL-036.3 CCUS dual read: equipment_class records=${ccusEquipment.records.length}`);

const tamperedFetcher = async (input: RequestInfo | URL) => {
  const response = await serviceFetch(input);
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(raw, "http://rdl-explorer.local");
  if (url.pathname !== "/api/rdl-runtime/search" || url.searchParams.get("offset") !== "0") return response;
  const body = await response.json() as { items?: Array<Record<string, unknown>> } & Record<string, unknown>;
  if (body.items?.length) body.items[0] = { ...body.items[0], name: `${String(body.items[0].name ?? "")} [tampered]` };
  return jsonResponse(response.status, body);
};

const originalError = console.error;
console.error = () => undefined;
try {
  await assert.rejects(
    verifyRdlBrowseDualRead({
      ...scoped("water-desalination", "water-desalination-2.0-candidate", "property"),
      mode: "dual",
      fetcher: tamperedFetcher,
    }),
    /RDL browser dual-read mismatch \(search\)/,
    "semantic mismatch must fail closed",
  );
  await assert.rejects(
    verifyRdlBrowseDualRead({
      ...scoped("water-desalination", "water-desalination-2.0-candidate", "property"),
      mode: "dual",
      fetcher: async () => jsonResponse(503, { error: "database unavailable" }),
    }),
    /could not confirm PostgreSQL parity/,
    "API failure must fail closed in dual mode",
  );
} finally {
  console.error = originalError;
}

console.log("PASS RDL-036.3 safe JSON default makes no API call");
console.log("PASS RDL-036.3 dual mode compares exact source/release/entity browse projection against the PostgreSQL runtime service");
console.log("PASS RDL-036.3 mismatch and API-unavailable paths fail closed without substituting PostgreSQL data");
console.log("PASS RDL-036.3 projection/API dual-read contract");
