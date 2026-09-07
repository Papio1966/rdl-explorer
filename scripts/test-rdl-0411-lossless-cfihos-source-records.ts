import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SNAPSHOT_PATH = new URL(
  "../public/cfihos-workbook.json",
  import.meta.url,
);

const EXPECTED_SCHEMA = "cfihos-workbook-snapshot-v1";
const RELEASE_KEY = "cfihos-2.0";
const FIRST_DATA_ROW_NUMBER = 2;

type WorksheetRow = Record<string, unknown>;

type WorkbookSnapshot = {
  schema: string;
  source: {
    url: string;
    generatedAt: string;
    sha256: string;
  };
  sheetNames: string[];
  sheets: Record<
    string,
    {
      headers: string[];
      rows: WorksheetRow[];
    }
  >;
};

type PackageRow = {
  packageId: number;
  packageKey: string;
  packageStatus: string;
  contentSha256: string;
  sourceUri: string;
  snapshotSchema: string;
  generatedAt: string;
  sourceKey: string;
  releaseKey: string;
};

type SourceSheetRow = {
  sourceSheetId: number;
  sheetName: string;
  sheetOrder: number;
  firstDataRowNumber: number;
  headers: string[];
  sourceRowCount: number;
  storedRowCount: number;
  sheetSha256: string;
  rowCountMatches: boolean;
};

type SourceRecordRow = {
  sheetName: string;
  sheetOrder: number;
  sourceRowNumber: number;
  recordOrder: number;
  rawRow: WorksheetRow;
  rowSha256: string;
};

function fail(message: string): never {
  throw new Error(`RDL-041.1 lossless source-record test failed: ${message}`);
}

function assertSnapshot(value: unknown): asserts value is WorkbookSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("snapshot root is not an object");
  }

  const candidate = value as Partial<WorkbookSnapshot>;

  equal(candidate.schema, EXPECTED_SCHEMA, "snapshot schema");
  ok(candidate.source && typeof candidate.source === "object");
  ok(Array.isArray(candidate.sheetNames));
  ok(candidate.sheets && typeof candidate.sheets === "object");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const databaseUrl = process.env.RDL_DATABASE_URL?.trim();
if (!databaseUrl) {
  fail("RDL_DATABASE_URL is required");
}

