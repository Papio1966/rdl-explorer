\set ON_ERROR_STOP on

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('rdl-043-projection-accounting-v2'));

CREATE TEMP TABLE rdl043_package AS
SELECT p.package_id, p.content_sha256
FROM rdl.rdl_package p
JOIN rdl.rdl_release r ON r.release_id = p.release_id
JOIN rdl.rdl_source s ON s.source_id = r.source_id
WHERE s.source_key = 'cfihos'
  AND r.release_key = 'cfihos-2.0'
  AND p.package_status = 'validated'
ORDER BY p.package_id DESC
LIMIT 1;

DO $$
DECLARE
  v_package_id bigint;
  v_v1_count integer;
  v_v2_count integer;
BEGIN
  SELECT package_id INTO v_package_id FROM rdl043_package;
  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'RDL-043 could not resolve validated CFIHOS package';
  END IF;

  SELECT count(*) INTO v_v1_count
  FROM rdl.rdl_projection_accounting_batch
  WHERE package_id = v_package_id
    AND adapter_key = 'cfihos-projection-accounting-v1'
    AND adapter_version = '1.0.0';

  IF v_v1_count <> 1 THEN
    RAISE EXCEPTION 'RDL-043 requires exactly one immutable RDL-041.2 v1 accounting batch, found %', v_v1_count;
  END IF;

  SELECT count(*) INTO v_v2_count
  FROM rdl.rdl_projection_accounting_batch
  WHERE package_id = v_package_id
    AND adapter_key = 'cfihos-projection-accounting-v2'
    AND adapter_version = '2.0.0';

  IF v_v2_count <> 0 THEN
    RAISE EXCEPTION 'RDL-043 v2 accounting batch already exists, found %', v_v2_count;
  END IF;
END
$$;

CREATE TEMP TABLE rdl043_batch_v1 AS
SELECT b.accounting_batch_id
FROM rdl.rdl_projection_accounting_batch b
JOIN rdl043_package p ON p.package_id = b.package_id
WHERE b.adapter_key = 'cfihos-projection-accounting-v1'
  AND b.adapter_version = '1.0.0';

CREATE TEMP TABLE rdl043_source_rows AS
SELECT
  sr.package_id,
  sr.source_record_id,
  sr.source_row_number,
  sr.record_order,
  ss.sheet_name,
  ss.sheet_order,
  sr.raw_row
FROM rdl.rdl_source_record sr
JOIN rdl.rdl_source_sheet ss
  ON ss.source_sheet_id = sr.source_sheet_id
 AND ss.package_id = sr.package_id
JOIN rdl043_package p ON p.package_id = sr.package_id;

CREATE TEMP TABLE rdl043_object_equivalence AS
SELECT
  package_id,
  source_record_id,
  source_row_number,
  nullif(btrim(raw_row->>'CFIHOS unique code'), '') AS cfihos_id,
  nullif(btrim(raw_row->>'coding source code'), '') AS coding_source_code,
  nullif(btrim(raw_row->>'CFIHOS code equivalent value'), '') AS external_value
FROM rdl043_source_rows
WHERE sheet_name = 'CFIHOS object equivalent mappin';

CREATE TEMP TABLE rdl043_property_grouping AS
SELECT
  package_id,
  source_record_id,
  source_row_number,
  nullif(btrim(raw_row->>'property group allowed for purpose CFIHOS unique code'), '') AS allowed_for_purpose_id,
  nullif(btrim(raw_row->>'property grouping or decomposition purpose CFIHOS unique code'), '') AS purpose_id,
  nullif(btrim(raw_row->>'property grouping purpose code'), '') AS purpose_code,
  nullif(btrim(raw_row->>'source standard CFIHOS unique code'), '') AS source_standard_id,
  nullif(btrim(raw_row->>'property group CFIHOS unique code'), '') AS property_group_id,
  nullif(btrim(raw_row->>'property to group assignment CFIHOS unique code'), '') AS assignment_id,
  nullif(btrim(raw_row->>'tag or equipment class CFIHOS unique code'), '') AS class_id,
  nullif(btrim(raw_row->>'tag or equipment class name'), '') AS class_name,
  nullif(btrim(raw_row->>'property CFIHOS unique code'), '') AS property_id,
  nullif(btrim(raw_row->>'property name'), '') AS property_name,
  nullif(btrim(raw_row->>'property sequence number'), '') AS property_sequence_number
