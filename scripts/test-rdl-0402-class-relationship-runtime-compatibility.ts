import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CfihosRuntimeCompatibilityService } from "../server/rdl/CfihosRuntimeCompatibilityService.ts";
import {
  loadCfihosClassRelationshipSource,
  type CfihosClassRelationshipSource,
} from "../src/cfihos/runtimeCompatibility.ts";
import { CfihosClassRelationshipRepository } from "../src/cfihos/repository/CfihosClassRelationshipRepository.ts";
import { RdlBrowserDualReadError } from "../src/rdl/runtimeDualRead.ts";

const snapshot = JSON.parse(
  readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"),
) as {
  source: { sha256: string };
  sheets: Record<string, { rows: Record<string, unknown>[] }>;
};

const relationshipRows = snapshot.sheets["tag equipment class relationshi"]?.rows ?? [];
assert.equal(relationshipRows.length, 911, "reviewed CFIHOS class relationship source must contain 911 rows");

const reference: CfihosClassRelationshipSource = {
  rows: relationshipRows,
  sourceSha256: snapshot.source.sha256,
  packageKey: null,
};

const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const service = new CfihosRuntimeCompatibilityService(client);
const databaseResult = await service.classRelationships({
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
});

assert.equal(databaseResult.contentSha256, snapshot.source.sha256, "validated package source SHA must match the reviewed snapshot");
assert.equal(databaseResult.items.length, relationshipRows.length, "PostgreSQL must preserve all tag/equipment relationships");
assert.ok(
  databaseResult.items.every((item) => String(item.sourceLocator.sheet ?? "") === "tag equipment class relationshi"),
  "PostgreSQL relationship provenance must remain on the authoritative worksheet",
);
assert.deepEqual(
  normalizeRuntimeItems(databaseResult.items),
  normalizeSourceRows(relationshipRows),
  "PostgreSQL relationship endpoint identities, names and mapping reasons must match the workbook",
);
console.log("PASS RDL-040.2 live PostgreSQL class relationship source/provenance parity");