function query(sql: string): string {
  const result = spawnSync(
    "psql",
    [
      databaseUrl,
      "-X",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    },
  );

  if (result.error) {
    fail(`unable to execute psql: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`psql exited ${String(result.status)}: ${result.stderr.trim()}`);
  }

  return result.stdout.trim();
}

function parseJsonLines<T>(value: string): T[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

const parsed: unknown = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
assertSnapshot(parsed);

const snapshot = parsed;
const sourceSha256 = snapshot.source.sha256.toLowerCase();
const packageKey = `cfihos-2.0-${sourceSha256.slice(0, 12)}`;

const packageRows = parseJsonLines<PackageRow>(
  query(`
    SELECT json_build_object(
      'packageId', p.package_id,
      'packageKey', p.package_key,
      'packageStatus', p.package_status,
      'contentSha256', p.content_sha256,
      'sourceUri', COALESCE(p.source_uri, ''),
      'snapshotSchema', COALESCE(p.manifest->>'schema', ''),
      'generatedAt', COALESCE(p.manifest->>'generatedAt', ''),
      'sourceKey', s.source_key,
      'releaseKey', r.release_key
    )::text
    FROM rdl.rdl_package p
    JOIN rdl.rdl_release r ON r.release_id = p.release_id
    JOIN rdl.rdl_source s ON s.source_id = r.source_id
    WHERE p.package_key = ${sqlText(packageKey)}
      AND s.source_key = 'cfihos'
      AND r.release_key = ${sqlText(RELEASE_KEY)};
  `),
);

equal(packageRows.length, 1, "exact validated CFIHOS package");
const packageRow = packageRows[0];
equal(packageRow.packageKey, packageKey);
equal(packageRow.packageStatus, "validated");
equal(packageRow.contentSha256.toLowerCase(), sourceSha256);
equal(packageRow.sourceUri, snapshot.source.url);
equal(packageRow.snapshotSchema, snapshot.schema);
equal(packageRow.generatedAt, snapshot.source.generatedAt);
equal(packageRow.sourceKey, "cfihos");
equal(packageRow.releaseKey, RELEASE_KEY);

console.log(
  `PASS RDL-041.1 validated package/source fingerprint: ${packageKey}`,
);

const sourceSheets = parseJsonLines<SourceSheetRow>(
  query(`
    SELECT json_build_object(
      'sourceSheetId', summary.source_sheet_id,
      'sheetName', summary.sheet_name,
      'sheetOrder', summary.sheet_order,
      'firstDataRowNumber', summary.first_data_row_number,
      'headers', summary.headers,
      'sourceRowCount', summary.source_row_count,
      'storedRowCount', summary.stored_row_count,
      'sheetSha256', summary.sheet_sha256,
      'rowCountMatches', summary.row_count_matches
    )::text
    FROM rdl.rdl_source_sheet_summary summary
    WHERE summary.package_id = ${packageRow.packageId}
    ORDER BY summary.sheet_order;
  `),
);

equal(sourceSheets.length, snapshot.sheetNames.length, "source sheet count");
deepStrictEqual(
  sourceSheets.map((sheet) => sheet.sheetName),
  snapshot.sheetNames,
  "source sheet order",
);

equal(
  new Set(sourceSheets.map((sheet) => sheet.sourceSheetId)).size,
  sourceSheets.length,
  "unique source sheet IDs",
);

for (const sheet of sourceSheets) {
  const source = snapshot.sheets[sheet.sheetName];
  ok(source, `source worksheet ${sheet.sheetName}`);
  equal(sheet.firstDataRowNumber, FIRST_DATA_ROW_NUMBER);
  deepStrictEqual(sheet.headers, source.headers, `${sheet.sheetName} headers`);
  equal(sheet.sourceRowCount, source.rows.length, `${sheet.sheetName} row count`);
  equal(sheet.storedRowCount, source.rows.length, `${sheet.sheetName} stored rows`);
  equal(sheet.rowCountMatches, true, `${sheet.sheetName} summary completeness`);
  equal(
    sheet.sheetSha256,
    sha256({ headers: source.headers, rows: source.rows }),
    `${sheet.sheetName} semantic SHA-256`,
  );
}

console.log(
  `PASS RDL-041.1 exact source-sheet contract: ${sourceSheets.length} sheets`,
);

const sourceRecords = parseJsonLines<SourceRecordRow>(
  query(`
    SELECT json_build_object(
      'sheetName', sheet.sheet_name,
      'sheetOrder', sheet.sheet_order,
      'sourceRowNumber', sr.source_row_number,
      'recordOrder', sr.record_order,
      'rawRow', sr.raw_row,
      'rowSha256', sr.row_sha256
    )::text
    FROM rdl.rdl_source_record sr
    JOIN rdl.rdl_source_sheet sheet
      ON sheet.source_sheet_id = sr.source_sheet_id
     AND sheet.package_id = sr.package_id
    WHERE sr.package_id = ${packageRow.packageId}
    ORDER BY sheet.sheet_order, sr.record_order;
  `),
);

const expectedRecordCount = snapshot.sheetNames.reduce(
  (total, sheetName) => total + snapshot.sheets[sheetName].rows.length,
  0,
);

equal(sourceRecords.length, expectedRecordCount, "source record count");

const recordsBySheet = new Map<string, SourceRecordRow[]>();
for (const record of sourceRecords) {
  const records = recordsBySheet.get(record.sheetName) ?? [];
  records.push(record);
  recordsBySheet.set(record.sheetName, records);
}

const reconstructedSheets: WorkbookSnapshot["sheets"] = {};
let duplicateRowHashCount = 0;

for (const sourceSheet of sourceSheets) {
  const source = snapshot.sheets[sourceSheet.sheetName];
  const storedRecords = recordsBySheet.get(sourceSheet.sheetName) ?? [];

  equal(
    storedRecords.length,
    source.rows.length,
    `${sourceSheet.sheetName} stored record count`,
  );

  const seenHashes = new Set<string>();

  storedRecords.forEach((record, index) => {
    equal(record.sheetOrder, sourceSheet.sheetOrder);
    equal(record.recordOrder, index, `${sourceSheet.sheetName} record order`);
    equal(
      record.sourceRowNumber,
      sourceSheet.firstDataRowNumber + index,
      `${sourceSheet.sheetName} source row number`,
    );
    deepStrictEqual(
      record.rawRow,
      source.rows[index],
      `${sourceSheet.sheetName} row ${record.sourceRowNumber}`,
    );
    equal(
      record.rowSha256,
      sha256(source.rows[index]),
      `${sourceSheet.sheetName} row ${record.sourceRowNumber} SHA-256`,
    );

    if (seenHashes.has(record.rowSha256)) {
      duplicateRowHashCount += 1;
    }
    seenHashes.add(record.rowSha256);
  });

  reconstructedSheets[sourceSheet.sheetName] = {
    headers: sourceSheet.headers,
    rows: storedRecords.map((record) => record.rawRow),
  };
}

const reconstructed: WorkbookSnapshot = {
  schema: packageRow.snapshotSchema,
  source: {
    url: packageRow.sourceUri,
    generatedAt: packageRow.generatedAt,
    sha256: packageRow.contentSha256,
  },
  sheetNames: sourceSheets.map((sheet) => sheet.sheetName),
  sheets: reconstructedSheets,
};

deepStrictEqual(
  reconstructed,
  snapshot,
  "PostgreSQL lossless source round-trip",
);

console.log(
  `PASS RDL-041.1 exact source-record contract: ${sourceRecords.length} rows`,
);
console.log(
  `PASS RDL-041.1 PostgreSQL round-trip reproduces ${snapshot.sheetNames.length} sheets / ${expectedRecordCount} rows`,
);
console.log(
  `PASS RDL-041.1 duplicate row hashes are preserved by ordinal: ${duplicateRowHashCount}`,
);

const duplicateIdentityCount = Number(
  query(`
    SELECT count(*)
    FROM (
      SELECT source_sheet_id, record_order
      FROM rdl.rdl_source_record
      WHERE package_id = ${packageRow.packageId}
      GROUP BY source_sheet_id, record_order
      HAVING count(*) > 1
    ) duplicate_rows;
  `),
);

equal(duplicateIdentityCount, 0, "duplicate source record identities");

query(`
  DO $rdl041_immutability_test$
  DECLARE
    v_source_sheet_id bigint;
    v_source_record_id bigint;
  BEGIN
    SELECT source_sheet_id INTO v_source_sheet_id
    FROM rdl.rdl_source_sheet
    WHERE package_id = ${packageRow.packageId}
    ORDER BY sheet_order
    LIMIT 1;

    SELECT source_record_id INTO v_source_record_id
    FROM rdl.rdl_source_record
    WHERE package_id = ${packageRow.packageId}
    ORDER BY source_record_id
    LIMIT 1;

    BEGIN
      UPDATE rdl.rdl_source_sheet
      SET sheet_name = sheet_name
      WHERE source_sheet_id = v_source_sheet_id;
      RAISE EXCEPTION 'source sheet mutation unexpectedly succeeded';
    EXCEPTION
      WHEN SQLSTATE '55000' THEN NULL;
    END;

    BEGIN
      UPDATE rdl.rdl_source_record
      SET raw_row = raw_row
      WHERE source_record_id = v_source_record_id;
      RAISE EXCEPTION 'source record mutation unexpectedly succeeded';
    EXCEPTION
      WHEN SQLSTATE '55000' THEN NULL;
    END;
  END;
  $rdl041_immutability_test$;
`);

console.log("PASS RDL-041.1 source-sheet/source-record evidence is immutable");
console.log("PASS RDL-041.1 lossless CFIHOS PostgreSQL source layer");