FROM rdl043_source_rows
WHERE sheet_name = 'property groupings';

CREATE TEMP TABLE rdl043_class_document_unresolved AS
SELECT
  sr.package_id,
  sr.source_record_id,
  sr.source_row_number,
  nullif(btrim(sr.raw_row->>'source standard document and data requirement CFIHOS unique code'), '') AS requirement_id,
  nullif(btrim(sr.raw_row->>'asset type reference'), '') AS asset_type,
  nullif(btrim(sr.raw_row->>'tag or equipment class CFIHOS unique code'), '') AS class_id,
  nullif(btrim(sr.raw_row->>'tag or equipment class name'), '') AS class_name,
  nullif(btrim(sr.raw_row->>'document type CFIHOS unique code'), '') AS document_type_id,
  nullif(btrim(sr.raw_row->>'source standard CFIHOS unique code'), '') AS source_standard_id
FROM rdl043_source_rows sr
WHERE sr.sheet_name = 'document required per class'
  AND nullif(btrim(sr.raw_row->>'asset type reference'), '') = 'Equipment'
  AND EXISTS (
    SELECT 1 FROM rdl.rdl_entity e
    WHERE e.package_id = sr.package_id
      AND e.entity_type_code = 'tag_class'
      AND e.native_identifier = nullif(btrim(sr.raw_row->>'tag or equipment class CFIHOS unique code'), '')
  )
  AND NOT EXISTS (
    SELECT 1 FROM rdl.rdl_entity e
    WHERE e.package_id = sr.package_id
      AND e.entity_type_code = 'equipment_class'
      AND e.native_identifier = nullif(btrim(sr.raw_row->>'tag or equipment class CFIHOS unique code'), '')
  );

CREATE TEMP TABLE rdl043_raw_link_candidate (
  source_record_id bigint NOT NULL,
  projection_kind text NOT NULL,
  entity_id bigint,
  relationship_id bigint,
  suggested_role text NOT NULL
);

-- Preserve the v1 lineage population as the base of v2.
INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT l.source_record_id, l.projection_kind, l.entity_id, l.relationship_id, l.lineage_role
FROM rdl.rdl_source_projection_link l
JOIN rdl043_batch_v1 b ON b.accounting_batch_id = l.accounting_batch_id;

-- RDL master object rows that resolve to existing normalized identifiers become
-- contributing lineage to those normalized objects.
INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT sr.source_record_id, 'entity', e.entity_id, NULL, 'contributing'
FROM rdl043_source_rows sr
JOIN rdl.rdl_entity e
  ON e.package_id = sr.package_id
 AND e.native_identifier = nullif(btrim(sr.raw_row->>'CFIHOS unique code'), '')
WHERE sr.sheet_name = 'RDL master object';

-- External identifier lineage.
INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT DISTINCT ON (o.coding_source_code)
  o.source_record_id, 'entity', sys.entity_id, NULL, 'primary'
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity sys
  ON sys.package_id = o.package_id
 AND sys.entity_type_code = 'external_identifier_system'
 AND sys.native_identifier = 'external_identifier_system:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g'))
WHERE o.coding_source_code IS NOT NULL
ORDER BY o.coding_source_code, o.source_record_id;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT o.source_record_id, 'entity', ext.entity_id, NULL, 'primary'
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity ext
  ON ext.package_id = o.package_id
 AND ext.entity_type_code = 'external_identifier'
 AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
WHERE o.coding_source_code IS NOT NULL
  AND o.external_value IS NOT NULL;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT o.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity sys
  ON sys.package_id = o.package_id
 AND sys.entity_type_code = 'external_identifier_system'
 AND sys.native_identifier = 'external_identifier_system:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g'))
JOIN rdl.rdl_entity ext
  ON ext.package_id = o.package_id
 AND ext.entity_type_code = 'external_identifier'
 AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
JOIN rdl.rdl_relationship rel
  ON rel.package_id = o.package_id
 AND rel.relationship_type_code = 'external_identifier_system_value'
 AND rel.source_entity_id = sys.entity_id
 AND rel.target_entity_id = ext.entity_id
