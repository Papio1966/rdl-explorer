import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RDL_SOURCES, getDefaultReleaseKey } from "../src/rdl/catalog.ts";
import {
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
  parseRdlBrowserReadMode,
} from "../src/rdl/runtimeDualRead.ts";
import { loadRdlGlobalSearchRuntime } from "../src/rdl/runtimeSearch.ts";
import { searchRdlRecords, type RdlSearchRecord } from "../src/rdl/search.ts";
import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlRuntimeReadService } from "../server/rdl/RdlRuntimeReadService.ts";

const root = process.cwd();
const searchPageSource = readFileSync(resolve(root, "src/pages/RdlSearchPage.tsx"), "utf8");
const runtimeSearchSource = readFileSync(resolve(root, "src/rdl/runtimeSearch.ts"), "utf8");
const runtimeServiceSource = readFileSync(resolve(root, "server/rdl/RdlRuntimeReadService.ts"), "utf8");
const oracle = JSON.parse(readFileSync(resolve(root, "public/rdl-search-index.json"), "utf8")) as RdlSearchRecord[];
const service = new RdlRuntimeReadService(getRdlDatabaseClient());

assert.equal(parseRdlBrowserReadMode(undefined, true), "api", "production browser default must remain API-backed");
assert.equal(parseRdlBrowserReadMode(undefined, false), "json", "development/CI browser default must remain explicit JSON");
assert.ok(searchPageSource.includes("loadRdlGlobalSearchRuntime"), "global search page must use the runtime search boundary");
assert.ok(!searchPageSource.includes("loadRdlSearchIndex"), "global search page must not directly load the JSON search oracle after cutover");
assert.ok(runtimeSearchSource.includes('if (mode === "api")'), "runtime search must expose an explicit API-authority branch");
assert.ok(runtimeSearchSource.includes('source === "all"') && runtimeSearchSource.includes("getDefaultReleaseKey"), "all-scope runtime search must use configured default/current releases");
assert.ok(runtimeSearchSource.includes("RdlBrowserDualReadError") && runtimeSearchSource.includes("RdlBrowserRuntimeReadError"), "runtime search must fail closed for mismatches and API failures");
assert.ok(runtimeServiceSource.includes("rankRuntimeSearchRecords") && runtimeServiceSource.includes('record.entityType.replaceAll("_", " ")'), "runtime service must implement the browser search vocabulary and ranking contract");
assert.ok(!runtimeServiceSource.includes('sourceKey = "cfihos"'), "runtime search service must remain source-neutral");

for (const [sourceKey, releaseKey] of [
  ["cfihos", "cfihos-2.0"],
  ["ccus", "ccus-2.0-candidate"],
  ["water-desalination", "water-desalination-2.0-candidate"],
  ["water-desalination", "water-desalination-0.1-draft"],
] as const) {
  const scoped = oracle.filter((record) => record.sourceKey === sourceKey && record.releaseKey === releaseKey);
  const target = scoped.find((record) => record.name.trim().split(/\s+/).filter((word) => word.length > 2).length >= 2) ?? scoped[0];
  assert.ok(target, `${sourceKey}/${releaseKey} must have a representative search record`);
  const words = target.name.trim().split(/\s+/).filter((word) => word.length > 2).slice(0, 2);
  const query = words.length >= 2 ? words.join(" ") : target.nativeIdentifier;
  const expected = searchRdlRecords(oracle, query, sourceKey, releaseKey, 80);
  const actual = await service.search({ sourceKey, releaseKey, q: query, offset: 0, limit: 80 });
  assert.deepEqual(actual.items, expected, `${sourceKey}/${releaseKey} runtime ranking must equal browser search semantics for '${query}'`);
  console.log(`PASS RDL-037.1 ranked API parity ${sourceKey}/${releaseKey}: query='${query}' results=${expected.length}`);
}

type FetchCall = { sourceKey: string; releaseKey: string; q: string; limit: number };

