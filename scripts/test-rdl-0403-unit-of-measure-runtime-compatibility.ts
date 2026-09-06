import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CfihosRuntimeCompatibilityService } from "../server/rdl/CfihosRuntimeCompatibilityService.ts";
import {
  loadCfihosUnitOfMeasureSource,
  type CfihosUnitOfMeasureSource,
} from "../src/cfihos/runtimeCompatibility.ts";
import { CfihosUnitOfMeasureRepository } from "../src/cfihos/repository/CfihosUnitOfMeasureRepository.ts";
import { RdlBrowserDualReadError } from "../src/rdl/runtimeDualRead.ts";

const snapshot = JSON.parse(
  readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"),
) as {
  source: { sha256: string };
  sheets: Record<string, { rows: Record<string, unknown>[] }>;
};

const unitRows = snapshot.sheets["unit of measure"]?.rows ?? [];
const tagPropertyRows = snapshot.sheets["tag class property"]?.rows ?? [];
const equipmentPropertyRows = snapshot.sheets["equipment class property"]?.rows ?? [];
const propertyRows = snapshot.sheets.property?.rows ?? [];
assert.equal(unitRows.length, 1472, "reviewed CFIHOS Unit of Measure source must contain 1472 rows");

const reference: CfihosUnitOfMeasureSource = {
  unitRows,
  tagPropertyRows,
  equipmentPropertyRows,
  propertyRows,
  sourceSha256: snapshot.source.sha256,
  packageKey: null,
};

const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const service = new CfihosRuntimeCompatibilityService(client);
const databaseResult = await service.unitsOfMeasure({
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
});

assert.equal(databaseResult.contentSha256, snapshot.source.sha256);
assert.equal(databaseResult.items.length, 1472);
assert.ok(databaseResult.items.every((item) => String(item.sourceLocator.sheet ?? "") === "unit of measure"));
assert.deepEqual(normalizeRuntimeUnits(databaseResult.items), normalizeUnitRows(unitRows));
assert.deepEqual(
  normalizeRuntimeReferences(databaseResult.tagPropertyReferences),
  normalizeUnitReferences(tagPropertyRows),
);
assert.deepEqual(
  normalizeRuntimeReferences(databaseResult.equipmentPropertyReferences),
  normalizeUnitReferences(equipmentPropertyRows),
);
assert.deepEqual(
  normalizeRuntimePropertyDimensions(databaseResult.propertyDimensionReferences),
  normalizePropertyDimensions(propertyRows),
);
console.log("PASS RDL-040.3 live PostgreSQL Unit of Measure source/provenance and diagnostic-input parity");

