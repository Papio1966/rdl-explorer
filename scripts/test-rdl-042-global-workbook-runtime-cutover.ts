import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CfihosSourceWorkbookService } from "../server/rdl/CfihosSourceWorkbookService.ts";
import {
  loadCfihosWorkbook,
  type CfihosWorkbookSnapshot,
} from "../src/cfihos/workbook.ts";
import {
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
} from "../src/rdl/runtimeDualRead.ts";

const EXPECTED_PACKAGE_KEY = "cfihos-2.0-b5a2a09e9e0e";
const EXPECTED_SOURCE_SHA = "b5a2a09e9e0ecd3762b9f7a6c8b30001d832484f4ed606da9f8d59ecb0af26d1";
const EXPECTED_SHEETS = 23;
const EXPECTED_ROWS = 42_514;
const SAFE_VERCEL_RESPONSE_BUDGET_BYTES = 4_000_000;

const reference = JSON.parse(
  readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"),
) as CfihosWorkbookSnapshot;
assert.equal(reference.schema, "cfihos-workbook-snapshot-v1");
assert.equal(reference.sheetNames.length, EXPECTED_SHEETS);
assert.equal(totalRows(reference), EXPECTED_ROWS);
assert.equal(reference.source.sha256, EXPECTED_SOURCE_SHA);

const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const service = new CfihosSourceWorkbookService(client);
const manifest = await service.manifest({ sourceKey: "cfihos", releaseKey: "cfihos-2.0" });
assert.equal(manifest.packageKey, EXPECTED_PACKAGE_KEY);
assert.equal(manifest.contentSha256, EXPECTED_SOURCE_SHA);
assert.equal(manifest.sourceSha256, EXPECTED_SOURCE_SHA);
assert.equal(manifest.workbookSchema, reference.schema);
assert.equal(manifest.sourceUri, reference.source.url);
assert.equal(manifest.generatedAt, reference.source.generatedAt);
assert.equal(manifest.sheets.length, EXPECTED_SHEETS);
assert.deepEqual(manifest.sheets.map((sheet) => sheet.sheetName), reference.sheetNames);
console.log("PASS RDL-042 PostgreSQL manifest locks exact CFIHOS package/source and 23-sheet order");

const sheetPayloadByName = new Map<string, Awaited<ReturnType<typeof service.sheet>>>();
let largestResponseBytes = 0;
let largestResponseSheet = "";
for (const sheet of manifest.sheets) {
  const payload = await service.sheet({
    sourceKey: "cfihos",
    releaseKey: "cfihos-2.0",
    packageKey: manifest.packageKey,
    sheetName: sheet.sheetName,
  });
  sheetPayloadByName.set(sheet.sheetName, payload);
  assert.equal(payload.sheetOrder, sheet.sheetOrder);
  assert.deepEqual(payload.headers, reference.sheets[sheet.sheetName]?.headers ?? []);
  assert.deepEqual(payload.rows, reference.sheets[sheet.sheetName]?.rows ?? []);

  const responseBytes = Buffer.byteLength(JSON.stringify({
    schemaVersion: "rdl-cfihos-workbook-sheet/v1",
    ...payload,
  }));
  if (responseBytes > largestResponseBytes) {
    largestResponseBytes = responseBytes;
    largestResponseSheet = sheet.sheetName;
  }
  assert.ok(
    responseBytes < SAFE_VERCEL_RESPONSE_BUDGET_BYTES,
    `${sheet.sheetName} worksheet response ${responseBytes} exceeds safe 4.0 MB transport budget`,
  );
}
console.log(
  `PASS RDL-042 every package-pinned worksheet response stays below 4.0 MB; largest=${largestResponseSheet}|${largestResponseBytes} bytes`,
);

const databaseWorkbook: CfihosWorkbookSnapshot = {
  schema: "cfihos-workbook-snapshot-v1",
  source: {
    url: manifest.sourceUri,
    generatedAt: manifest.generatedAt,
    sha256: manifest.contentSha256,
  },
  sheetNames: manifest.sheets.map((sheet) => sheet.sheetName),
  sheets: Object.fromEntries(
    manifest.sheets.map((sheet) => {
      const payload = sheetPayloadByName.get(sheet.sheetName);
      assert.ok(payload);
      return [sheet.sheetName, { headers: payload.headers, rows: payload.rows }];
    }),
  ),
};
assert.deepEqual(databaseWorkbook, reference);
console.log("PASS RDL-042 PostgreSQL reconstructs the complete 23-sheet / 42514-row workbook contract exactly");

