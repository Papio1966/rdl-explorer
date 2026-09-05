import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CfihosRuntimeCompatibilityService } from "../server/rdl/CfihosRuntimeCompatibilityService.ts";
import {
  loadCfihosHandoverEventSource,
  type CfihosHandoverEventSource,
} from "../src/cfihos/runtimeCompatibility.ts";
import { CfihosHandoverEventRepository } from "../src/cfihos/repository/CfihosHandoverEventRepository.ts";
import { RdlBrowserDualReadError } from "../src/rdl/runtimeDualRead.ts";

const snapshot = JSON.parse(
  readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"),
) as {
  source: { sha256: string };
  sheets: Record<string, { rows: Record<string, unknown>[] }>;
};

const handoverRows = snapshot.sheets["handover event"]?.rows ?? [];
const disciplineDocumentRows = snapshot.sheets["discipline document type"]?.rows ?? [];
assert.equal(handoverRows.length, 5, "reviewed CFIHOS handover source must contain five rows");

const validRelationshipRows = disciplineDocumentRows.filter((row) =>
  text(row["discipline document type CFIHOS unique code"])
  && text(row["discipline CFIHOS unique code"])
  && text(row["document type CFIHOS unique code"]),
);
const relationshipsWithAnyStatus = validRelationshipRows.filter((row) =>
  [
    "required document status for detailed engineering",
    "required document status for construction",
    "required document status for commissioning",
    "required document status for startup",
    "required document status for operations",
  ].some((key) => Boolean(text(row[key]))),
);

const reference: CfihosHandoverEventSource = {
  rows: handoverRows,
  lifecycleRelationshipCount: validRelationshipRows.length,
  lifecycleRelationshipsWithAnyStatusCount: relationshipsWithAnyStatus.length,
  sourceSha256: snapshot.source.sha256,
  packageKey: null,
};

const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const service = new CfihosRuntimeCompatibilityService(client);
const databaseResult = await service.handoverEvents({
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
});

assert.equal(databaseResult.contentSha256, snapshot.source.sha256, "validated package source SHA must match the reviewed snapshot");
assert.equal(databaseResult.items.length, handoverRows.length, "PostgreSQL must preserve all Handover Event rows");
assert.equal(databaseResult.lifecycleRelationshipCount, validRelationshipRows.length, "PostgreSQL lifecycle relationship count must match the legacy repository semantics");
assert.equal(databaseResult.lifecycleRelationshipsWithAnyStatusCount, relationshipsWithAnyStatus.length, "PostgreSQL lifecycle status coverage must match the legacy repository semantics");
assert.ok(databaseResult.items.every((item) => String(item.sourceLocator.sheet ?? "") === "handover event"), "PostgreSQL Handover Event provenance must remain on the authoritative worksheet");
console.log("PASS RDL-040.1 live PostgreSQL Handover Event source/provenance parity");

const apiPayload = {
  schemaVersion: "rdl-cfihos-handover-events/v1",
  ...databaseResult,
};
const successfulFetcher = async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  assert.equal(url.pathname, "/api/rdl-runtime/cfihos-handover-events");
  assert.equal(url.searchParams.get("sourceKey"), "cfihos");
  assert.equal(url.searchParams.get("releaseKey"), "cfihos-2.0");
  return new Response(JSON.stringify(apiPayload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

let jsonFetchCount = 0;
const jsonSource = await loadCfihosHandoverEventSource({
  mode: "json",
  reference,
  fetcher: async () => {
    jsonFetchCount += 1;
    throw new Error("json mode must not call the runtime API");
  },
});
assert.equal(jsonFetchCount, 0);
assert.equal(jsonSource, reference);
console.log("PASS RDL-040.1 JSON rollback/reference mode makes no API call");

const dualSource = await loadCfihosHandoverEventSource({
  mode: "dual",
  reference,
  fetcher: successfulFetcher,
});
assert.equal(dualSource.packageKey, databaseResult.packageKey);
assert.equal(dualSource.sourceSha256, reference.sourceSha256);
console.log("PASS RDL-040.1 dual mode confirms exact Handover Event and lifecycle diagnostic parity");

const apiSource = await loadCfihosHandoverEventSource({
  mode: "api",
  fetcher: successfulFetcher,
});
assert.equal(apiSource.rows.length, 5);
assert.equal(apiSource.lifecycleRelationshipCount, validRelationshipRows.length);
console.log("PASS RDL-040.1 API authority mode uses the same-origin PostgreSQL compatibility endpoint");

await assert.rejects(
  () => loadCfihosHandoverEventSource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      items: apiPayload.items.map((item, index) => index === 0 ? { ...item, name: `${item.name} mismatch` } : item),
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
await assert.rejects(
  () => loadCfihosHandoverEventSource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      contentSha256: "mismatched-source-sha",
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
console.log("PASS RDL-040.1 dual mode fails closed on semantic or source-fingerprint mismatch");

const repository = new CfihosHandoverEventRepository(async () => apiSource);
const events = await repository.getHandoverEvents();
const diagnostics = await repository.getDiagnostics();
const expectedEvents = handoverRows
  .map((row) => ({
    id: text(row["CFIHOS unique code"]),
    name: text(row["handover event name"]),
    description: nullableText(row["handover event description"]),
    reportingSequence: nullableNumber(row["handover event reporting sequence number"]),
    lifecyclePhaseKey: lifecyclePhase(text(row["handover event name"])),
  }))
  .filter((event) => Boolean(event.id && event.name && event.lifecyclePhaseKey))
  .sort((a, b) => (a.reportingSequence ?? Number.MAX_SAFE_INTEGER) - (b.reportingSequence ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

assert.deepEqual(events, expectedEvents, "repository public Handover Event semantics must remain unchanged");
assert.equal(diagnostics.sourceRowCount, handoverRows.length);
assert.equal(diagnostics.eventCount, expectedEvents.length);
assert.equal(diagnostics.lifecycleRelationshipCount, validRelationshipRows.length);
assert.equal(diagnostics.lifecycleRelationshipsWithAnyStatusCount, relationshipsWithAnyStatus.length);
assert.equal(diagnostics.missingExpectedLifecyclePhaseCount, 0);
assert.equal(diagnostics.unmappedEventCount, 0);
assert.equal(diagnostics.sequenceMatchesLifecycleOrder, true);
console.log("PASS RDL-040.1 existing Handover Event repository contract preserved on API-backed source data");

console.log("PASS RDL-040.1 controlled CFIHOS runtime compatibility vertical slice");

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}

function nullableNumber(value: unknown): number | null {
  const valueText = text(value);
  if (!valueText) return null;
  const parsed = Number(valueText);
  return Number.isFinite(parsed) ? parsed : null;
}

function lifecyclePhase(name: string): "detailed-engineering" | "construction" | "commissioning" | "startup" | "operations" | null {
  const normalized = name.trim().toLowerCase().replace(/^handover\s+for\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  if (normalized === "detailed engineering") return "detailed-engineering";
  if (normalized === "construction") return "construction";
  if (normalized === "commissioning") return "commissioning";
  if (normalized === "start up" || normalized === "startup") return "startup";
  if (normalized === "operations" || normalized === "operation") return "operations";
  return null;
}
