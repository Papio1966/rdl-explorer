import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readWorkbook, worksheetHeaders, worksheetRows } from "./rdl-ingestion/workbookReader.ts";
import type { RdlWorkbookMappingProfile } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusCfihosFormatProfile.ts";
import { CCUS_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusV2CfihosFormatProfile.ts";
import { WATER_DESALINATION_PROFILE } from "./rdl-ingestion/WaterDesalinationProfile.ts";
import { WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/WaterDesalinationV2CfihosFormatProfile.ts";

type Row = Record<string, unknown>;
const profiles: RdlWorkbookMappingProfile[] = [
  CCUS_CFIHOS_FORMAT_PROFILE,
  CCUS_V2_CFIHOS_FORMAT_PROFILE,
  WATER_DESALINATION_PROFILE,
  WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE,
];

const sql = (v: unknown) => `'${String(v ?? "").replaceAll("'", "''")}'`;
const jsonSql = (v: unknown) => `${sql(JSON.stringify(v))}::jsonb`;
const text = (v: unknown) => String(v ?? "").trim();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

const out: string[] = ["\\set ON_ERROR_STOP on", "BEGIN;"];
const packageKeys: string[] = [];

for (const profile of profiles) {
  const bytes = readFileSync(resolve(profile.workbookPath));
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const packageKey = `${profile.sourceKey}-${profile.versionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${sourceHash.slice(0, 12)}`;
  packageKeys.push(packageKey);

  const workbook = await readWorkbook(bytes);
  const sheetName = workbook.sheetNames.find((name) => name.trim().toLowerCase() === "data dictionary");
  if (!sheetName) throw new Error(`${profile.profileKey}: workbook has no data dictionary sheet`);

  const worksheet = workbook.sheets[sheetName];
  const headers = worksheetHeaders(worksheet);
  const rows = worksheetRows<Row>(worksheet);
  if (!headers.length || !rows.length) throw new Error(`${profile.profileKey}: data dictionary sheet is empty`);

  const sheetOrder = workbook.sheetNames.indexOf(sheetName);
  const sheetHash = hash({ headers, rows });

  out.push(
    `INSERT INTO rdl.rdl_source_sheet (package_id, sheet_name, sheet_order, first_data_row_number, headers, source_row_count, sheet_sha256)
     SELECT package_id, ${sql(sheetName)}, ${sheetOrder}, 2, ${jsonSql(headers)}, ${rows.length}, ${sql(sheetHash)}
     FROM rdl.rdl_package WHERE package_key = ${sql(packageKey)}
     ON CONFLICT (package_id, sheet_name) DO NOTHING;`,
  );

  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    const values = batch.map((row, index) =>
      `(${offset + index + 2}, ${offset + index}, ${jsonSql(row)}, ${sql(hash(row))})`,
    ).join(",\n");
    out.push(
      `INSERT INTO rdl.rdl_source_record (package_id, source_sheet_id, source_row_number, record_order, raw_row, row_sha256)
       SELECT p.package_id, sh.source_sheet_id, v.source_row_number, v.record_order, v.raw_row, v.row_sha256
       FROM rdl.rdl_package p
       JOIN rdl.rdl_source_sheet sh ON sh.package_id = p.package_id AND sh.sheet_name = ${sql(sheetName)}
       CROSS JOIN (VALUES ${values}) AS v(source_row_number, record_order, raw_row, row_sha256)
       WHERE p.package_key = ${sql(packageKey)}
       ON CONFLICT (source_sheet_id, record_order) DO NOTHING;`,
    );
  }

  out.push(
    `DO $verify_source$
     DECLARE actual_count integer;
     BEGIN
       SELECT COUNT(*) INTO actual_count
       FROM rdl.rdl_source_record sr
       JOIN rdl.rdl_source_sheet sh ON sh.source_sheet_id = sr.source_sheet_id AND sh.package_id = sr.package_id
       JOIN rdl.rdl_package p ON p.package_id = sr.package_id
       WHERE p.package_key = ${sql(packageKey)} AND sh.sheet_name = ${sql(sheetName)};
       IF actual_count <> ${rows.length} THEN
         RAISE EXCEPTION 'Source-row count mismatch for %: expected %, found %', ${sql(packageKey)}, ${rows.length}, actual_count;
       END IF;
     END
     $verify_source$;`,
  );

  out.push(
    `INSERT INTO rdl.schema_definition (
       package_id, source_record_id, native_identifier, concept_kind, section,
       entity_name, property_name, entity_attribute_name, definition, note_comment,
       example, requirement_status, format_specification, data_type_hint,
       presence_constraint, data_source, former_section, relationship_verb
     )
     SELECT
       sr.package_id,
       sr.source_record_id,
       COALESCE(NULLIF(BTRIM(sr.raw_row->>'CFIHOS unique code'), ''), 'source-record-' || sr.source_record_id::text),
       CASE
         WHEN LOWER(BTRIM(COALESCE(sr.raw_row->>'object', ''))) IN ('entity','attribute','relationship','constraint')
           THEN LOWER(BTRIM(sr.raw_row->>'object'))
         ELSE 'unknown'
       END,
       NULLIF(BTRIM(sr.raw_row->>'section'), ''),
       NULLIF(BTRIM(sr.raw_row->>'entity name'), ''),
       NULLIF(BTRIM(sr.raw_row->>'property name'), ''),
       NULLIF(BTRIM(sr.raw_row->>'entity attribute name'), ''),
       NULLIF(BTRIM(sr.raw_row->>'definition'), ''),
       NULLIF(BTRIM(sr.raw_row->>'note / comment'), ''),
       NULLIF(BTRIM(sr.raw_row->>'example'), ''),
       NULLIF(BTRIM(sr.raw_row->>'identifier / mandatory / optional'), ''),
       NULLIF(BTRIM(sr.raw_row->>'format'), ''),
       NULLIF(LOWER(BTRIM(SPLIT_PART(COALESCE(sr.raw_row->>'format',''), ',', 1))), ''),
       NULLIF(BTRIM(sr.raw_row->>'constraint must be present in'), ''),
       NULLIF(BTRIM(sr.raw_row->>'data source'), ''),
       NULLIF(BTRIM(sr.raw_row->>'former section (if different from last published version)'), ''),
       NULLIF(BTRIM(sr.raw_row->>'relationship verb'), '')
     FROM rdl.rdl_source_record sr
     JOIN rdl.rdl_source_sheet sh ON sh.source_sheet_id = sr.source_sheet_id AND sh.package_id = sr.package_id
     JOIN rdl.rdl_package p ON p.package_id = sr.package_id
     WHERE p.package_key = ${sql(packageKey)} AND sh.sheet_name = ${sql(sheetName)}
     ON CONFLICT (package_id, source_record_id) DO NOTHING;`,
  );

  out.push(
    `INSERT INTO rdl.schema_constraint (schema_definition_id, constraint_kind, constraint_value, normalized_value)
     SELECT sd.schema_definition_id, v.constraint_kind, v.constraint_value, v.normalized_value
     FROM rdl.schema_definition sd
     JOIN rdl.rdl_package p ON p.package_id = sd.package_id
     CROSS JOIN LATERAL (
       VALUES
         ('requirement_status'::text, sd.requirement_status,
           CASE WHEN sd.requirement_status IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('normalized', LOWER(sd.requirement_status)) END),
         ('format'::text, sd.format_specification,
           CASE WHEN sd.format_specification IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('dataTypeHint', sd.data_type_hint) END),
         ('presence'::text, sd.presence_constraint, '{}'::jsonb),
         ('relationship'::text, sd.relationship_verb, '{}'::jsonb)
     ) AS v(constraint_kind, constraint_value, normalized_value)
     WHERE p.package_key = ${sql(packageKey)} AND v.constraint_value IS NOT NULL
     ON CONFLICT (schema_definition_id, constraint_kind) DO NOTHING;`,
  );

  out.push(
    `DO $verify_dictionary$
     DECLARE actual_count integer;
     BEGIN
       SELECT COUNT(*) INTO actual_count
       FROM rdl.schema_definition sd
       JOIN rdl.rdl_package p ON p.package_id = sd.package_id
       WHERE p.package_key = ${sql(packageKey)};
       IF actual_count <> ${rows.length} THEN
         RAISE EXCEPTION 'Schema Dictionary count mismatch for %: expected %, found %', ${sql(packageKey)}, ${rows.length}, actual_count;
       END IF;
     END
     $verify_dictionary$;`,
  );
}

out.push(
  `COMMIT;
   SELECT p.package_key, COUNT(sd.schema_definition_id) AS schema_dictionary_rows
   FROM rdl.rdl_package p
   LEFT JOIN rdl.schema_definition sd ON sd.package_id = p.package_id
   WHERE p.package_key IN (${packageKeys.map(sql).join(", ")})
   GROUP BY p.package_key
   ORDER BY p.package_key;`,
);
process.stdout.write(out.join("\n") + "\n");
