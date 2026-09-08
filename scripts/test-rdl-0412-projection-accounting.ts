import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SNAPSHOT_PATH = new URL(
  "../public/cfihos-workbook.json",
  import.meta.url,
);

const EXPECTED_SOURCE_RECORDS = 42_514;
const EXPECTED_ENTITIES = 13_609;
const EXPECTED_RELATIONSHIPS = 39_461;
const EXPECTED_ENTITY_LINKS = 16_314;
const EXPECTED_RELATIONSHIP_LINKS = 39_552;
const EXPECTED_TOTAL_LINKS = 55_866;
const EXPECTED_PROJECTED_SOURCE_RECORDS = 25_532;
const EXPECTED_DISPOSITIONS = 16_982;
const EXPECTED_PRIMARY_LINKS = 53_070;
const EXPECTED_CONTRIBUTING_LINKS = 2_796;

function fail(message: string): never {
  throw new Error(`RDL-041.2 projection-accounting test failed: ${message}`);
}

const databaseUrl = process.env.RDL_DATABASE_URL?.trim();
if (!databaseUrl) {
  fail("RDL_DATABASE_URL is required");
}

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
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
      "-P",
      "pager=off",
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

function scalar(sql: string): string {
  const value = query(sql);
  if (!value) fail(`empty scalar result for SQL: ${sql}`);
  return value.split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}

function numberScalar(sql: string): number {
  const value = Number(scalar(sql));
  if (!Number.isFinite(value)) fail(`non-numeric scalar result for SQL: ${sql}`);
  return value;
}