function serviceFetcher(calls: FetchCall[], mutate?: (body: any) => any) {
  return async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://rdl.test");
    if (url.pathname !== "/api/rdl-runtime/search") return new Response("not found", { status: 404 });
    const sourceKey = url.searchParams.get("sourceKey") ?? "";
    const releaseKey = url.searchParams.get("releaseKey") ?? "";
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "80");
    calls.push({ sourceKey, releaseKey, q, limit });
    const page = await service.search({ sourceKey, releaseKey, q, offset: 0, limit });
    const body = mutate ? mutate({ schemaVersion: "rdl-runtime-search/v1", ...page }) : { schemaVersion: "rdl-runtime-search/v1", ...page };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

const allExpected = searchRdlRecords(oracle, "property", "all", null, 80);
const allCalls: FetchCall[] = [];
const allApi = await loadRdlGlobalSearchRuntime({
  query: "property",
  source: "all",
  releaseKey: null,
  mode: "api",
  fetcher: serviceFetcher(allCalls),
});
assert.deepEqual(allApi.results, allExpected, "all-current API authority must equal the browser JSON oracle top 80");
assert.deepEqual(
  allCalls.map(({ sourceKey, releaseKey }) => [sourceKey, releaseKey]).sort(),
  RDL_SOURCES.map((source) => [source.key, getDefaultReleaseKey(source.key)]).sort(),
  "all-scope API authority must query exactly one configured default/current release per source",
);
assert.ok(allCalls.every((call) => call.limit === 80 && call.q === "property"), "all-scope API calls must request only ranked top-80 candidates per current release");
console.log(`PASS RDL-037.1 all-current API authority: sources=${allCalls.length} results=${allApi.results.length}`);

const dualCalls: FetchCall[] = [];
const dual = await loadRdlGlobalSearchRuntime({
  query: "property",
  source: "all",
  releaseKey: null,
  mode: "dual",
  fetcher: serviceFetcher(dualCalls),
  jsonRecords: oracle,
});
assert.deepEqual(dual.results, allExpected, "dual mode must return API results only after exact search parity");
console.log("PASS RDL-037.1 global search dual read equals JSON rollback/reference oracle");

let jsonApiCalls = 0;
const json = await loadRdlGlobalSearchRuntime({
  query: "property",
  source: "all",
  releaseKey: null,
  mode: "json",
  jsonRecords: oracle,
  fetcher: async () => {
    jsonApiCalls += 1;
    return new Response("unexpected", { status: 500 });
  },
});
assert.deepEqual(json.results, allExpected);
assert.equal(jsonApiCalls, 0, "explicit JSON rollback mode must make no runtime API call");
console.log("PASS RDL-037.1 explicit JSON rollback mode remains API-independent");

await assert.rejects(
  loadRdlGlobalSearchRuntime({
    query: "property",
    source: "all",
    releaseKey: null,
    mode: "dual",
    jsonRecords: oracle,
    fetcher: serviceFetcher([], (body) => ({ ...body, items: body.items.length ? [{ ...body.items[0], name: `${body.items[0].name} mismatch` }, ...body.items.slice(1)] : body.items })),
  }),
  RdlBrowserDualReadError,
  "dual mode must fail closed on semantic mismatch",
);

await assert.rejects(
  loadRdlGlobalSearchRuntime({
    query: "property",
    source: "cfihos",
    releaseKey: "cfihos-2.0",
    mode: "api",
    fetcher: async () => new Response("unavailable", { status: 503 }),
  }),
  RdlBrowserRuntimeReadError,
  "API-authority mode must fail closed instead of silently substituting JSON",
);
console.log("PASS RDL-037.1 mismatch and API-unavailable paths fail closed without JSON substitution");

const historicalExpected = searchRdlRecords(oracle, "property", "water-desalination", "water-desalination-0.1-draft", 80);
const historical = await loadRdlGlobalSearchRuntime({
  query: "property",
  source: "water-desalination",
  releaseKey: "water-desalination-0.1-draft",
  mode: "api",
  fetcher: serviceFetcher([]),
});
assert.deepEqual(historical.results, historicalExpected, "explicit historical release search must not substitute the current/default release");
console.log(`PASS RDL-037.1 explicit historical release remains isolated: results=${historical.results.length}`);

console.log("PASS RDL-037.1 global search runtime convergence contract");