const apiPayload = {
  schemaVersion: "rdl-cfihos-units-of-measure/v1",
  ...databaseResult,
};
const successfulFetcher = async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  assert.equal(url.pathname, "/api/rdl-runtime/cfihos-units-of-measure");
  assert.equal(url.searchParams.get("sourceKey"), "cfihos");
  assert.equal(url.searchParams.get("releaseKey"), "cfihos-2.0");
  return new Response(JSON.stringify(apiPayload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

let jsonFetchCount = 0;
const jsonSource = await loadCfihosUnitOfMeasureSource({
  mode: "json",
  reference,
  fetcher: async () => {
    jsonFetchCount += 1;
    throw new Error("json mode must not call the runtime API");
  },
});
assert.equal(jsonFetchCount, 0);
assert.equal(jsonSource, reference);
console.log("PASS RDL-040.3 JSON rollback/reference mode makes no API call");

const dualSource = await loadCfihosUnitOfMeasureSource({
  mode: "dual",
  reference,
  fetcher: successfulFetcher,
});
assert.equal(dualSource.packageKey, databaseResult.packageKey);
assert.equal(dualSource.sourceSha256, reference.sourceSha256);
assert.deepEqual(normalizeUnitRows(dualSource.unitRows), normalizeUnitRows(reference.unitRows));
assert.deepEqual(normalizeUnitReferences(dualSource.tagPropertyRows), normalizeUnitReferences(reference.tagPropertyRows));
assert.deepEqual(normalizeUnitReferences(dualSource.equipmentPropertyRows), normalizeUnitReferences(reference.equipmentPropertyRows));
assert.deepEqual(normalizePropertyDimensions(dualSource.propertyRows), normalizePropertyDimensions(reference.propertyRows));
console.log("PASS RDL-040.3 dual mode confirms exact Unit of Measure and diagnostic-input parity");

const apiSource = await loadCfihosUnitOfMeasureSource({ mode: "api", fetcher: successfulFetcher });
assert.equal(apiSource.unitRows.length, 1472);
console.log("PASS RDL-040.3 API authority mode uses the same-origin PostgreSQL compatibility endpoint");

await assert.rejects(
  () => loadCfihosUnitOfMeasureSource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      items: apiPayload.items.map((item, index) => index === 0
        ? { ...item, name: `${item.name} mismatch` }
        : item),
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
await assert.rejects(
  () => loadCfihosUnitOfMeasureSource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      contentSha256: "mismatched-source-sha",
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
console.log("PASS RDL-040.3 dual mode fails closed on semantic or source-fingerprint mismatch");

const referenceRepository = new CfihosUnitOfMeasureRepository(async () => reference);
const apiRepository = new CfihosUnitOfMeasureRepository(async () => apiSource);
const [referenceUnits, apiUnits, referenceDiagnostics, apiDiagnostics] = await Promise.all([
  referenceRepository.getUnits(),
  apiRepository.getUnits(),
  referenceRepository.getDiagnostics(),
  apiRepository.getDiagnostics(),
]);
assert.deepEqual(apiUnits, referenceUnits, "Unit of Measure repository list contract must remain unchanged");
assert.deepEqual(apiDiagnostics, referenceDiagnostics, "Unit of Measure diagnostics must remain unchanged");
assert.equal(apiUnits.length, 1472);
assert.equal(apiDiagnostics.dimensionCount, 199);
assert.equal(apiDiagnostics.measurementSystemCount, 2);
assert.equal(apiDiagnostics.resolvedUnitReferenceCount, 3126);
assert.equal(apiDiagnostics.unresolvedUnitReferenceCount, 0);
assert.equal(apiDiagnostics.propertyDimensionReferenceCount, 612);
assert.equal(apiDiagnostics.unresolvedPropertyDimensionReferenceCount, 0);

const representative = apiUnits.find((unit) => unit.dimensionId);
assert.ok(representative?.dimensionId, "a representative unit with a dimension must exist");
assert.deepEqual(
  await apiRepository.getUnit(representative.id.toLowerCase()),
  await referenceRepository.getUnit(representative.id.toLowerCase()),
);
assert.deepEqual(
  await apiRepository.getUnitsForDimension(representative.dimensionId.toLowerCase()),
  await referenceRepository.getUnitsForDimension(representative.dimensionId.toLowerCase()),
);
console.log("PASS RDL-040.3 existing Unit of Measure repository contract and diagnostics preserved on API-backed source data");

console.log("PASS RDL-040.3 controlled CFIHOS Unit of Measure PostgreSQL convergence slice");

type RuntimeUnit = {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
};
type RuntimeReference = {
  siUnitId: string | null;
  imperialUnitId: string | null;
};
type RuntimeDimension = { dimensionId: string | null };

function normalizeRuntimeUnits(items: RuntimeUnit[]) {
  return items.map((item) => unitObject(item.id, item.name, item.metadata)).sort(byUnitId);
}

function normalizeUnitRows(rows: Record<string, unknown>[]) {
  return rows
    .map((row) => unitObject(
      text(rowValue(row, ["CFIHOS unique code", "unit of measure CFIHOS unique code"])),
      text(rowValue(row, ["unit of measure name"])),
      {
        uneceCode: rowValue(row, ["UNECE code", "UNECE Common Code", "UNECE common code"]),
        symbol: rowValue(row, ["unit of measure symbol"]),
        dimensionId: rowValue(row, ["unit of measure dimension code CFIHOS unique code", "unit of measure dimension CFIHOS unique code"]),
        dimensionCode: rowValue(row, ["unit of measure dimension code"]),
        dimensionName: rowValue(row, ["unit of measure dimension name"]),
        measurementSystemId: rowValue(row, ["measurement system code CFIHOS unique code", "unit of measure system CFIHOS unique code", "unit of measure system code CFIHOS unique code"]),
        measurementSystemCode: rowValue(row, ["measurement system code", "unit of measure system code", "unit of measure system"]),
        measurementSystemName: rowValue(row, ["measurement system name", "unit of measure system name"]),
        synonym: rowValue(row, ["unit of measure synonym name"]),
      },
    ))
    .filter((item) => item.id && item.name)
    .sort(byUnitId);
}

function unitObject(idValue: unknown, nameValue: unknown, metadata: Record<string, unknown>) {
  return {
    id: text(idValue),
    uneceCommonCode: nullableText(metadata.uneceCode),
    name: text(nameValue),
    symbol: nullableText(metadata.symbol),
    dimensionId: nullableText(metadata.dimensionId),
    dimensionCode: nullableText(metadata.dimensionCode),
    dimensionName: nullableText(metadata.dimensionName),
    systemId: nullableText(metadata.measurementSystemId),
    systemCode: nullableText(metadata.measurementSystemCode),
    systemName: nullableText(metadata.measurementSystemName),
    synonyms: normalizeDelimited(metadata.synonym),
  };
}

function normalizeRuntimeReferences(items: RuntimeReference[]) {
  return items.map((item) => ({
    siUnitId: nullableText(item.siUnitId),
    imperialUnitId: nullableText(item.imperialUnitId),
  })).filter((item) => item.siUnitId || item.imperialUnitId).sort(byReference);
}

function normalizeUnitReferences(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    siUnitId: nullableText(rowValue(row, ["SI unit of measure CFIHOS unique code"])),
    imperialUnitId: nullableText(rowValue(row, ["imperial unit of measure CFIHOS unique code"])),
  })).filter((item) => item.siUnitId || item.imperialUnitId).sort(byReference);
}

function normalizeRuntimePropertyDimensions(items: RuntimeDimension[]) {
  return items.map((item) => nullableText(item.dimensionId)).filter((value): value is string => Boolean(value)).sort();
}

function normalizePropertyDimensions(rows: Record<string, unknown>[]) {
  return rows.map((row) => nullableText(rowValue(row, ["unit of measure dimension code CFIHOS unique code"]))).filter((value): value is string => Boolean(value)).sort();
}

function byUnitId(a: { id: string }, b: { id: string }) { return a.id.localeCompare(b.id); }
function byReference(a: { siUnitId: string | null; imperialUnitId: string | null }, b: { siUnitId: string | null; imperialUnitId: string | null }) {
  return String(a.siUnitId ?? "").localeCompare(String(b.siUnitId ?? ""))
    || String(a.imperialUnitId ?? "").localeCompare(String(b.imperialUnitId ?? ""));
}
function rowValue(row: Record<string, unknown>, candidates: string[]) {
  for (const candidate of candidates) if (Object.prototype.hasOwnProperty.call(row, candidate)) return row[candidate];
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const candidate of candidates) if (normalized.has(normalizeHeader(candidate))) return normalized.get(normalizeHeader(candidate));
  return null;
}
function normalizeHeader(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }
function normalizeDelimited(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  return raw ? raw.split(/[;,|]/).map((item) => item.trim()).filter(Boolean) : [];
}
function text(value: unknown) { return String(value ?? "").trim(); }
function nullableText(value: unknown) { const valueText = text(value); return valueText || null; }