let runtimeFetchCount = 0;
const successfulFetcher = async (input: RequestInfo | URL) => {
  runtimeFetchCount += 1;
  const url = new URL(String(input), "http://localhost");
  assert.equal(url.pathname, "/api/rdl-runtime/cfihos-workbook");
  assert.equal(url.searchParams.get("sourceKey"), "cfihos");
  assert.equal(url.searchParams.get("releaseKey"), "cfihos-2.0");
  const packageKey = url.searchParams.get("packageKey");
  const sheetName = url.searchParams.get("sheetName");

  if (!packageKey && !sheetName) {
    return jsonResponse({ schemaVersion: "rdl-cfihos-workbook-manifest/v1", ...manifest });
  }
  assert.equal(packageKey, EXPECTED_PACKAGE_KEY);
  assert.ok(sheetName);
  const payload = sheetPayloadByName.get(sheetName);
  assert.ok(payload, `unexpected worksheet request ${sheetName}`);
  return jsonResponse({ schemaVersion: "rdl-cfihos-workbook-sheet/v1", ...payload });
};

const apiWorkbook = await loadCfihosWorkbook({ mode: "api", fetcher: successfulFetcher });
assert.deepEqual(apiWorkbook, reference);
assert.equal(runtimeFetchCount, EXPECTED_SHEETS + 1);
console.log("PASS RDL-042 API authority reconstructs and caches the exact workbook through one shared client boundary");

let jsonFetchCount = 0;
const jsonWorkbook = await loadCfihosWorkbook({
  mode: "json",
  reference,
  fetcher: async () => {
    jsonFetchCount += 1;
    throw new Error("JSON rollback/reference mode must not call the runtime API when reference is supplied");
  },
});
assert.equal(jsonWorkbook, reference);
assert.equal(jsonFetchCount, 0);
console.log("PASS RDL-042 JSON rollback/reference mode remains explicit and makes no runtime API call");

runtimeFetchCount = 0;
const dualWorkbook = await loadCfihosWorkbook({
  mode: "dual",
  reference,
  fetcher: successfulFetcher,
});
assert.deepEqual(dualWorkbook, reference);
assert.notEqual(dualWorkbook, reference, "dual mode must return the PostgreSQL candidate after parity");
assert.equal(runtimeFetchCount, EXPECTED_SHEETS + 1);
console.log("PASS RDL-042 dual mode proves exact global workbook parity before returning PostgreSQL authority");

await assert.rejects(
  () => loadCfihosWorkbook({
    mode: "dual",
    reference,
    fetcher: async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      const sheetName = url.searchParams.get("sheetName");
      if (!sheetName) {
        return jsonResponse({ schemaVersion: "rdl-cfihos-workbook-manifest/v1", ...manifest });
      }
      const payload = sheetPayloadByName.get(sheetName);
      assert.ok(payload);
      if (sheetName !== "RDL master object") {
        return jsonResponse({ schemaVersion: "rdl-cfihos-workbook-sheet/v1", ...payload });
      }
      const rows = payload.rows.map((row, index) => index === 0
        ? { ...row, "CFIHOS name": `${String(row["CFIHOS name"] ?? "")} mismatch` }
        : row);
      return jsonResponse({
        schemaVersion: "rdl-cfihos-workbook-sheet/v1",
        ...payload,
        rows,
      });
    },
  }),
  RdlBrowserDualReadError,
);
console.log("PASS RDL-042 dual mode fails closed on any worksheet semantic mismatch");

await assert.rejects(
  () => loadCfihosWorkbook({
    mode: "api",
    fetcher: async () => new Response("database unavailable", { status: 503 }),
  }),
  RdlBrowserRuntimeReadError,
);
console.log("PASS RDL-042 API authority fails closed when PostgreSQL runtime transport is unavailable");

await assert.rejects(
  () => service.sheet({
    sourceKey: "cfihos",
    releaseKey: "cfihos-2.0",
    packageKey: "not-the-locked-package",
    sheetName: "property",
  }),
);
console.log("PASS RDL-042 worksheet reads are pinned to one validated immutable package key");

console.log("PASS RDL-042 global PostgreSQL source runtime cutover contract");

function totalRows(workbook: CfihosWorkbookSnapshot) {
  return workbook.sheetNames.reduce(
    (count, sheetName) => count + (workbook.sheets[sheetName]?.rows.length ?? 0),
    0,
  );
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
