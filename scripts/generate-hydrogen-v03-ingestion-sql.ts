import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  readWorkbook,
  worksheetHeaders,
  worksheetRows,
} from "./rdl-ingestion/workbookReader.ts";
import { generateCfihosFormatSql } from "./rdl-ingestion/generateCfihosFormatSql.ts";
import { HYDROGEN_V03_CFIHOS_FORMAT_PROFILE as profile } from "./rdl-ingestion/HydrogenV03CfihosFormatProfile.ts";

const EXPECTED_WORKBOOK_SHA256 =
  "5d8e4e9610ecd592dbb7409939d7c3d656da831e85e39babdf5fbe00e0776605";
const EXPECTED_SHEET_COUNT = 23;
const EXPECTED_SOURCE_RECORD_COUNT = 10065;
const FIRST_DATA_ROW_NUMBER = 2;
const RECORD_BATCH_SIZE = 250;

type Row = Record<string, unknown>;
type SheetStage = {
  sheetName: string;
  sheetOrder: number;
  firstDataRowNumber: number;
  headers: string[];
  sourceRowCount: number;
  sheetSha256: string;
};
type RecordStage = {
  sheetName: string;
  sourceRowNumber: number;
  recordOrder: number;
  rawRow: Row;
  rowSha256: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
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

function jsonSql(value: unknown): string {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function emit(lines: string[], line = ""): void {
  lines.push(line);
}

const workbookPath = resolve(profile.workbookPath);
const workbookBytes = readFileSync(workbookPath);
const workbookSha256 = createHash("sha256").update(workbookBytes).digest("hex");
if (workbookSha256 !== EXPECTED_WORKBOOK_SHA256) {
  throw new Error(
    `Hydrogen workbook fingerprint mismatch: expected ${EXPECTED_WORKBOOK_SHA256}, actual ${workbookSha256}`,
  );
}

const workbook = await readWorkbook(workbookBytes);
if (workbook.sheetNames.length !== EXPECTED_SHEET_COUNT) {
  throw new Error(
    `Hydrogen workbook sheet count mismatch: expected ${EXPECTED_SHEET_COUNT}, actual ${workbook.sheetNames.length}`,
  );
}

const sheetStages: SheetStage[] = [];
const recordStages: RecordStage[] = [];
for (const [sheetOrder, sheetName] of workbook.sheetNames.entries()) {
  const worksheet = workbook.sheets[sheetName];
  if (!worksheet) throw new Error(`Hydrogen workbook is missing worksheet ${sheetName}`);
  const headers = worksheetHeaders(worksheet);
  const rows = worksheetRows<Row>(worksheet);
  sheetStages.push({
    sheetName,
    sheetOrder,
    firstDataRowNumber: FIRST_DATA_ROW_NUMBER,
    headers,
    sourceRowCount: rows.length,
    sheetSha256: sha256({ headers, rows }),
  });
  rows.forEach((rawRow, recordOrder) => {
    recordStages.push({
      sheetName,
      sourceRowNumber: FIRST_DATA_ROW_NUMBER + recordOrder,
      recordOrder,
      rawRow,
      rowSha256: sha256(rawRow),
    });
  });
}

if (recordStages.length !== EXPECTED_SOURCE_RECORD_COUNT) {
  throw new Error(
    `Hydrogen workbook source-row count mismatch: expected ${EXPECTED_SOURCE_RECORD_COUNT}, actual ${recordStages.length}`,
  );
}

const packageKey = `hydrogen-${profile.versionLabel
  .replace(/[^a-z0-9]+/gi, "-")
  .toLowerCase()}-${workbookSha256.slice(0, 12)}`;
const sourceIdentityGuard = `DO $hydrogen_v03_source_identity$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rdl.rdl_source
    WHERE source_key = 'hydrogen'
      AND (name IS DISTINCT FROM ${sqlText(profile.sourceName)}
        OR description IS DISTINCT FROM ${sqlText(profile.sourceDescription)}
        OR publisher IS DISTINCT FROM ${sqlText(profile.publisher)}
        OR authoritative_uri IS DISTINCT FROM ${sqlText(profile.sourceUri)}
        OR status IS DISTINCT FROM 'active')
  ) THEN
    RAISE EXCEPTION 'Hydrogen source key is already bound to a different source identity';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rdl.rdl_release r
    JOIN rdl.rdl_source s ON s.source_id = r.source_id
    WHERE s.source_key = 'hydrogen'
      AND r.release_key = ${sqlText(profile.releaseKey)}
      AND (r.version_label IS DISTINCT FROM ${sqlText(profile.versionLabel)}
        OR r.release_status IS DISTINCT FROM 'candidate')
  ) THEN
    RAISE EXCEPTION 'Hydrogen release key is already bound to a different version label';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rdl.rdl_package p
    LEFT JOIN rdl.rdl_release r ON r.release_id = p.release_id
    LEFT JOIN rdl.rdl_source s ON s.source_id = r.source_id
    WHERE p.package_key = ${sqlText(packageKey)}
      AND (s.source_key IS DISTINCT FROM 'hydrogen'
        OR r.release_key IS DISTINCT FROM ${sqlText(profile.releaseKey)})
  ) THEN
    RAISE EXCEPTION 'Hydrogen package key is already used by a different source or release';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rdl.rdl_package p
    JOIN rdl.rdl_release r ON r.release_id = p.release_id
    JOIN rdl.rdl_source s ON s.source_id = r.source_id
    WHERE s.source_key = 'hydrogen'
      AND r.release_key = ${sqlText(profile.releaseKey)}
      AND p.package_key = ${sqlText(packageKey)}
      AND p.package_status <> 'validated'
  ) THEN
    RAISE EXCEPTION 'Hydrogen package has a governed status other than validated';
  END IF;
END;
$hydrogen_v03_source_identity$;`;

const normalizedSql = await generateCfihosFormatSql(profile);
const commitMarker = "COMMIT;\n";
const transactionMarker = "\\set ON_ERROR_STOP on\nBEGIN;\n";
if (!normalizedSql.startsWith(transactionMarker) || !normalizedSql.endsWith(commitMarker)) {
  throw new Error("Hydrogen normalized SQL transaction markers do not match the loader contract");
}
const normalizedWithoutCommit = normalizedSql
  .replace(transactionMarker, `${transactionMarker}${sourceIdentityGuard}\n`)
  .slice(0, -commitMarker.length)
  .trimEnd();

const sourceSql: string[] = [];
emit(sourceSql, "-- Hydrogen v0.3 lossless source-sheet and source-row preservation.");
emit(sourceSql, "SET LOCAL standard_conforming_strings = on;");
emit(sourceSql, `SELECT pg_advisory_xact_lock(hashtext('hydrogen-rdl-source-records'), hashtext(${sqlText(packageKey)}));`);
emit(sourceSql);
emit(sourceSql, "DO $hydrogen_v03_package$");
emit(sourceSql, "DECLARE");
emit(sourceSql, "  v_package_id bigint;");
emit(sourceSql, "  v_content_sha256 text;");
emit(sourceSql, "BEGIN");
emit(sourceSql, "  SELECT p.package_id, p.content_sha256 INTO v_package_id, v_content_sha256");
emit(sourceSql, "  FROM rdl.rdl_package p");
emit(sourceSql, "  JOIN rdl.rdl_release r ON r.release_id = p.release_id");
emit(sourceSql, "  JOIN rdl.rdl_source s ON s.source_id = r.source_id");
emit(sourceSql, `  WHERE p.package_key = ${sqlText(packageKey)}`);
emit(sourceSql, "    AND s.source_key = 'hydrogen'");
emit(sourceSql, `    AND r.release_key = ${sqlText(profile.releaseKey)};`);
emit(sourceSql, "  IF v_package_id IS NULL THEN");
emit(sourceSql, "    RAISE EXCEPTION 'Validated Hydrogen v0.3 package was not found';");
emit(sourceSql, "  END IF;");
emit(sourceSql, `  IF v_content_sha256 IS DISTINCT FROM ${sqlText(workbookSha256)} THEN`);
emit(sourceSql, "    RAISE EXCEPTION 'Hydrogen package fingerprint does not match the source workbook';");
emit(sourceSql, "  END IF;");
emit(sourceSql, "END;");
emit(sourceSql, "$hydrogen_v03_package$;");
emit(sourceSql);

emit(sourceSql, "CREATE TEMP TABLE hydrogen_v03_source_sheet_stage (");
emit(sourceSql, "  sheet_name text PRIMARY KEY,");
emit(sourceSql, "  sheet_order integer NOT NULL UNIQUE,");
emit(sourceSql, "  first_data_row_number integer NOT NULL,");
emit(sourceSql, "  headers jsonb NOT NULL,");
emit(sourceSql, "  source_row_count integer NOT NULL,");
emit(sourceSql, "  sheet_sha256 text NOT NULL");
emit(sourceSql, ") ON COMMIT DROP;");
emit(sourceSql);
emit(sourceSql, "CREATE TEMP TABLE hydrogen_v03_source_record_stage (");
emit(sourceSql, "  sheet_name text NOT NULL,");
emit(sourceSql, "  source_row_number integer NOT NULL,");
emit(sourceSql, "  record_order integer NOT NULL,");
emit(sourceSql, "  raw_row jsonb NOT NULL,");
emit(sourceSql, "  row_sha256 text NOT NULL,");
emit(sourceSql, "  PRIMARY KEY (sheet_name, record_order),");
emit(sourceSql, "  UNIQUE (sheet_name, source_row_number)");
emit(sourceSql, ") ON COMMIT DROP;");
emit(sourceSql);

emit(sourceSql, "INSERT INTO hydrogen_v03_source_sheet_stage (");
emit(sourceSql, "  sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256");
emit(sourceSql, ") VALUES");
emit(
  sourceSql,
  sheetStages
    .map(
      (sheet) =>
        `  (${sqlText(sheet.sheetName)}, ${sheet.sheetOrder}, ${sheet.firstDataRowNumber}, ${jsonSql(sheet.headers)}, ${sheet.sourceRowCount}, ${sqlText(sheet.sheetSha256)})`,
    )
    .join(",\n") + ";",
);
emit(sourceSql);

for (let offset = 0; offset < recordStages.length; offset += RECORD_BATCH_SIZE) {
  const batch = recordStages.slice(offset, offset + RECORD_BATCH_SIZE);
  emit(sourceSql, "INSERT INTO hydrogen_v03_source_record_stage (");
  emit(sourceSql, "  sheet_name, source_row_number, record_order, raw_row, row_sha256");
  emit(sourceSql, ") VALUES");
  emit(
    sourceSql,
    batch
      .map(
        (record) =>
          `  (${sqlText(record.sheetName)}, ${record.sourceRowNumber}, ${record.recordOrder}, ${jsonSql(record.rawRow)}, ${sqlText(record.rowSha256)})`,
      )
      .join(",\n") + ";",
  );
  emit(sourceSql);
}

emit(sourceSql, "INSERT INTO rdl.rdl_source_sheet (");
emit(sourceSql, "  package_id, sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256");
emit(sourceSql, ")");
emit(sourceSql, "SELECT p.package_id, stage.sheet_name, stage.sheet_order,");
emit(sourceSql, "       stage.first_data_row_number, stage.headers, stage.source_row_count, stage.sheet_sha256");
emit(sourceSql, "FROM hydrogen_v03_source_sheet_stage stage");
emit(sourceSql, `JOIN rdl.rdl_package p ON p.package_key = ${sqlText(packageKey)}`);
emit(sourceSql, "WHERE NOT EXISTS (");
emit(sourceSql, "  SELECT 1 FROM rdl.rdl_source_sheet existing");
emit(sourceSql, "  WHERE existing.package_id = p.package_id AND existing.sheet_name = stage.sheet_name");
emit(sourceSql, ")");
emit(sourceSql, "ORDER BY stage.sheet_order");
emit(sourceSql, "ON CONFLICT (package_id, sheet_name) DO NOTHING;");
emit(sourceSql);

emit(sourceSql, "INSERT INTO rdl.rdl_source_record (");
emit(sourceSql, "  package_id, source_sheet_id, source_row_number, record_order, raw_row, row_sha256");
emit(sourceSql, ")");
emit(sourceSql, "SELECT p.package_id, sheet.source_sheet_id, stage.source_row_number,");
emit(sourceSql, "       stage.record_order, stage.raw_row, stage.row_sha256");
emit(sourceSql, "FROM hydrogen_v03_source_record_stage stage");
emit(sourceSql, `JOIN rdl.rdl_package p ON p.package_key = ${sqlText(packageKey)}`);
emit(sourceSql, "JOIN rdl.rdl_source_sheet sheet");
emit(sourceSql, "  ON sheet.package_id = p.package_id AND sheet.sheet_name = stage.sheet_name");
emit(sourceSql, "WHERE NOT EXISTS (");
emit(sourceSql, "  SELECT 1 FROM rdl.rdl_source_record existing");
emit(sourceSql, "  WHERE existing.source_sheet_id = sheet.source_sheet_id");
emit(sourceSql, "    AND existing.record_order = stage.record_order");
emit(sourceSql, ")");
emit(sourceSql, "ORDER BY sheet.sheet_order, stage.record_order");
emit(sourceSql, "ON CONFLICT (source_sheet_id, record_order) DO NOTHING;");
emit(sourceSql);

emit(sourceSql, "DO $hydrogen_v03_source_integrity$");
emit(sourceSql, "DECLARE");
emit(sourceSql, "  v_package_id bigint;");
emit(sourceSql, "  v_expected_sheet_count integer;");
emit(sourceSql, "  v_actual_sheet_count integer;");
emit(sourceSql, "  v_expected_record_count integer;");
emit(sourceSql, "  v_actual_record_count integer;");
emit(sourceSql, "BEGIN");
emit(sourceSql, "  SELECT p.package_id INTO v_package_id");
emit(sourceSql, "  FROM rdl.rdl_package p");
emit(sourceSql, "  JOIN rdl.rdl_release r ON r.release_id = p.release_id");
emit(sourceSql, "  JOIN rdl.rdl_source s ON s.source_id = r.source_id");
emit(sourceSql, `  WHERE p.package_key = ${sqlText(packageKey)}`);
emit(sourceSql, "    AND s.source_key = 'hydrogen'");
emit(sourceSql, `    AND r.release_key = ${sqlText(profile.releaseKey)};`);
emit(sourceSql, "  SELECT count(*)::integer INTO v_expected_sheet_count FROM hydrogen_v03_source_sheet_stage;");
emit(sourceSql, "  SELECT count(*)::integer INTO v_actual_sheet_count FROM rdl.rdl_source_sheet WHERE package_id = v_package_id;");
emit(sourceSql, "  IF v_actual_sheet_count <> v_expected_sheet_count THEN");
emit(sourceSql, "    RAISE EXCEPTION 'Hydrogen sheet count mismatch: expected %, actual %', v_expected_sheet_count, v_actual_sheet_count;");
emit(sourceSql, "  END IF;");
emit(sourceSql, "  SELECT count(*)::integer INTO v_expected_record_count FROM hydrogen_v03_source_record_stage;");
emit(sourceSql, "  SELECT count(*)::integer INTO v_actual_record_count FROM rdl.rdl_source_record WHERE package_id = v_package_id;");
emit(sourceSql, "  IF v_actual_record_count <> v_expected_record_count THEN");
emit(sourceSql, "    RAISE EXCEPTION 'Hydrogen source-record count mismatch: expected %, actual %', v_expected_record_count, v_actual_record_count;");
emit(sourceSql, "  END IF;");
emit(sourceSql, "  IF EXISTS (");
emit(sourceSql, "    SELECT 1 FROM (");
emit(sourceSql, "      (SELECT sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256");
emit(sourceSql, "       FROM rdl.rdl_source_sheet WHERE package_id = v_package_id");
emit(sourceSql, "       EXCEPT SELECT sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256");
emit(sourceSql, "       FROM hydrogen_v03_source_sheet_stage)");
emit(sourceSql, "      UNION ALL");
emit(sourceSql, "      (SELECT sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256");
emit(sourceSql, "       FROM hydrogen_v03_source_sheet_stage");
emit(sourceSql, "       EXCEPT SELECT sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256");
emit(sourceSql, "       FROM rdl.rdl_source_sheet WHERE package_id = v_package_id)");
emit(sourceSql, "    ) sheet_differences");
emit(sourceSql, "  ) THEN");
emit(sourceSql, "    RAISE EXCEPTION 'Hydrogen source-sheet metadata does not match the workbook';");
emit(sourceSql, "  END IF;");
emit(sourceSql, "  IF EXISTS (");
emit(sourceSql, "    SELECT 1 FROM (");
emit(sourceSql, "      (SELECT sheet.sheet_name, record.source_row_number, record.record_order, record.raw_row, record.row_sha256");
emit(sourceSql, "       FROM rdl.rdl_source_record record");
emit(sourceSql, "       JOIN rdl.rdl_source_sheet sheet ON sheet.source_sheet_id = record.source_sheet_id AND sheet.package_id = record.package_id");
emit(sourceSql, "       WHERE record.package_id = v_package_id");
emit(sourceSql, "       EXCEPT SELECT sheet_name, source_row_number, record_order, raw_row, row_sha256");
emit(sourceSql, "       FROM hydrogen_v03_source_record_stage)");
emit(sourceSql, "      UNION ALL");
emit(sourceSql, "      (SELECT sheet_name, source_row_number, record_order, raw_row, row_sha256");
emit(sourceSql, "       FROM hydrogen_v03_source_record_stage");
emit(sourceSql, "       EXCEPT SELECT sheet.sheet_name, record.source_row_number, record.record_order, record.raw_row, record.row_sha256");
emit(sourceSql, "       FROM rdl.rdl_source_record record");
emit(sourceSql, "       JOIN rdl.rdl_source_sheet sheet ON sheet.source_sheet_id = record.source_sheet_id AND sheet.package_id = record.package_id");
emit(sourceSql, "       WHERE record.package_id = v_package_id)");
emit(sourceSql, "    ) record_differences");
emit(sourceSql, "  ) THEN");
emit(sourceSql, "    RAISE EXCEPTION 'Hydrogen source records do not match the workbook';");
emit(sourceSql, "  END IF;");
emit(sourceSql, "END;");
emit(sourceSql, "$hydrogen_v03_source_integrity$;");

process.stdout.write(`${normalizedWithoutCommit}\n${sourceSql.join("\n")}\nCOMMIT;\n`);