WHERE o.coding_source_code IS NOT NULL
  AND o.external_value IS NOT NULL;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT o.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity target_entity
  ON target_entity.package_id = o.package_id
 AND target_entity.native_identifier = o.cfihos_id
JOIN rdl.rdl_entity ext
  ON ext.package_id = o.package_id
 AND ext.entity_type_code = 'external_identifier'
 AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
JOIN rdl.rdl_relationship rel
  ON rel.package_id = o.package_id
 AND rel.relationship_type_code = 'entity_equivalent_identifier'
 AND rel.source_entity_id = target_entity.entity_id
 AND rel.target_entity_id = ext.entity_id
WHERE o.cfihos_id IS NOT NULL
  AND o.coding_source_code IS NOT NULL
  AND o.external_value IS NOT NULL;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT o.source_record_id, 'entity', ex.entity_id, NULL, 'primary'
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity ex
  ON ex.package_id = o.package_id
 AND ex.entity_type_code = 'projection_exception'
 AND ex.native_identifier = 'projection_exception:object_equivalence:' || o.source_record_id::text;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT o.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity ex
  ON ex.package_id = o.package_id
 AND ex.entity_type_code = 'projection_exception'
 AND ex.native_identifier = 'projection_exception:object_equivalence:' || o.source_record_id::text
JOIN rdl.rdl_entity ext
  ON ext.package_id = o.package_id
 AND ext.entity_type_code = 'external_identifier'
 AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
JOIN rdl.rdl_relationship rel
  ON rel.package_id = o.package_id
 AND rel.relationship_type_code = 'projection_exception_external_identifier'
 AND rel.source_entity_id = ex.entity_id
 AND rel.target_entity_id = ext.entity_id;

-- Property grouping lineage.
INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT g.source_record_id, 'entity', pg.entity_id, NULL, 'primary'
FROM rdl043_property_grouping g
JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT DISTINCT ON (g.purpose_id)
  g.source_record_id, 'entity', purpose.entity_id, NULL, 'primary'
FROM rdl043_property_grouping g
JOIN rdl.rdl_entity purpose ON purpose.package_id = g.package_id AND purpose.entity_type_code = 'grouping_purpose' AND purpose.native_identifier = g.purpose_id
WHERE g.purpose_id IS NOT NULL
ORDER BY g.purpose_id, g.source_record_id;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT g.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_property_grouping g
JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
JOIN rdl.rdl_entity purpose ON purpose.package_id = g.package_id AND purpose.entity_type_code = 'grouping_purpose' AND purpose.native_identifier = g.purpose_id
JOIN rdl.rdl_relationship rel
  ON rel.package_id = g.package_id
 AND rel.relationship_type_code = 'property_group_purpose'
 AND rel.source_entity_id = pg.entity_id
 AND rel.target_entity_id = purpose.entity_id
WHERE g.property_group_id IS NOT NULL AND g.purpose_id IS NOT NULL;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT g.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_property_grouping g
JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
JOIN rdl.rdl_entity standard ON standard.package_id = g.package_id AND standard.entity_type_code = 'source_standard' AND standard.native_identifier = g.source_standard_id
JOIN rdl.rdl_relationship rel
  ON rel.package_id = g.package_id
 AND rel.relationship_type_code = 'property_group_source_standard'
 AND rel.source_entity_id = pg.entity_id
 AND rel.target_entity_id = standard.entity_id
WHERE g.property_group_id IS NOT NULL AND g.source_standard_id IS NOT NULL;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT g.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_property_grouping g
JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
JOIN rdl.rdl_entity class_entity
  ON class_entity.package_id = g.package_id
 AND class_entity.entity_type_code IN ('tag_class', 'equipment_class')
 AND class_entity.native_identifier = g.class_id
JOIN rdl.rdl_relationship rel
  ON rel.package_id = g.package_id
 AND rel.relationship_type_code = 'property_group_class'
 AND rel.source_entity_id = pg.entity_id
 AND rel.target_entity_id = class_entity.entity_id
