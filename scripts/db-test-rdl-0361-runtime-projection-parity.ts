import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import {
  RdlRuntimeProjectionRepository,
  type RdlRuntimeRelationshipRecord,
  type RdlRuntimeSearchRecord,
} from "../server/rdl/RdlRuntimeProjectionRepository.ts";

const expectedSearch = JSON.parse(readFileSync("public/rdl-search-index.json", "utf8")) as RdlRuntimeSearchRecord[];
const expectedRelationships = JSON.parse(readFileSync("public/rdl-relationship-index.json", "utf8")) as RdlRuntimeRelationshipRecord[];
const config = getRdlDatabaseConfig();
const repository = new RdlRuntimeProjectionRepository(new PsqlJsonClient(config.connectionString));

const releasePairs = [...new Map(expectedSearch.map((record) => [`${record.sourceKey}|${record.releaseKey}`, { sourceKey: record.sourceKey, releaseKey: record.releaseKey }])).values()]
  .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.releaseKey.localeCompare(b.releaseKey));

const actualSearch: RdlRuntimeSearchRecord[] = [];
const actualRelationships: RdlRuntimeRelationshipRecord[] = [];

for (const pair of releasePairs) {
  let projection;
  try {
    projection = await repository.project(pair.sourceKey, pair.releaseKey);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(`RDL-036.1 projection read failed for ${pair.sourceKey}/${pair.releaseKey}: ${message}`);
  }
  actualSearch.push(...projection.searchRecords);
  actualRelationships.push(...projection.relationshipRecords);

  const expectedPackageKeys = new Set(expectedSearch.filter((record) => record.sourceKey === pair.sourceKey && record.releaseKey === pair.releaseKey).map((record) => record.packageKey));
  const actualPackageKeys = new Set(projection.searchRecords.map((record) => record.packageKey));
  assert.deepEqual(actualPackageKeys, expectedPackageKeys, `package identity mismatch for ${pair.sourceKey}/${pair.releaseKey}`);
  console.log(`PASS package projection ${pair.sourceKey}/${pair.releaseKey}: entities=${projection.searchRecords.length}, relationships=${projection.relationshipRecords.length}`);
}

compareCollection("search", expectedSearch, actualSearch, searchKey);
compareCollection("relationship", expectedRelationships, actualRelationships, relationshipKey);

console.log(`PASS RDL-036.1 runtime search projection parity: ${actualSearch.length} records`);
console.log(`PASS RDL-036.1 runtime relationship projection parity: ${actualRelationships.length} records`);
console.log("PASS RDL-036.1 PostgreSQL runtime projection equals committed browser oracle across all five releases");

function searchKey(record: RdlRuntimeSearchRecord) {
  return [record.sourceKey, record.releaseKey, record.packageKey, record.entityType, record.nativeIdentifier].join("|");
}

function relationshipKey(record: RdlRuntimeRelationshipRecord) {
  return [
    record.sourceKey,
    record.releaseKey,
    record.packageKey,
    record.relationshipType,
    record.sourceEntityType,
    record.sourceNativeIdentifier,
    record.targetEntityType,
    record.targetNativeIdentifier,
    record.attributes?.mappingId ?? "",
  ].join("|");
}

function compareCollection<T>(label: string, expected: T[], actual: T[], key: (value: T) => string) {
  const expectedByKey = new Map(expected.map((record) => [key(record), record]));
  const actualByKey = new Map(actual.map((record) => [key(record), record]));
  const missing = [...expectedByKey.keys()].filter((item) => !actualByKey.has(item));
  const unexpected = [...actualByKey.keys()].filter((item) => !expectedByKey.has(item));
  if (missing.length || unexpected.length) {
    throw new Error(`${label} identity mismatch\nmissing=${JSON.stringify(missing.slice(0, 20))}\nunexpected=${JSON.stringify(unexpected.slice(0, 20))}`);
  }
  const mismatches: Array<{ key: string; expected: T; actual: T }> = [];
  for (const [identity, expectedRecord] of expectedByKey) {
    const actualRecord = actualByKey.get(identity)!;
    try {
      assert.deepEqual(actualRecord, expectedRecord);
    } catch {
      mismatches.push({ key: identity, expected: expectedRecord, actual: actualRecord });
      if (mismatches.length >= 10) break;
    }
  }
  if (mismatches.length) {
    const formatted = mismatches.map((item) => {
      const expectedRecord = item.expected as Record<string, unknown>;
      const actualRecord = item.actual as Record<string, unknown>;
      const fields = [...new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)])]
        .filter((field) => JSON.stringify(expectedRecord[field]) !== JSON.stringify(actualRecord[field]));
      return `${item.key}\ndifferingFields=${JSON.stringify(fields)}\nexpected=${JSON.stringify(item.expected)}\nactual=${JSON.stringify(item.actual)}`;
    });
    throw new Error(`${label} semantic mismatch\n${formatted.join("\n\n")}`);
  }
  assert.equal(actualByKey.size, expectedByKey.size, `${label} count mismatch`);
}