function parseJsonLines<T>(value: string): T[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

type Snapshot = {
  source: { sha256: string };
};

type Batch = {
  accountingBatchId: number;
  packageId: number;
  packageKey: string;
  adapterKey: string;
  adapterVersion: string;
  sourceContentSha256: string;
  sourceLayerSha256: string;
  normalizedProjectionSha256: string;
  sourceRecordCount: number;
  normalizedEntityCount: number;
  normalizedRelationshipCount: number;
  projectionLinkCount: number;
  projectedSourceRecordCount: number;
  dispositionCount: number;
  semanticCompleteness: string;
};

type CountRow = {
  key: string;
  count: number;
};

type RelationshipLineageRow = {
  relationshipType: string;
  objectCount: number;
  linkCount: number;
  primaryCount: number;
  contributingCount: number;
};

const snapshot = JSON.parse(
  readFileSync(SNAPSHOT_PATH, "utf8"),
) as Snapshot;
const sourceContentSha256 = String(snapshot.source.sha256).toLowerCase();
const packageKey = `cfihos-2.0-${sourceContentSha256.slice(0, 12)}`;

const batches = parseJsonLines<Batch>(
  query(`
    SELECT json_build_object(
      'accountingBatchId', b.accounting_batch_id,
      'packageId', b.package_id,
      'packageKey', p.package_key,
      'adapterKey', b.adapter_key,
      'adapterVersion', b.adapter_version,
      'sourceContentSha256', b.source_content_sha256,
      'sourceLayerSha256', b.source_layer_sha256,
      'normalizedProjectionSha256', b.normalized_projection_sha256,
      'sourceRecordCount', b.source_record_count,
      'normalizedEntityCount', b.normalized_entity_count,
      'normalizedRelationshipCount', b.normalized_relationship_count,
      'projectionLinkCount', b.projection_link_count,
      'projectedSourceRecordCount', b.projected_source_record_count,
      'dispositionCount', b.disposition_count,
      'semanticCompleteness', b.summary->>'semanticCompleteness'
    )::text
    FROM rdl.rdl_projection_accounting_batch b
    JOIN rdl.rdl_package p ON p.package_id = b.package_id
    WHERE p.package_key = ${sqlText(packageKey)}
      AND b.adapter_key = 'cfihos-projection-accounting-v1'
      AND b.adapter_version = '1.0.0'
    ORDER BY b.accounting_batch_id DESC;
  `),
);

equal(batches.length, 1, "one exact projection-accounting batch");
const batch = batches[0];
equal(batch.packageKey, packageKey);
equal(batch.sourceContentSha256.toLowerCase(), sourceContentSha256);
ok(/^[0-9a-f]{64}$/i.test(batch.sourceLayerSha256));
ok(/^[0-9a-f]{64}$/i.test(batch.normalizedProjectionSha256));
equal(batch.sourceRecordCount, EXPECTED_SOURCE_RECORDS);
equal(batch.normalizedEntityCount, EXPECTED_ENTITIES);
equal(batch.normalizedRelationshipCount, EXPECTED_RELATIONSHIPS);
equal(batch.projectionLinkCount, EXPECTED_TOTAL_LINKS);
equal(batch.projectedSourceRecordCount, EXPECTED_PROJECTED_SOURCE_RECORDS);
equal(batch.dispositionCount, EXPECTED_DISPOSITIONS);
equal(batch.semanticCompleteness, "not_assessed");

console.log(
  `PASS RDL-041.2 exact accounting batch: ${batch.accountingBatchId}`,
);

const accountingRows = numberScalar(`
  SELECT count(*)
  FROM rdl.rdl_source_projection_accounting
  WHERE accounting_batch_id = ${batch.accountingBatchId};
`);
equal(accountingRows, EXPECTED_SOURCE_RECORDS);

const statusCounts = parseJsonLines<CountRow>(
  query(`
    SELECT json_build_object(
      'key', projection_status,
      'count', count(*)::integer
    )::text
    FROM rdl.rdl_source_projection_accounting
    WHERE accounting_batch_id = ${batch.accountingBatchId}
    GROUP BY projection_status
    ORDER BY projection_status;
  `),
);

deepStrictEqual(
  Object.fromEntries(statusCounts.map((row) => [row.key, row.count])),
  {
    not_applicable: 48,
    projected: 25_532,
    unmapped: 16_924,
    unresolved: 10,
  },
  "row-level projection status counts",
);

const unaccountedCount = numberScalar(`
  SELECT count(*)
  FROM rdl.rdl_source_projection_accounting
  WHERE accounting_batch_id = ${batch.accountingBatchId}
    AND projection_status IN ('unaccounted', 'error');
`);
equal(unaccountedCount, 0, "no unaccounted or error source records");

const unexpectedSemanticStatusCount = numberScalar(`
  SELECT count(*)
  FROM rdl.rdl_source_projection_accounting
  WHERE accounting_batch_id = ${batch.accountingBatchId}
    AND semantic_completeness_status IS DISTINCT FROM 'not_assessed';
`);
equal(unexpectedSemanticStatusCount, 0);

console.log(
  `PASS RDL-041.2 all ${EXPECTED_SOURCE_RECORDS} source records are accounted exactly once at row level`,
);

const reasonCounts = parseJsonLines<CountRow>(
  query(`
    SELECT json_build_object(
      'key', reason_code,
      'count', count(*)::integer
    )::text
    FROM rdl.rdl_source_projection_disposition
    WHERE accounting_batch_id = ${batch.accountingBatchId}
    GROUP BY reason_code
    ORDER BY reason_code;
  `),
);

deepStrictEqual(
  Object.fromEntries(reasonCounts.map((row) => [row.key, row.count])),
  {
    data_dictionary_projection_not_implemented: 803,
    equipment_class_endpoint_missing: 10,
    equivalence_mapping_projection_not_implemented: 3_091,
    guidance_content_not_normalized: 20,
    property_grouping_projection_not_implemented: 1_140,
    rdl_master_object_projection_not_implemented: 11_890,
    release_metadata_not_normalized: 28,
  },
  "zero-output reason counts",
);

console.log(
  `PASS RDL-041.2 exact ${EXPECTED_DISPOSITIONS} zero-output classifications`,
);

const linkKindCounts = parseJsonLines<CountRow>(
  query(`
    SELECT json_build_object(
      'key', projection_kind,
      'count', count(*)::integer
    )::text
    FROM rdl.rdl_source_projection_link
    WHERE accounting_batch_id = ${batch.accountingBatchId}
    GROUP BY projection_kind
    ORDER BY projection_kind;
  `),
);

deepStrictEqual(
  Object.fromEntries(linkKindCounts.map((row) => [row.key, row.count])),
  {
    entity: EXPECTED_ENTITY_LINKS,
    relationship: EXPECTED_RELATIONSHIP_LINKS,
  },
  "projection link kind counts",
);

const linkRoleCounts = parseJsonLines<CountRow>(
  query(`
    SELECT json_build_object(
      'key', lineage_role,
      'count', count(*)::integer
    )::text
    FROM rdl.rdl_source_projection_link
    WHERE accounting_batch_id = ${batch.accountingBatchId}
    GROUP BY lineage_role
    ORDER BY lineage_role;
  `),
);

deepStrictEqual(
  Object.fromEntries(linkRoleCounts.map((row) => [row.key, row.count])),
  {
    contributing: EXPECTED_CONTRIBUTING_LINKS,
    primary: EXPECTED_PRIMARY_LINKS,
  },
  "lineage role counts",
);

const entityCoverage = scalar(`
  SELECT
    count(DISTINCT entity_id)::text || '|' ||
    count(*) FILTER (WHERE lineage_role='primary')::text
  FROM rdl.rdl_source_projection_link
  WHERE accounting_batch_id = ${batch.accountingBatchId}
    AND projection_kind = 'entity';
`);
equal(entityCoverage, `${EXPECTED_ENTITIES}|${EXPECTED_ENTITIES}`);

const relationshipCoverage = scalar(`
  SELECT
    count(DISTINCT relationship_id)::text || '|' ||
    count(*) FILTER (WHERE lineage_role='primary')::text
  FROM rdl.rdl_source_projection_link
  WHERE accounting_batch_id = ${batch.accountingBatchId}
    AND projection_kind = 'relationship';
`);
equal(
  relationshipCoverage,
  `${EXPECTED_RELATIONSHIPS}|${EXPECTED_RELATIONSHIPS}`,
);

console.log(
  `PASS RDL-041.2 all ${EXPECTED_ENTITIES + EXPECTED_RELATIONSHIPS} normalized objects have one primary lineage link`,
);

const controlledListLineage = scalar(`
  SELECT
    count(DISTINCT l.entity_id)::text || '|' ||
    count(*)::text || '|' ||
    count(*) FILTER (WHERE l.lineage_role='primary')::text || '|' ||
    count(*) FILTER (WHERE l.lineage_role='contributing')::text
  FROM rdl.rdl_source_projection_link l
  JOIN rdl.rdl_entity e
    ON e.entity_id = l.entity_id
   AND e.package_id = l.package_id
  WHERE l.accounting_batch_id = ${batch.accountingBatchId}
    AND e.entity_type_code = 'controlled_list';
`);
equal(controlledListLineage, "367|3027|367|2660");

const informationRequirementLineage = scalar(`
  SELECT
    count(DISTINCT l.entity_id)::text || '|' ||
    count(*)::text || '|' ||
    count(*) FILTER (WHERE l.lineage_role='primary')::text || '|' ||
    count(*) FILTER (WHERE l.lineage_role='contributing')::text
  FROM rdl.rdl_source_projection_link l
  JOIN rdl.rdl_entity e
    ON e.entity_id = l.entity_id
   AND e.package_id = l.package_id
  WHERE l.accounting_batch_id = ${batch.accountingBatchId}
    AND e.entity_type_code = 'information_requirement';
`);
equal(informationRequirementLineage, "488|533|488|45");

console.log(
  "PASS RDL-041.2 many-source-to-one entity provenance: controlled lists and JIP33 requirements",
);

const jip33Relationships = parseJsonLines<RelationshipLineageRow>(
  query(`
    SELECT json_build_object(
      'relationshipType', rel.relationship_type_code,
      'objectCount', count(DISTINCT l.relationship_id)::integer,
      'linkCount', count(*)::integer,
      'primaryCount', count(*) FILTER (WHERE l.lineage_role='primary')::integer,
      'contributingCount', count(*) FILTER (WHERE l.lineage_role='contributing')::integer
    )::text
    FROM rdl.rdl_source_projection_link l
    JOIN rdl.rdl_relationship rel
      ON rel.relationship_id = l.relationship_id
     AND rel.package_id = l.package_id
    WHERE l.accounting_batch_id = ${batch.accountingBatchId}
      AND rel.relationship_type_code LIKE 'information_requirement_%'
    GROUP BY rel.relationship_type_code
    ORDER BY rel.relationship_type_code;
  `),
);

deepStrictEqual(
  Object.fromEntries(
    jip33Relationships.map((row) => [
      row.relationshipType,
      [
        row.objectCount,
        row.linkCount,
        row.primaryCount,
        row.contributingCount,
      ],
    ]),
  ),
  {
    information_requirement_class: [533, 533, 533, 0],
    information_requirement_discipline: [1, 2, 1, 1],
    information_requirement_document: [488, 533, 488, 45],
    information_requirement_standard: [488, 533, 488, 45],
  },
  "JIP33 relationship contributing lineage",
);

console.log(
  "PASS RDL-041.2 many-source-to-one JIP33 relationship provenance",
);

const propertyControlledListCounts = scalar(`
  WITH checked AS (
    SELECT
      l.relationship_id,
      l.lineage_role,
      src.native_identifier AS property_id,
      tgt.native_identifier AS controlled_list_id,
      NULLIF(btrim(sr.raw_row->>'CFIHOS unique code'), '') AS row_property_id,
      NULLIF(btrim(sr.raw_row->>'property picklist name CFIHOS unique code'), '') AS row_controlled_list_id
    FROM rdl.rdl_source_projection_link l
    JOIN rdl.rdl_relationship rel
      ON rel.relationship_id = l.relationship_id
     AND rel.package_id = l.package_id
    JOIN rdl.rdl_entity src
      ON src.entity_id = rel.source_entity_id
     AND src.package_id = rel.package_id
    JOIN rdl.rdl_entity tgt
      ON tgt.entity_id = rel.target_entity_id
     AND tgt.package_id = rel.package_id
    JOIN rdl.rdl_source_record sr
      ON sr.source_record_id = l.source_record_id
     AND sr.package_id = l.package_id
    WHERE l.accounting_batch_id = ${batch.accountingBatchId}
      AND rel.relationship_type_code = 'property_controlled_list'
  )
  SELECT
    count(DISTINCT relationship_id)::text || '|' ||
    count(*)::text || '|' ||
    count(*) FILTER (WHERE lineage_role='primary')::text || '|' ||
    count(*) FILTER (
      WHERE property_id IS DISTINCT FROM row_property_id
         OR controlled_list_id IS DISTINCT FROM row_controlled_list_id
    )::text
  FROM checked;
`);
equal(propertyControlledListCounts, "547|547|547|0");

console.log(
  "PASS RDL-041.2 all 547 Property-to-controlled-list relationships have exact semantic source-row lineage",
);

const overlapCount = numberScalar(`
  SELECT count(*)
  FROM rdl.rdl_source_projection_disposition d
  WHERE d.accounting_batch_id = ${batch.accountingBatchId}
    AND EXISTS (
      SELECT 1
      FROM rdl.rdl_source_projection_link l
      WHERE l.accounting_batch_id = d.accounting_batch_id
        AND l.source_record_id = d.source_record_id
    );
`);
equal(overlapCount, 0, "link/disposition mutual exclusivity");

query(`
  DO $rdl0412_immutability_test$
  DECLARE
    v_batch_id bigint := ${batch.accountingBatchId};
    v_link_id bigint;
    v_disposition_id bigint;
  BEGIN
    SELECT projection_link_id INTO v_link_id
    FROM rdl.rdl_source_projection_link
    WHERE accounting_batch_id = v_batch_id
    ORDER BY projection_link_id
    LIMIT 1;

    SELECT projection_disposition_id INTO v_disposition_id
    FROM rdl.rdl_source_projection_disposition
    WHERE accounting_batch_id = v_batch_id
    ORDER BY projection_disposition_id
    LIMIT 1;

    BEGIN
      UPDATE rdl.rdl_projection_accounting_batch
      SET summary = summary
      WHERE accounting_batch_id = v_batch_id;
      RAISE EXCEPTION 'accounting batch mutation unexpectedly succeeded';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    BEGIN
      UPDATE rdl.rdl_source_projection_link
      SET evidence = evidence
      WHERE projection_link_id = v_link_id;
      RAISE EXCEPTION 'projection link mutation unexpectedly succeeded';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    BEGIN
      UPDATE rdl.rdl_source_projection_disposition
      SET evidence = evidence
      WHERE projection_disposition_id = v_disposition_id;
      RAISE EXCEPTION 'projection disposition mutation unexpectedly succeeded';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;
  END;
  $rdl0412_immutability_test$;
`);

console.log("PASS RDL-041.2 projection-accounting evidence is immutable");
console.log(
  `PASS RDL-041.2 source-projection accounting: ${EXPECTED_SOURCE_RECORDS} source records / ${EXPECTED_TOTAL_LINKS} links / ${EXPECTED_DISPOSITIONS} dispositions`,
);