WHERE g.property_group_id IS NOT NULL AND g.class_id IS NOT NULL;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT g.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_property_grouping g
JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
JOIN rdl.rdl_entity property ON property.package_id = g.package_id AND property.entity_type_code = 'property' AND property.native_identifier = g.property_id
JOIN rdl.rdl_relationship rel
  ON rel.package_id = g.package_id
 AND rel.relationship_type_code = 'property_group_property'
 AND rel.source_entity_id = pg.entity_id
 AND rel.target_entity_id = property.entity_id
WHERE g.property_group_id IS NOT NULL AND g.property_id IS NOT NULL;

-- Class/document conflict exception lineage.
INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT d.source_record_id, 'entity', ex.entity_id, NULL, 'primary'
FROM rdl043_class_document_unresolved d
JOIN rdl.rdl_entity ex
  ON ex.package_id = d.package_id
 AND ex.entity_type_code = 'projection_exception'
 AND ex.native_identifier = 'projection_exception:class_document_asset_type_mismatch:' || d.source_record_id::text;

INSERT INTO rdl043_raw_link_candidate (source_record_id, projection_kind, entity_id, relationship_id, suggested_role)
SELECT d.source_record_id, 'relationship', NULL, rel.relationship_id, 'primary'
FROM rdl043_class_document_unresolved d
JOIN rdl.rdl_entity ex
  ON ex.package_id = d.package_id
 AND ex.entity_type_code = 'projection_exception'
 AND ex.native_identifier = 'projection_exception:class_document_asset_type_mismatch:' || d.source_record_id::text
JOIN rdl.rdl_relationship rel
  ON rel.package_id = d.package_id
 AND rel.source_entity_id = ex.entity_id
 AND rel.relationship_type_code IN ('projection_exception_subject_class', 'projection_exception_document_type', 'projection_exception_source_standard')
 AND (rel.source_locator->>'sheet') = 'document required per class'
 AND (rel.source_locator->>'sourceRow')::integer = d.source_row_number;

CREATE TEMP TABLE rdl043_link_candidate AS
WITH distinct_candidates AS (
  SELECT DISTINCT
    source_record_id,
    projection_kind,
    entity_id,
    relationship_id,
    suggested_role
  FROM rdl043_raw_link_candidate
  WHERE (projection_kind = 'entity' AND entity_id IS NOT NULL AND relationship_id IS NULL)
     OR (projection_kind = 'relationship' AND relationship_id IS NOT NULL AND entity_id IS NULL)
), ranked AS (
  SELECT
    source_record_id,
    projection_kind,
    entity_id,
    relationship_id,
    row_number() OVER (
      PARTITION BY projection_kind, COALESCE(entity_id, relationship_id)
      ORDER BY CASE WHEN suggested_role = 'primary' THEN 0 ELSE 1 END, source_record_id
    ) AS object_row_number
  FROM distinct_candidates
)
SELECT
  source_record_id,
  projection_kind,
  entity_id,
  relationship_id,
  CASE WHEN object_row_number = 1 THEN 'primary' ELSE 'contributing' END AS lineage_role
FROM ranked;

CREATE TEMP TABLE rdl043_link_presence AS
SELECT DISTINCT source_record_id
FROM rdl043_link_candidate;

CREATE TEMP TABLE rdl043_disposition_candidate AS
SELECT
  sr.source_record_id,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'not_applicable'
    ELSE 'unmapped'
  END AS disposition_status,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'source_workbook_administration'
    WHEN sr.sheet_name = 'RDL master object' THEN 'master_registry_source_only'
    WHEN sr.sheet_name = 'data dictionary' THEN 'deferred_information_model_semantics'
    ELSE 'unexpected_no_projection'
  END AS reason_code,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'Workbook administrative/release guidance rows are preserved losslessly and not projected as normalized RDL semantics.'
    WHEN sr.sheet_name = 'RDL master object' THEN 'RDL master object row did not resolve to an existing normalized entity; preserved as lossless source evidence pending a dedicated ontology/registry slice.'
    WHEN sr.sheet_name = 'data dictionary' THEN 'Data dictionary rows describe information-model constraints and are deferred to a dedicated schema/constraint model.'
    ELSE 'Unexpected no-projection source row encountered by RDL-043 v2 accounting.'
  END AS reason_detail
