import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const databaseUrl = process.env.RDL_DATABASE_URL ?? "postgresql://localhost:5432/rdl_explorer";
const packageId = 5;

function psql(sql: string): string {
  return execFileSync(
    "psql",
    [databaseUrl, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-P", "pager=off", "-c", sql],
    { encoding: "utf8" },
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? "";
}

function assertScalar(sql: string, expected: string, label: string): void {
  const actual = psql(sql);
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS RDL-043 ${label}: ${actual}`);
}

function fileSha256(path: string): string {
  assert.ok(existsSync(path), `Required file does not exist: ${path}`);
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertFileHash(path: string, expected: string, label: string): void {
  const actual = fileSha256(path);
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS RDL-043 ${label}: ${actual}`);
}

function assertNumeric(sql: string, predicate: (value: number) => boolean, label: string): number {
  const actual = Number(psql(sql));
  assert.ok(Number.isFinite(actual), `${label}: ${actual} is not numeric`);
  assert.ok(predicate(actual), `${label}: unexpected value ${actual}`);
  console.log(`PASS RDL-043 ${label}: ${actual}`);
  return actual;
}

console.log("===== RDL-043 PROJECTION COMPLETENESS DEDICATED VALIDATION =====");

assertScalar(
  `SELECT p.package_id::text || '|' || p.package_key || '|' || p.package_status || '|' || s.source_key || '|' || r.release_key
   FROM rdl.rdl_package p
   JOIN rdl.rdl_release r ON r.release_id=p.release_id
   JOIN rdl.rdl_source s ON s.source_id=r.source_id
   WHERE p.package_id=${packageId};`,
  "5|cfihos-2.0-b5a2a09e9e0e|validated|cfihos|cfihos-2.0",
  "validated CFIHOS package identity",
);

assertScalar(
  `SELECT count(*)::text || '|' || COALESCE(sum(source_row_count),0)::text || '|' ||
          (SELECT count(*) FROM rdl.rdl_source_record WHERE package_id=${packageId})::text || '|' ||
          bool_and(source_row_count=stored_row_count)::text
   FROM rdl.rdl_source_sheet_summary
   WHERE package_id=${packageId};`,
  "23|42514|42514|true",
  "lossless source layer preserved",
);

assertScalar(
  `SELECT count(*)::text || '|' || max(source_record_count)::text || '|' ||
          max(normalized_entity_count)::text || '|' || max(normalized_relationship_count)::text || '|' ||
          max(projection_link_count)::text || '|' || max(projected_source_record_count)::text || '|' ||
          max(disposition_count)::text || '|' || max(summary->>'semanticCompleteness')
   FROM rdl.rdl_projection_accounting_batch
   WHERE package_id=${packageId}
     AND adapter_key='cfihos-projection-accounting-v1'
     AND adapter_version='1.0.0';`,
  "1|42514|13609|39461|55866|25532|16982|not_assessed",
  "immutable RDL-041.2 v1 accounting batch remains exact",
);

assertScalar(
  `SELECT count(*)::text || '|' || max(source_record_count)::text || '|' ||
          max(summary->>'semanticCompleteness') || '|' || count(*) FILTER (WHERE normalized_projection_sha256 ~ '^[0-9a-f]{64}$')::text
   FROM rdl.rdl_projection_accounting_batch
   WHERE package_id=${packageId}
     AND adapter_key='cfihos-projection-accounting-v2'
     AND adapter_version='2.0.0';`,
  "1|42514|assessed_with_governed_exceptions|1",
  "RDL-043 v2 accounting batch exists exactly once",
);

const v2BatchId = psql(
  `SELECT accounting_batch_id
   FROM rdl.rdl_projection_accounting_batch
   WHERE package_id=${packageId}
     AND adapter_key='cfihos-projection-accounting-v2'
     AND adapter_version='2.0.0';`,
);
assert.ok(v2BatchId, "RDL-043 v2 batch id must be present");
console.log(`RDL043AccountingBatchId=${v2BatchId}`);

assertNumeric(
  `SELECT normalized_entity_count FROM rdl.rdl_projection_accounting_batch WHERE accounting_batch_id=${v2BatchId};`,
  (value) => value > 13609,
  "normalized entity count increased intentionally",
);

assertNumeric(
  `SELECT normalized_relationship_count FROM rdl.rdl_projection_accounting_batch WHERE accounting_batch_id=${v2BatchId};`,
  (value) => value > 39461,
  "normalized relationship count increased intentionally",
);

assertNumeric(
  `SELECT projected_source_record_count FROM rdl.rdl_projection_accounting_batch WHERE accounting_batch_id=${v2BatchId};`,
  (value) => value > 25532,
  "projected source-row count increased intentionally",
);

assertNumeric(
  `SELECT disposition_count FROM rdl.rdl_projection_accounting_batch WHERE accounting_batch_id=${v2BatchId};`,
  (value) => value < 16982,
  "zero-output disposition count reduced intentionally",
);

assertScalar(
  `SELECT count(*)::text || '|' || count(*) FILTER (WHERE projection_status='unaccounted')::text || '|' ||
          count(*) FILTER (WHERE semantic_completeness_status='not_assessed')::text
   FROM rdl.rdl_source_projection_accounting
   WHERE accounting_batch_id=${v2BatchId};`,
  "42514|0|0",
  "current v2 source accounting is total and semantically assessed",
);

assertScalar(
  `SELECT count(*)::text || '|' ||
          count(*) FILTER (WHERE projection_kind='entity')::text || '|' ||
          count(*) FILTER (WHERE projection_kind='relationship')::text || '|' ||
          count(*) FILTER (WHERE lineage_role='primary')::text || '|' ||
          count(*) FILTER (WHERE lineage_role='contributing')::text
   FROM rdl.rdl_source_projection_link
   WHERE accounting_batch_id=${v2BatchId};`,
  psql(
    `SELECT projection_link_count::text || '|' ||
            (SELECT count(*) FROM rdl.rdl_source_projection_link WHERE accounting_batch_id=${v2BatchId} AND projection_kind='entity')::text || '|' ||
            (SELECT count(*) FROM rdl.rdl_source_projection_link WHERE accounting_batch_id=${v2BatchId} AND projection_kind='relationship')::text || '|' ||
            (SELECT count(*) FROM rdl.rdl_source_projection_link WHERE accounting_batch_id=${v2BatchId} AND lineage_role='primary')::text || '|' ||
            (SELECT count(*) FROM rdl.rdl_source_projection_link WHERE accounting_batch_id=${v2BatchId} AND lineage_role='contributing')::text
     FROM rdl.rdl_projection_accounting_batch WHERE accounting_batch_id=${v2BatchId};`,
  ),
  "v2 lineage counts match batch summary",
);

assertScalar(
  `SELECT count(*)::text
   FROM (
     SELECT e.entity_id
     FROM rdl.rdl_entity e
     WHERE e.package_id=${packageId}
       AND NOT EXISTS (
         SELECT 1 FROM rdl.rdl_source_projection_link l
         WHERE l.accounting_batch_id=${v2BatchId}
           AND l.projection_kind='entity'
           AND l.entity_id=e.entity_id
           AND l.lineage_role='primary'
       )
     UNION ALL
     SELECT r.relationship_id
     FROM rdl.rdl_relationship r
     WHERE r.package_id=${packageId}
       AND NOT EXISTS (
         SELECT 1 FROM rdl.rdl_source_projection_link l
         WHERE l.accounting_batch_id=${v2BatchId}
           AND l.projection_kind='relationship'
           AND l.relationship_id=r.relationship_id
           AND l.lineage_role='primary'
       )
   ) missing;`,
  "0",
  "every normalized object has one v2 primary lineage link",
);

assertScalar(
  `WITH src AS (
      SELECT sr.source_record_id, sr.raw_row
      FROM rdl.rdl_source_record sr
      JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id
      WHERE sr.package_id=${packageId} AND ss.sheet_name='CFIHOS object equivalent mappin'
    ), base AS (
      SELECT
        source_record_id,
        nullif(btrim(raw_row->>'CFIHOS unique code'), '') AS cfihos_id,
        nullif(btrim(raw_row->>'coding source code'), '') AS coding_source_code,
        nullif(btrim(raw_row->>'CFIHOS code equivalent value'), '') AS external_value
      FROM src
    ), unresolved AS (
      SELECT * FROM base b
      WHERE NOT EXISTS (SELECT 1 FROM rdl.rdl_entity e WHERE e.package_id=${packageId} AND e.native_identifier=b.cfihos_id)
    )
    SELECT
      (SELECT count(*) FROM base)::text || '|' ||
      (SELECT count(DISTINCT coding_source_code) FROM base)::text || '|' ||
      (SELECT count(*) FROM unresolved)::text || '|' ||
      (SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${packageId} AND entity_type_code='external_identifier_system')::text || '|' ||
      (SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${packageId} AND entity_type_code='projection_exception' AND normalized_metadata->>'exceptionCategory'='external_equivalence_unresolved')::text;`,
  "3091|4|37|4|37",
  "external equivalence normalized with governed unresolved rows",
);

assertScalar(
  `WITH src AS (
      SELECT sr.raw_row
      FROM rdl.rdl_source_record sr
      JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id
      WHERE sr.package_id=${packageId} AND ss.sheet_name='property groupings'
    ), expected AS (
      SELECT
        count(*) AS source_rows,
        count(DISTINCT nullif(btrim(raw_row->>'property group CFIHOS unique code'), '')) AS property_groups,
        count(DISTINCT nullif(btrim(raw_row->>'property grouping or decomposition purpose CFIHOS unique code'), '')) AS purposes
      FROM src
    )
    SELECT source_rows::text || '|' || property_groups::text || '|' || purposes::text || '|' ||
           (SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${packageId} AND entity_type_code='property_group')::text || '|' ||
           (SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${packageId} AND entity_type_code='grouping_purpose')::text
    FROM expected;`,
  "1140|251|1|251|1",
  "property groups and grouping purpose normalized",
);

assertScalar(
  `WITH src AS (
      SELECT DISTINCT
        nullif(btrim(sr.raw_row->>'property group CFIHOS unique code'), '') AS group_id,
        nullif(btrim(sr.raw_row->>'property CFIHOS unique code'), '') AS property_id
      FROM rdl.rdl_source_record sr
      JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id
      WHERE sr.package_id=${packageId} AND ss.sheet_name='property groupings'
    ), expected AS (
      SELECT count(*) AS expected_count
      FROM src s
      JOIN rdl.rdl_entity pg ON pg.package_id=${packageId} AND pg.entity_type_code='property_group' AND pg.native_identifier=s.group_id
      JOIN rdl.rdl_entity p ON p.package_id=${packageId} AND p.entity_type_code='property' AND p.native_identifier=s.property_id
    ), actual AS (
      SELECT count(*) AS actual_count
      FROM rdl.rdl_relationship r
      WHERE r.package_id=${packageId} AND r.relationship_type_code='property_group_property'
    )
    SELECT expected_count::text || '|' || actual_count::text FROM expected, actual;`,
  psql(
    `WITH src AS (
       SELECT DISTINCT
         nullif(btrim(sr.raw_row->>'property group CFIHOS unique code'), '') AS group_id,
         nullif(btrim(sr.raw_row->>'property CFIHOS unique code'), '') AS property_id
       FROM rdl.rdl_source_record sr
       JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id
       WHERE sr.package_id=${packageId} AND ss.sheet_name='property groupings'
     ), expected AS (
       SELECT count(*) AS expected_count
       FROM src s
       JOIN rdl.rdl_entity pg ON pg.package_id=${packageId} AND pg.entity_type_code='property_group' AND pg.native_identifier=s.group_id
       JOIN rdl.rdl_entity p ON p.package_id=${packageId} AND p.entity_type_code='property' AND p.native_identifier=s.property_id
     ) SELECT expected_count::text || '|' || expected_count::text FROM expected;`,
  ),
  "property-group-property relationships match resolvable source assignments",
);

const jip33FieldRepair = psql(
  `WITH rows AS (
      SELECT sr.raw_row
      FROM rdl.rdl_source_record sr
      JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id
      WHERE sr.package_id=${packageId} AND ss.sheet_name='Jip33 info required spec'
    ), src AS (
      SELECT
        nullif(btrim(raw_row->>'Source standard document and data requirement CFIHOS unique code'), '') AS requirement_id,
        max(nullif(btrim(raw_row->>'source standard document and data requirement comment'), '')) AS requirement_comment,
        max(nullif(btrim(raw_row->>'default required translation indicator'), '')) AS required_translation,
        max(nullif(btrim(raw_row->>'default submit at proposal indicator'), '')) AS submit_at_proposal,
        max(nullif(btrim(raw_row->>'default submit for review indicator'), '')) AS submit_for_review,
        max(nullif(btrim(raw_row->>'default submit at delivery indicator'), '')) AS submit_at_delivery,
        max(nullif(btrim(raw_row->>'default issue for review reference date'), '')) AS review_reference_date,
        max(nullif(btrim(raw_row->>'default issue for approval reference date'), '')) AS approval_reference_date,
        max(nullif(btrim(raw_row->>'default for information reference date'), '')) AS information_reference_date
      FROM rows
      GROUP BY nullif(btrim(raw_row->>'Source standard document and data requirement CFIHOS unique code'), '')
    ), comparisons AS (
      SELECT s.requirement_id, 'comment' AS key, s.requirement_comment AS source_value, e.normalized_metadata->>'comment' AS target_value FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'requiredTranslation', s.required_translation, e.normalized_metadata->>'requiredTranslation' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'submitAtProposal', s.submit_at_proposal, e.normalized_metadata->>'submitAtProposal' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'submitForReview', s.submit_for_review, e.normalized_metadata->>'submitForReview' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'submitAtDelivery', s.submit_at_delivery, e.normalized_metadata->>'submitAtDelivery' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'reviewReferenceDate', s.review_reference_date, e.normalized_metadata->>'reviewReferenceDate' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'approvalReferenceDate', s.approval_reference_date, e.normalized_metadata->>'approvalReferenceDate' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
      UNION ALL SELECT s.requirement_id, 'informationReferenceDate', s.information_reference_date, e.normalized_metadata->>'informationReferenceDate' FROM src s JOIN rdl.rdl_entity e ON e.package_id=${packageId} AND e.entity_type_code='information_requirement' AND e.native_identifier=s.requirement_id
    )
    SELECT count(*) FILTER (WHERE source_value IS NOT NULL)::text || '|' ||
           count(*) FILTER (WHERE source_value IS NOT NULL AND source_value IS DISTINCT FROM target_value)::text
    FROM comparisons;`,
);
const [jip33PopulatedFields, jip33Mismatches] = jip33FieldRepair.split("|").map(Number);
assert.ok(jip33PopulatedFields > 0, "JIP33 repair must assess populated source fields");
assert.equal(jip33Mismatches, 0, `JIP33 semantic repair mismatch count: ${jip33FieldRepair}`);
console.log(`PASS RDL-043 JIP33 eight-field semantic repair has zero mismatches: ${jip33FieldRepair}`);

assertScalar(
  `WITH rows AS (
      SELECT sr.source_record_id, sr.raw_row
      FROM rdl.rdl_source_record sr
      JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id
      WHERE sr.package_id=${packageId} AND ss.sheet_name='document required per class'
    ), unresolved AS (
      SELECT * FROM rows r
      WHERE nullif(btrim(r.raw_row->>'asset type reference'), '')='Equipment'
        AND EXISTS (SELECT 1 FROM rdl.rdl_entity e WHERE e.package_id=${packageId} AND e.entity_type_code='tag_class' AND e.native_identifier=nullif(btrim(r.raw_row->>'tag or equipment class CFIHOS unique code'), ''))
        AND NOT EXISTS (SELECT 1 FROM rdl.rdl_entity e WHERE e.package_id=${packageId} AND e.entity_type_code='equipment_class' AND e.native_identifier=nullif(btrim(r.raw_row->>'tag or equipment class CFIHOS unique code'), ''))
    )
    SELECT (SELECT count(*) FROM unresolved)::text || '|' ||
           (SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${packageId} AND entity_type_code='projection_exception' AND normalized_metadata->>'exceptionCategory'='asset_type_vs_tag_class_mismatch')::text;`,
  "10|10",
  "class-document asset-type conflicts are governed exceptions",
);

assertScalar(
  `SELECT
     count(*) FILTER (WHERE semantic_decision='NORMALIZE')::text || '|' ||
     count(*) FILTER (WHERE semantic_decision='CONTRIBUTING_ONLY')::text || '|' ||
     count(*) FILTER (WHERE semantic_decision='SOURCE_ONLY')::text || '|' ||
     count(*) FILTER (WHERE semantic_decision='NOT_APPLICABLE')::text || '|' ||
     count(*) FILTER (WHERE semantic_decision='UNRESOLVED')::text || '|' ||
     count(*) FILTER (WHERE semantic_decision='DEFER_WITH_REASON')::text
   FROM rdl.rdl_source_semantic_assessment
   WHERE accounting_batch_id=${v2BatchId};`,
  "29726|8529|3361|48|47|803",
  "semantic assessment decision matrix",
);

assertFileHash("api/rdl-runtime/cfihos-workbook.ts", "8aff48cf72a39a8057965356aeae97e8f7b0e6c28ed7f309553c64a7586e5681", "RDL-042 API runtime authority unchanged");
assertFileHash("server/rdl/CfihosSourceWorkbookService.ts", "113bcaa91afedb55f06843d66352a4bc5cb08e0fb3246f135659d2e411678793", "RDL-042 source workbook service unchanged");
assertFileHash("src/cfihos/workbook.ts", "0c082efcd948d52ada4fd1290c9010a0273406df4e84d0044cda045f69348738", "RDL-042 shared workbook loader unchanged");
assertFileHash("public/cfihos-workbook.json", "a5ce1bab0f2647b3ef078d03a117453ac2e84cef7d313544bbe37b1d3af03ba2", "CFIHOS workbook frozen oracle unchanged");
assertFileHash("public/rdl-search-index.json", "646c8e6a2ce2550832f971c943a69fc467b3ac55d8fc563748364f82d757dfcb", "RDL search frozen oracle unchanged");
assertFileHash("public/rdl-relationship-index.json", "2159133bb2c02151cecbf4cf0fbba890463d4926feb7e9568379fb85e24d2927", "RDL relationship frozen oracle unchanged");

console.log("PASS RDL-043 normalized projection completeness dedicated contract");
