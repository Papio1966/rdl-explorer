import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CfihosRuntimeCompatibilityService } from "../server/rdl/CfihosRuntimeCompatibilityService.ts";
import {
  loadCfihosPropertySource,
  type CfihosPropertySource,
} from "../src/cfihos/runtimeCompatibility.ts";
import { CfihosPropertyRepository } from "../src/cfihos/repository/CfihosPropertyRepository.ts";
import { RdlBrowserDualReadError } from "../src/rdl/runtimeDualRead.ts";

const snapshot = JSON.parse(
  readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"),
) as {
  source: { sha256: string };
  sheets: Record<string, { rows: Record<string, unknown>[] }>;
};

const propertyRows = snapshot.sheets.property?.rows ?? [];
const tagClassRows = snapshot.sheets["tag class"]?.rows ?? [];
const tagClassPropertyRows = snapshot.sheets["tag class property"]?.rows ?? [];
const picklistValueRows = snapshot.sheets["property picklist values"]?.rows ?? [];

assert.equal(propertyRows.length, 1388);
assert.equal(tagClassRows.length, 848);
assert.equal(tagClassPropertyRows.length, 4018);
assert.equal(picklistValueRows.length, 3027);

const reference: CfihosPropertySource = {
  propertyRows,
  tagClassRows,
  tagClassPropertyRows,
  picklistValueRows,
  sourceSha256: snapshot.source.sha256,
  packageKey: null,
};

const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const service = new CfihosRuntimeCompatibilityService(client);
const databaseResult = await service.properties({
  sourceKey: "cfihos",
  releaseKey: "cfihos-2.0",
});

assert.equal(databaseResult.contentSha256, snapshot.source.sha256);
assert.equal(databaseResult.items.length, 1388);
assert.equal(databaseResult.tagClasses.length, 848);
assert.equal(databaseResult.tagClassPropertyAssignments.length, 4018);
assert.equal(databaseResult.picklistValues.length, 3027);
assert.ok(databaseResult.items.every((item) => String(item.sourceLocator.sheet ?? "") === "property"));
assert.ok(databaseResult.tagClasses.every((item) => String(item.sourceLocator.sheet ?? "") === "tag class"));
assert.ok(databaseResult.tagClassPropertyAssignments.every((item) => String(item.sourceLocator.sheet ?? "") === "tag class property"));
assert.ok(databaseResult.picklistValues.every((item) => String(item.sourceLocator.sheet ?? "") === "property picklist values"));
console.log("PASS RDL-040.4 live PostgreSQL Property source/provenance cardinality");

const apiPayload = {
  schemaVersion: "rdl-cfihos-properties/v1",
  ...databaseResult,
};

const successfulFetcher = async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  assert.equal(url.pathname, "/api/rdl-runtime/cfihos-properties");
  assert.equal(url.searchParams.get("sourceKey"), "cfihos");
  assert.equal(url.searchParams.get("releaseKey"), "cfihos-2.0");
  return new Response(JSON.stringify(apiPayload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

let jsonFetchCount = 0;
const jsonSource = await loadCfihosPropertySource({
  mode: "json",
  reference,
  fetcher: async () => {
    jsonFetchCount += 1;
    throw new Error("json mode must not call the runtime API");
  },
});
assert.equal(jsonFetchCount, 0);
assert.equal(jsonSource, reference);
console.log("PASS RDL-040.4 JSON rollback/reference mode makes no API call");

const dualSource = await loadCfihosPropertySource({
  mode: "dual",
  reference,
  fetcher: successfulFetcher,
});
assert.equal(dualSource.packageKey, databaseResult.packageKey);
assert.equal(dualSource.sourceSha256, reference.sourceSha256);
console.log("PASS RDL-040.4 dual mode confirms exact Property dependency semantics");

const apiSource = await loadCfihosPropertySource({
  mode: "api",
  fetcher: successfulFetcher,
});
assert.equal(apiSource.propertyRows.length, 1388);
assert.equal(apiSource.tagClassRows.length, 848);
assert.equal(apiSource.tagClassPropertyRows.length, 4018);
assert.equal(apiSource.picklistValueRows.length, 3027);
console.log("PASS RDL-040.4 API authority mode uses the same-origin PostgreSQL compatibility endpoint");

await assert.rejects(
  () => loadCfihosPropertySource({
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
  () => loadCfihosPropertySource({
    mode: "dual",
    reference,
    fetcher: async () => new Response(JSON.stringify({
      ...apiPayload,
      contentSha256: "mismatched-source-sha",
    }), { status: 200, headers: { "content-type": "application/json" } }),
  }),
  RdlBrowserDualReadError,
);
console.log("PASS RDL-040.4 dual mode fails closed on semantic or source-fingerprint mismatch");

const referenceRepository = new CfihosPropertyRepository(async () => reference);
const apiRepository = new CfihosPropertyRepository(async () => apiSource);
const [referenceProperties, apiProperties] = await Promise.all([
  referenceRepository.getProperties(),
  apiRepository.getProperties(),
]);
assert.deepEqual(apiProperties, referenceProperties);
assert.equal(apiProperties.length, 1388);

for (const property of referenceProperties) {
  assert.deepEqual(
    await apiRepository.getProperty(property.id),
    await referenceRepository.getProperty(property.id),
  );
  assert.deepEqual(
    await apiRepository.getTagClassesUsingProperty(property.id),
    await referenceRepository.getTagClassesUsingProperty(property.id),
  );
  assert.deepEqual(
    await apiRepository.getPicklistValues(property.id),
    await referenceRepository.getPicklistValues(property.id),
  );
}

const usageCount = (await Promise.all(
  apiProperties.map((property) => apiRepository.getTagClassesUsingProperty(property.id)),
)).reduce((sum, classes) => sum + classes.length, 0);
assert.equal(usageCount, 4018);

for (const query of ["", "length", "atex", "CFIHOS-40000001", "Number", "material specification"]) {
  assert.deepEqual(
    await apiRepository.searchProperties(query),
    await referenceRepository.searchProperties(query),
  );
}

const representative = apiProperties.find((property) => property.picklistId);
assert.ok(representative);
assert.deepEqual(
  await apiRepository.getPropertyUsage(representative.id),
  await referenceRepository.getPropertyUsage(representative.id),
);
console.log("PASS RDL-040.4 existing Property repository public contract preserved on API-backed source data");
console.log("PASS RDL-040.4 controlled CFIHOS Property PostgreSQL convergence slice");