FROM rdl043_source_rows sr
LEFT JOIN rdl043_link_presence lp ON lp.source_record_id = sr.source_record_id
WHERE lp.source_record_id IS NULL;

DO $$
DECLARE
  v_unexpected integer;
  v_unlinked_objects integer;
BEGIN
  SELECT count(*) INTO v_unexpected
  FROM rdl043_disposition_candidate
  WHERE reason_code = 'unexpected_no_projection';

  IF v_unexpected <> 0 THEN
    RAISE EXCEPTION 'RDL-043 v2 produced unexpected no-projection rows: %', v_unexpected;
  END IF;

  SELECT count(*) INTO v_unlinked_objects
  FROM (
    SELECT e.entity_id::text AS object_id
    FROM rdl.rdl_entity e
    JOIN rdl043_package p ON p.package_id = e.package_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM rdl043_link_candidate l
      WHERE l.projection_kind = 'entity'
        AND l.entity_id = e.entity_id
        AND l.lineage_role = 'primary'
    )
    UNION ALL
    SELECT r.relationship_id::text AS object_id
    FROM rdl.rdl_relationship r
    JOIN rdl043_package p ON p.package_id = r.package_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM rdl043_link_candidate l
      WHERE l.projection_kind = 'relationship'
        AND l.relationship_id = r.relationship_id
        AND l.lineage_role = 'primary'
    )
  ) q;

  IF v_unlinked_objects <> 0 THEN
    RAISE EXCEPTION 'RDL-043 v2 has normalized objects without one primary lineage link: %', v_unlinked_objects;
  END IF;
END
$$;

CREATE TEMP TABLE rdl043_batch_id AS
WITH counts AS (
  SELECT
    p.package_id,
    p.content_sha256,
    (SELECT count(*) FROM rdl043_source_rows)::integer AS source_record_count,
    (SELECT count(*) FROM rdl.rdl_entity e WHERE e.package_id = p.package_id)::integer AS normalized_entity_count,
    (SELECT count(*) FROM rdl.rdl_relationship r WHERE r.package_id = p.package_id)::integer AS normalized_relationship_count,
    (SELECT count(*) FROM rdl043_link_candidate)::integer AS projection_link_count,
    (SELECT count(DISTINCT source_record_id) FROM rdl043_link_candidate)::integer AS projected_source_record_count,
    (SELECT count(*) FROM rdl043_disposition_candidate)::integer AS disposition_count,
    (SELECT count(*) FROM rdl.rdl_entity e WHERE e.package_id = p.package_id AND e.entity_type_code = 'projection_exception' AND e.normalized_metadata->>'exceptionCategory' = 'external_equivalence_unresolved')::integer AS unresolved_equivalence_exception_count,
    (SELECT count(*) FROM rdl.rdl_entity e WHERE e.package_id = p.package_id AND e.entity_type_code = 'projection_exception' AND e.normalized_metadata->>'exceptionCategory' = 'asset_type_vs_tag_class_mismatch')::integer AS class_document_exception_count
  FROM rdl043_package p
), inserted AS (
  INSERT INTO rdl.rdl_projection_accounting_batch (
    package_id,
    adapter_key,
    adapter_version,
    source_content_sha256,
    source_layer_sha256,
    normalized_projection_sha256,
    source_record_count,
    normalized_entity_count,
    normalized_relationship_count,
    projection_link_count,
    projected_source_record_count,
    disposition_count,
    summary
  )
  SELECT
    package_id,
    'cfihos-projection-accounting-v2',
    '2.0.0',
    content_sha256,
    '9f483f4f50fe55b951b4f4f043700cef9455a7cdbf7ae1be738111caa6ba92eb',
    :'rdl043_normalized_projection_sha',
    source_record_count,
    normalized_entity_count,
    normalized_relationship_count,
    projection_link_count,
    projected_source_record_count,
    disposition_count,
    jsonb_build_object(
      'semanticCompleteness', 'assessed_with_governed_exceptions',
      'projectionSlice', 'RDL-043',
      'externalEquivalenceExceptions', unresolved_equivalence_exception_count,
      'classDocumentAssetTypeExceptions', class_document_exception_count,
      'dataDictionaryDecision', 'DEFER_WITH_REASON',
      'rdlMasterObjectDecision', 'CONTRIBUTING_ONLY_OR_SOURCE_ONLY',
      'losslessSourceAuthority', 'preserved',
      'rdl042WorkbookRuntimeAuthority', 'preserved'
    )
  FROM counts
  RETURNING accounting_batch_id
)
SELECT accounting_batch_id FROM inserted;