const apiPayload = {
  schemaVersion: "rdl-cfihos-class-relationships/v1",
  ...databaseResult,
};
const successfulFetcher = async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  assert.equal(url.pathname, "/api/rdl-runtime/cfihos-class-relationships");
  assert.equal(url.searchParams.get("sourceKey"), "cfihos");
  assert.equal(url.searchParams.get("releaseKey"), "cfihos-2.0");
  return new Response(JSON.stringify(apiPayload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

let jsonFetchCount = 0;
const jsonSource = await loadCfihosClassRelationshipSource({
  mode: "json",
  reference,
  fetcher: async () => {
    jsonFetchCount += 1;
    throw new Error("json mode must not call the runtime API");
  },
});
assert.equal(jsonFetchCount, 0);
assert.equal(jsonSource, reference);
console.log("PASS RDL-040.2 JSON rollback/reference mode makes no API call");

const dualSource = await loadCfihosClassRelationshipSource({
  mode: "dual",
  reference,
  fetcher: successfulFetcher,
});
assert.equal(dualSource.packageKey, databaseResult.packageKey);
assert.equal(dualSource.sourceSha256, reference.sourceSha256);
assert.deepEqual(normalizeSourceRows(dualSource.rows), normalizeSourceRows(reference.rows));
console.log("PASS RDL-040.2 dual mode confirms exact class relationship parity");

const apiSource = await loadCfihosClassRelationshipSource({
  mode: "api",
  fetcher: successfulFetcher,
});
assert.equal(apiSource.rows.length, 911);
console.log("PASS RDL-040.2 API authority mode uses the same-origin PostgreSQL compatibility endpoint");

await assert.rejects(
  () => loadCfihosClassRelationshipSource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      items: apiPayload.items.map((item, index) => index === 0
        ? { ...item, equipmentClassName: `${item.equipmentClassName} mismatch` }
        : item),
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
await assert.rejects(
  () => loadCfihosClassRelationshipSource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      contentSha256: "mismatched-source-sha",
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
console.log("PASS RDL-040.2 dual mode fails closed on semantic or source-fingerprint mismatch");

const originalFetch = globalThis.fetch;
let stagedResolverSnapshotFetchCount = 0;
const stagedResolverFetch: typeof fetch = async (input, init) => {
  const requested = String(input);
  if (requested === "/cfihos-workbook.json" || requested.endsWith("/cfihos-workbook.json")) {
    stagedResolverSnapshotFetchCount += 1;
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

globalThis.fetch = stagedResolverFetch;
try {
  const referenceRepository = new CfihosClassRelationshipRepository(async () => reference);
  const apiRepository = new CfihosClassRelationshipRepository(async () => apiSource);
  const [referenceRelationships, apiRelationships, referenceDiagnostics, apiDiagnostics] = await Promise.all([
    referenceRepository.getRelationships(),
    apiRepository.getRelationships(),
    referenceRepository.getDiagnostics(),
    apiRepository.getDiagnostics(),
  ]);
  assert.deepEqual(apiRelationships, referenceRelationships, "repository resolved relationship contract must remain unchanged");
  assert.deepEqual(apiDiagnostics, referenceDiagnostics, "repository relationship diagnostics must remain unchanged");
  assert.equal(apiRelationships.length, 911);
  assert.equal(apiDiagnostics.unresolvedTagReferenceCount, 0);
  assert.equal(apiDiagnostics.unresolvedEquipmentReferenceCount, 0);
  assert.equal(apiDiagnostics.mappingReasonCount, 26);

  const representative = apiRelationships.find((item) => item.relationship.tagClassId && item.relationship.equipmentClassId);
  assert.ok(representative, "a representative relationship must exist");
  assert.deepEqual(
    await apiRepository.getEquipmentClassesForTagClass(representative.tagClass.id),
    await referenceRepository.getEquipmentClassesForTagClass(representative.tagClass.id),
  );
  assert.deepEqual(
    await apiRepository.getTagClassesForEquipmentClass(representative.equipmentClass.id),
    await referenceRepository.getTagClassesForEquipmentClass(representative.equipmentClass.id),
  );
} finally {
  globalThis.fetch = originalFetch;
}
assert.ok(
  stagedResolverSnapshotFetchCount > 0,
  "the staged RDL-040.2 repository test must exercise the still-snapshot-backed Tag/Equipment endpoint resolvers",
);
console.log("PASS RDL-040.2 existing Class Relationship repository contract preserved with staged snapshot-backed Tag/Equipment endpoint resolvers");

console.log("PASS RDL-040.2 controlled CFIHOS Class Relationship PostgreSQL convergence slice");

type RuntimeItem = {
  tagClassId: string;
  tagClassName: string;
  equipmentClassId: string;
  equipmentClassName: string;
  mappingReason: string | null;
};

function normalizeRuntimeItems(items: RuntimeItem[]) {
  return items
    .map((item) => ({
      tagClassId: text(item.tagClassId),
      tagClassName: text(item.tagClassName),
      equipmentClassId: text(item.equipmentClassId),
      equipmentClassName: text(item.equipmentClassName),
      mappingReason: nullableText(item.mappingReason),
    }))
    .sort(compareRows);
}

function normalizeSourceRows(rows: Record<string, unknown>[]) {
  return rows
    .map((row) => ({
      tagClassId: text(row["tag class CFIHOS unique code"]),
      tagClassName: text(row["tag class name"]),
      equipmentClassId: text(row["equipment class CFIHOS unique code"]),
      equipmentClassName: text(row["equipment class name"]),
      mappingReason: nullableText(row["tag or equipment class relationship reason for mapping"]),
    }))
    .filter((row) => row.tagClassId && row.equipmentClassId)
    .sort(compareRows);
}

function compareRows(
  a: { tagClassId: string; equipmentClassId: string; mappingReason: string | null },
  b: { tagClassId: string; equipmentClassId: string; mappingReason: string | null },
) {
  return a.tagClassId.localeCompare(b.tagClassId)
    || a.equipmentClassId.localeCompare(b.equipmentClassId)
    || String(a.mappingReason ?? "").localeCompare(String(b.mappingReason ?? ""));
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}