INSERT INTO rdl.rdl_source_projection_link (
  accounting_batch_id,
  package_id,
  source_record_id,
  projection_kind,
  entity_id,
  relationship_id,
  lineage_role,
  linkage_method
)
SELECT
  b.accounting_batch_id,
  p.package_id,
  l.source_record_id,
  l.projection_kind,
  l.entity_id,
  l.relationship_id,
  l.lineage_role,
  CASE
    WHEN l.projection_kind = 'entity' THEN 'semantic_identifier'
    WHEN l.projection_kind = 'relationship' THEN 'semantic_endpoints'
    ELSE 'semantic_identifier'
  END
FROM rdl043_link_candidate l
CROSS JOIN rdl043_batch_id b
CROSS JOIN rdl043_package p;

INSERT INTO rdl.rdl_source_projection_disposition (
  accounting_batch_id,
  package_id,
  source_record_id,
  disposition_status,
  reason_code,
  reason_detail
)
SELECT
  b.accounting_batch_id,
  p.package_id,
  d.source_record_id,
  d.disposition_status,
  d.reason_code,
  d.reason_detail
FROM rdl043_disposition_candidate d
CROSS JOIN rdl043_batch_id b
CROSS JOIN rdl043_package p;

INSERT INTO rdl.rdl_source_semantic_assessment (
  accounting_batch_id,
  package_id,
  source_record_id,
  semantic_decision,
  semantic_completeness_status,
  reason_code,
  reason_detail,
  assessment_metadata
)
SELECT
  b.accounting_batch_id,
  sr.package_id,
  sr.source_record_id,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'NOT_APPLICABLE'
    WHEN sr.sheet_name = 'RDL master object' AND lp.source_record_id IS NOT NULL THEN 'CONTRIBUTING_ONLY'
    WHEN sr.sheet_name = 'RDL master object' THEN 'SOURCE_ONLY'
    WHEN sr.sheet_name = 'data dictionary' THEN 'DEFER_WITH_REASON'
    WHEN sr.sheet_name = 'CFIHOS object equivalent mappin' AND ex_obj.entity_id IS NOT NULL THEN 'UNRESOLVED'
    WHEN sr.sheet_name = 'document required per class' AND ex_doc.entity_id IS NOT NULL THEN 'UNRESOLVED'
    ELSE 'NORMALIZE'
  END AS semantic_decision,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'not_applicable'
    WHEN sr.sheet_name = 'RDL master object' AND lp.source_record_id IS NOT NULL THEN 'contributing_only'
    WHEN sr.sheet_name = 'RDL master object' THEN 'source_only'
    WHEN sr.sheet_name = 'data dictionary' THEN 'deferred_with_reason'
    WHEN sr.sheet_name = 'CFIHOS object equivalent mappin' AND ex_obj.entity_id IS NOT NULL THEN 'unresolved'
    WHEN sr.sheet_name = 'document required per class' AND ex_doc.entity_id IS NOT NULL THEN 'unresolved'
    ELSE 'normalized'
  END AS semantic_completeness_status,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'source_workbook_administration'
    WHEN sr.sheet_name = 'RDL master object' AND lp.source_record_id IS NOT NULL THEN 'master_registry_contributing_lineage'
    WHEN sr.sheet_name = 'RDL master object' THEN 'master_registry_source_only'
    WHEN sr.sheet_name = 'data dictionary' THEN 'deferred_information_model_semantics'
    WHEN sr.sheet_name = 'CFIHOS object equivalent mappin' AND ex_obj.entity_id IS NOT NULL THEN 'external_equivalence_unresolved'
    WHEN sr.sheet_name = 'document required per class' AND ex_doc.entity_id IS NOT NULL THEN 'asset_type_vs_tag_class_mismatch'
    ELSE 'normalized_projection_v2'
  END AS reason_code,
  CASE
    WHEN sr.sheet_name IN ('Cover and Index', 'Guidance') THEN 'Administrative workbook rows are preserved losslessly and intentionally excluded from normalized RDL semantics.'
    WHEN sr.sheet_name = 'RDL master object' AND lp.source_record_id IS NOT NULL THEN 'RDL master object row contributes source evidence to an existing normalized object.'
    WHEN sr.sheet_name = 'RDL master object' THEN 'RDL master object row is preserved as source evidence pending a dedicated ontology/registry slice.'
    WHEN sr.sheet_name = 'data dictionary' THEN 'Data dictionary row describes information-model/schema semantics deferred to a dedicated model.'
    WHEN sr.sheet_name = 'CFIHOS object equivalent mappin' AND ex_obj.entity_id IS NOT NULL THEN 'External equivalence row is captured as a governed unresolved projection exception.'
    WHEN sr.sheet_name = 'document required per class' AND ex_doc.entity_id IS NOT NULL THEN 'Class/document row is captured as a governed asset-type/class mismatch exception.'
    ELSE 'Source row is normalized or already carried by the generic normalized projection.'
  END AS reason_detail,
  jsonb_build_object(
    'sheetName', sr.sheet_name,
    'sourceRowNumber', sr.source_row_number,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  ) AS assessment_metadata
FROM rdl043_source_rows sr
CROSS JOIN rdl043_batch_id b
LEFT JOIN rdl043_link_presence lp ON lp.source_record_id = sr.source_record_id
LEFT JOIN rdl.rdl_entity ex_obj
  ON ex_obj.package_id = sr.package_id
 AND ex_obj.entity_type_code = 'projection_exception'
 AND ex_obj.native_identifier = 'projection_exception:object_equivalence:' || sr.source_record_id::text
LEFT JOIN rdl.rdl_entity ex_doc
  ON ex_doc.package_id = sr.package_id
 AND ex_doc.entity_type_code = 'projection_exception'
 AND ex_doc.native_identifier = 'projection_exception:class_document_asset_type_mismatch:' || sr.source_record_id::text;

DO $$
DECLARE
  v_batch_id bigint;
  v_source_count integer;
  v_assessment_count integer;
  v_unaccounted integer;
  v_disposition_count integer;
  v_linked_and_disposed integer;
BEGIN
  SELECT accounting_batch_id INTO v_batch_id FROM rdl043_batch_id;
  SELECT count(*) INTO v_source_count FROM rdl043_source_rows;
  SELECT count(*) INTO v_assessment_count FROM rdl.rdl_source_semantic_assessment WHERE accounting_batch_id = v_batch_id;
  SELECT count(*) INTO v_unaccounted FROM rdl.rdl_source_projection_accounting WHERE accounting_batch_id = v_batch_id AND projection_status = 'unaccounted';
  SELECT count(*) INTO v_disposition_count FROM rdl.rdl_source_projection_disposition WHERE accounting_batch_id = v_batch_id;
  SELECT count(*) INTO v_linked_and_disposed
  FROM rdl.rdl_source_projection_disposition d
  WHERE d.accounting_batch_id = v_batch_id
    AND EXISTS (
      SELECT 1
      FROM rdl.rdl_source_projection_link l
      WHERE l.accounting_batch_id = d.accounting_batch_id
        AND l.source_record_id = d.source_record_id
    );

  IF v_assessment_count <> v_source_count THEN
    RAISE EXCEPTION 'RDL-043 assessment count mismatch: % assessments for % source rows', v_assessment_count, v_source_count;
  END IF;

  IF v_unaccounted <> 0 THEN
    RAISE EXCEPTION 'RDL-043 v2 accounting has unaccounted rows: %', v_unaccounted;
  END IF;

  IF v_linked_and_disposed <> 0 THEN
    RAISE EXCEPTION 'RDL-043 v2 accounting has source rows with both links and dispositions: %', v_linked_and_disposed;
  END IF;

  IF v_disposition_count <> (
    SELECT disposition_count FROM rdl.rdl_projection_accounting_batch WHERE accounting_batch_id = v_batch_id
  ) THEN
    RAISE EXCEPTION 'RDL-043 v2 disposition count mismatch';
  END IF;
END
$$;

COMMIT;

SELECT 'PASS RDL-043 projection accounting v2 backfill' AS result;
