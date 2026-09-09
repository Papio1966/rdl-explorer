\set ON_ERROR_STOP on

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('rdl-043-normalized-projection-completeness'));

DO $$
DECLARE
  v_package_id bigint;
  v_conflict_count integer;
BEGIN
  SELECT p.package_id INTO v_package_id
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r ON r.release_id = p.release_id
  JOIN rdl.rdl_source s ON s.source_id = r.source_id
  WHERE s.source_key = 'cfihos'
    AND r.release_key = 'cfihos-2.0'
    AND p.package_status = 'validated'
  ORDER BY p.package_id DESC
  LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'RDL-043 could not resolve validated CFIHOS package';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rdl.rdl_projection_accounting_batch
    WHERE package_id = v_package_id
      AND adapter_key = 'cfihos-projection-accounting-v2'
      AND adapter_version = '2.0.0'
  ) THEN
    RAISE EXCEPTION 'RDL-043 v2 accounting already exists; refusing to rerun normalized backfill outside the guarded idempotent wrapper';
  END IF;

  WITH jip33 AS (
    SELECT sr.raw_row
    FROM rdl.rdl_source_record sr
    JOIN rdl.rdl_source_sheet ss
      ON ss.source_sheet_id = sr.source_sheet_id
     AND ss.package_id = sr.package_id
    WHERE sr.package_id = v_package_id
      AND ss.sheet_name = 'Jip33 info required spec'
  ), unpivoted AS (
    SELECT
      nullif(btrim(raw_row->>'Source standard document and data requirement CFIHOS unique code'), '') AS requirement_id,
      field_name,
      nullif(btrim(field_value), '') AS field_value
    FROM jip33
    CROSS JOIN LATERAL (VALUES
      ('source standard document and data requirement comment', raw_row->>'source standard document and data requirement comment'),
      ('default required translation indicator', raw_row->>'default required translation indicator'),
      ('default submit at proposal indicator', raw_row->>'default submit at proposal indicator'),
      ('default submit for review indicator', raw_row->>'default submit for review indicator'),
      ('default submit at delivery indicator', raw_row->>'default submit at delivery indicator'),
      ('default issue for review reference date', raw_row->>'default issue for review reference date'),
      ('default issue for approval reference date', raw_row->>'default issue for approval reference date'),
      ('default for information reference date', raw_row->>'default for information reference date')
    ) AS fields(field_name, field_value)
    WHERE nullif(btrim(raw_row->>'Source standard document and data requirement CFIHOS unique code'), '') IS NOT NULL
  ), conflicts AS (
    SELECT requirement_id, field_name
    FROM unpivoted
    WHERE field_value IS NOT NULL
    GROUP BY requirement_id, field_name
    HAVING count(DISTINCT field_value) > 1
  )
  SELECT count(*) INTO v_conflict_count
  FROM conflicts;

  IF v_conflict_count <> 0 THEN
    RAISE EXCEPTION 'RDL-043 JIP33 duplicate requirement semantic conflicts detected: %', v_conflict_count;
  END IF;
END
$$;

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
  nullif(btrim(raw_row->>'property grouping purpose description'), '') AS purpose_description,
  nullif(btrim(raw_row->>'source standard CFIHOS unique code'), '') AS source_standard_id,
  nullif(btrim(raw_row->>'source standard code'), '') AS source_standard_code,
  nullif(btrim(raw_row->>'property group CFIHOS unique code'), '') AS property_group_id,
  nullif(btrim(raw_row->>'property group code'), '') AS property_group_code,
  nullif(btrim(raw_row->>'property group description'), '') AS property_group_description,
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
  nullif(btrim(sr.raw_row->>'document type name'), '') AS document_type_name,
  nullif(btrim(sr.raw_row->>'source standard CFIHOS unique code'), '') AS source_standard_id,
  nullif(btrim(sr.raw_row->>'source standard code'), '') AS source_standard_code
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

-- External identifier systems.
INSERT INTO rdl.rdl_entity (
  package_id,
  entity_type_code,
  native_identifier,
  name,
  definition,
  lifecycle_status,
  is_authoritative,
  normalized_metadata,
  source_locator
)
SELECT DISTINCT
  p.package_id,
  'external_identifier_system',
  'external_identifier_system:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')),
  o.coding_source_code,
  'External coding system referenced by CFIHOS object equivalent mapping.',
  'active',
  true,
  jsonb_build_object(
    'codingSourceCode', o.coding_source_code,
    'projectionAdapter', 'cfihos-projection-accounting-v2',
    'semanticDecision', 'NORMALIZE'
  ),
  jsonb_build_object(
    'sheet', 'CFIHOS object equivalent mappin',
    'scope', 'coding source code',
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM rdl043_object_equivalence o
JOIN rdl043_package p ON p.package_id = o.package_id
WHERE o.coding_source_code IS NOT NULL
ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE
SET name = EXCLUDED.name,
    definition = EXCLUDED.definition,
    normalized_metadata = EXCLUDED.normalized_metadata,
    source_locator = EXCLUDED.source_locator;

-- External identifier values. Multiple CFIHOS objects can legitimately share
-- one external coding-system value, so aggregate by the normalized identity before
-- the upsert. This avoids a PostgreSQL ON CONFLICT self-collision while retaining
-- complete source-row provenance in sourceRows.
WITH external_identifier_values AS (
  SELECT
    o.package_id,
    o.coding_source_code,
    o.external_value,
    'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value) AS native_identifier,
    min(o.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT o.source_row_number ORDER BY o.source_row_number) AS source_rows
  FROM rdl043_object_equivalence o
  WHERE o.coding_source_code IS NOT NULL
    AND o.external_value IS NOT NULL
  GROUP BY o.package_id, o.coding_source_code, o.external_value
)
INSERT INTO rdl.rdl_entity (
  package_id,
  entity_type_code,
  native_identifier,
  name,
  definition,
  lifecycle_status,
  is_authoritative,
  normalized_metadata,
  source_locator
)
SELECT
  v.package_id,
  'external_identifier',
  v.native_identifier,
  v.coding_source_code || ' ' || v.external_value,
  'External identifier value equivalent to or referenced by a governed RDL entity.',
  'active',
  true,
  jsonb_build_object(
    'codingSourceCode', v.coding_source_code,
    'externalIdentifierValue', v.external_value,
    'sourceRecordCount', jsonb_array_length(v.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2',
    'semanticDecision', 'NORMALIZE'
  ),
  jsonb_build_object(
    'sheet', 'CFIHOS object equivalent mappin',
    'sourceRows', v.source_rows,
    'firstSourceRow', v.first_source_row,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM external_identifier_values v
ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE
SET name = EXCLUDED.name,
    definition = EXCLUDED.definition,
    normalized_metadata = EXCLUDED.normalized_metadata,
    source_locator = EXCLUDED.source_locator;

-- Property grouping purposes.
INSERT INTO rdl.rdl_entity (
  package_id,
  entity_type_code,
  native_identifier,
  name,
  definition,
  lifecycle_status,
  is_authoritative,
  normalized_metadata,
  source_locator
)
SELECT DISTINCT
  p.package_id,
  'grouping_purpose',
  g.purpose_id,
  COALESCE(g.purpose_code, g.purpose_id),
  g.purpose_description,
  'active',
  true,
  jsonb_build_object(
    'purposeCode', g.purpose_code,
    'projectionAdapter', 'cfihos-projection-accounting-v2',
    'semanticDecision', 'NORMALIZE'
  ),
  jsonb_build_object(
    'sheet', 'property groupings',
    'scope', 'property grouping or decomposition purpose',
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM rdl043_property_grouping g
JOIN rdl043_package p ON p.package_id = g.package_id
WHERE g.purpose_id IS NOT NULL
ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE
SET name = EXCLUDED.name,
    definition = EXCLUDED.definition,
    normalized_metadata = EXCLUDED.normalized_metadata,
    source_locator = EXCLUDED.source_locator;

-- Property groups.
INSERT INTO rdl.rdl_entity (
  package_id,
  entity_type_code,
  native_identifier,
  name,
  definition,
  lifecycle_status,
  is_authoritative,
  normalized_metadata,
  source_locator
)
SELECT DISTINCT ON (g.package_id, g.property_group_id)
  g.package_id,
  'property_group',
  g.property_group_id,
  COALESCE(g.property_group_code, g.property_group_id),
  g.property_group_description,
  'active',
  true,
  jsonb_build_object(
    'propertyGroupCode', g.property_group_code,
    'propertyGroupDescription', g.property_group_description,
    'projectionAdapter', 'cfihos-projection-accounting-v2',
    'semanticDecision', 'NORMALIZE'
  ),
  jsonb_build_object(
    'sheet', 'property groupings',
    'sourceRow', g.source_row_number,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM rdl043_property_grouping g
WHERE g.property_group_id IS NOT NULL
ORDER BY g.package_id, g.property_group_id, g.source_row_number
ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE
SET name = EXCLUDED.name,
    definition = EXCLUDED.definition,
    normalized_metadata = EXCLUDED.normalized_metadata,
    source_locator = EXCLUDED.source_locator;

-- Projection exception entities for unresolved external equivalence references.
INSERT INTO rdl.rdl_entity (
  package_id,
  entity_type_code,
  native_identifier,
  name,
  definition,
  lifecycle_status,
  is_authoritative,
  normalized_metadata,
  source_locator
)
SELECT
  o.package_id,
  'projection_exception',
  'projection_exception:object_equivalence:' || o.source_record_id::text,
  'Unresolved external equivalence for ' || COALESCE(o.cfihos_id, '(missing CFIHOS id)'),
  'CFIHOS object equivalent mapping references a CFIHOS identifier that is not present as a normalized entity in this package.',
  'active',
  true,
  jsonb_build_object(
    'exceptionCategory', 'external_equivalence_unresolved',
    'cfihosId', o.cfihos_id,
    'codingSourceCode', o.coding_source_code,
    'externalIdentifierValue', o.external_value,
    'semanticDecision', 'UNRESOLVED',
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  ),
  jsonb_build_object(
    'sheet', 'CFIHOS object equivalent mappin',
    'sourceRow', o.source_row_number,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM rdl043_object_equivalence o
WHERE o.cfihos_id IS NOT NULL
  AND o.coding_source_code IS NOT NULL
  AND o.external_value IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rdl.rdl_entity e
    WHERE e.package_id = o.package_id
      AND e.native_identifier = o.cfihos_id
  )
ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE
SET name = EXCLUDED.name,
    definition = EXCLUDED.definition,
    normalized_metadata = EXCLUDED.normalized_metadata,
    source_locator = EXCLUDED.source_locator;

-- Projection exception entities for the ten known class-document asset-type conflicts.
INSERT INTO rdl.rdl_entity (
  package_id,
  entity_type_code,
  native_identifier,
  name,
  definition,
  lifecycle_status,
  is_authoritative,
  normalized_metadata,
  source_locator
)
SELECT
  d.package_id,
  'projection_exception',
  'projection_exception:class_document_asset_type_mismatch:' || d.source_record_id::text,
  'Asset type mismatch for ' || COALESCE(d.class_name, d.class_id),
  'Document required per class row declares asset type Equipment, but the referenced identifier exists as a Tag Class and not as an Equipment Class.',
  'active',
  true,
  jsonb_build_object(
    'exceptionCategory', 'asset_type_vs_tag_class_mismatch',
    'requirementId', d.requirement_id,
    'assetType', d.asset_type,
    'classId', d.class_id,
    'className', d.class_name,
    'documentTypeId', d.document_type_id,
    'documentTypeName', d.document_type_name,
    'sourceStandardId', d.source_standard_id,
    'sourceStandardCode', d.source_standard_code,
    'semanticDecision', 'UNRESOLVED',
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  ),
  jsonb_build_object(
    'sheet', 'document required per class',
    'sourceRow', d.source_row_number,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM rdl043_class_document_unresolved d
ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE
SET name = EXCLUDED.name,
    definition = EXCLUDED.definition,
    normalized_metadata = EXCLUDED.normalized_metadata,
    source_locator = EXCLUDED.source_locator;

-- Relationships: external system -> external identifier.
WITH relationship_rows AS (
  SELECT
    o.package_id,
    sys.entity_id AS system_entity_id,
    ext.entity_id AS external_identifier_entity_id,
    o.coding_source_code,
    o.external_value,
    min(o.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT o.source_row_number ORDER BY o.source_row_number) AS source_rows
  FROM rdl043_object_equivalence o
  JOIN rdl.rdl_entity sys
    ON sys.package_id = o.package_id
   AND sys.entity_type_code = 'external_identifier_system'
   AND sys.native_identifier = 'external_identifier_system:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g'))
  JOIN rdl.rdl_entity ext
    ON ext.package_id = o.package_id
   AND ext.entity_type_code = 'external_identifier'
   AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
  WHERE o.coding_source_code IS NOT NULL
    AND o.external_value IS NOT NULL
  GROUP BY o.package_id, sys.entity_id, ext.entity_id, o.coding_source_code, o.external_value
)
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT
  r.package_id,
  'external_identifier_system_value',
  r.system_entity_id,
  r.external_identifier_entity_id,
  'active',
  true,
  jsonb_build_object(
    'codingSourceCode', r.coding_source_code,
    'externalIdentifierValue', r.external_value,
    'sourceRecordCount', jsonb_array_length(r.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  ),
  jsonb_build_object(
    'sheet', 'CFIHOS object equivalent mappin',
    'sourceRows', r.source_rows,
    'firstSourceRow', r.first_source_row,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM relationship_rows r
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

-- Relationships: normalized entity -> external identifier.
WITH relationship_rows AS (
  SELECT
    o.package_id,
    target_entity.entity_id AS target_entity_id,
    target_entity.entity_type_code AS resolved_entity_type,
    ext.entity_id AS external_identifier_entity_id,
    o.cfihos_id,
    o.coding_source_code,
    o.external_value,
    min(o.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT o.source_row_number ORDER BY o.source_row_number) AS source_rows
  FROM rdl043_object_equivalence o
  JOIN rdl.rdl_entity target_entity
    ON target_entity.package_id = o.package_id
   AND target_entity.native_identifier = o.cfihos_id
  JOIN rdl.rdl_entity ext
    ON ext.package_id = o.package_id
   AND ext.entity_type_code = 'external_identifier'
   AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
  WHERE o.cfihos_id IS NOT NULL
    AND o.coding_source_code IS NOT NULL
    AND o.external_value IS NOT NULL
  GROUP BY o.package_id, target_entity.entity_id, target_entity.entity_type_code, ext.entity_id, o.cfihos_id, o.coding_source_code, o.external_value
)
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT
  r.package_id,
  'entity_equivalent_identifier',
  r.target_entity_id,
  r.external_identifier_entity_id,
  'active',
  true,
  jsonb_build_object(
    'cfihosId', r.cfihos_id,
    'resolvedEntityType', r.resolved_entity_type,
    'codingSourceCode', r.coding_source_code,
    'externalIdentifierValue', r.external_value,
    'sourceRecordCount', jsonb_array_length(r.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  ),
  jsonb_build_object(
    'sheet', 'CFIHOS object equivalent mappin',
    'sourceRows', r.source_rows,
    'firstSourceRow', r.first_source_row,
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )
FROM relationship_rows r
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

-- Property-group relationships. The normalized relationship identity is the
-- semantic pair (group -> purpose/standard/class/property); source workbook rows
-- can contain multiple assignments for the same pair. Aggregate those rows before
-- upsert and keep full sourceRows provenance.
WITH relationship_rows AS (
  SELECT
    g.package_id,
    pg.entity_id AS property_group_entity_id,
    purpose.entity_id AS purpose_entity_id,
    min(g.purpose_code) AS purpose_code,
    jsonb_agg(DISTINCT g.allowed_for_purpose_id ORDER BY g.allowed_for_purpose_id) FILTER (WHERE g.allowed_for_purpose_id IS NOT NULL) AS allowed_for_purpose_ids,
    min(g.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT g.source_row_number ORDER BY g.source_row_number) AS source_rows
  FROM rdl043_property_grouping g
  JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
  JOIN rdl.rdl_entity purpose ON purpose.package_id = g.package_id AND purpose.entity_type_code = 'grouping_purpose' AND purpose.native_identifier = g.purpose_id
  WHERE g.property_group_id IS NOT NULL AND g.purpose_id IS NOT NULL
  GROUP BY g.package_id, pg.entity_id, purpose.entity_id
)
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT
  r.package_id,
  'property_group_purpose',
  r.property_group_entity_id,
  r.purpose_entity_id,
  'active',
  true,
  jsonb_strip_nulls(jsonb_build_object(
    'allowedForPurposeIds', r.allowed_for_purpose_ids,
    'purposeCode', r.purpose_code,
    'sourceRecordCount', jsonb_array_length(r.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )),
  jsonb_build_object('sheet', 'property groupings', 'sourceRows', r.source_rows, 'firstSourceRow', r.first_source_row, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM relationship_rows r
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

WITH relationship_rows AS (
  SELECT
    g.package_id,
    pg.entity_id AS property_group_entity_id,
    standard.entity_id AS standard_entity_id,
    jsonb_agg(DISTINCT g.source_standard_code ORDER BY g.source_standard_code) FILTER (WHERE g.source_standard_code IS NOT NULL) AS source_standard_codes,
    min(g.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT g.source_row_number ORDER BY g.source_row_number) AS source_rows
  FROM rdl043_property_grouping g
  JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
  JOIN rdl.rdl_entity standard ON standard.package_id = g.package_id AND standard.entity_type_code = 'source_standard' AND standard.native_identifier = g.source_standard_id
  WHERE g.property_group_id IS NOT NULL AND g.source_standard_id IS NOT NULL
  GROUP BY g.package_id, pg.entity_id, standard.entity_id
)
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT
  r.package_id,
  'property_group_source_standard',
  r.property_group_entity_id,
  r.standard_entity_id,
  'active',
  true,
  jsonb_strip_nulls(jsonb_build_object(
    'sourceStandardCodes', r.source_standard_codes,
    'sourceRecordCount', jsonb_array_length(r.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )),
  jsonb_build_object('sheet', 'property groupings', 'sourceRows', r.source_rows, 'firstSourceRow', r.first_source_row, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM relationship_rows r
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

WITH relationship_rows AS (
  SELECT
    g.package_id,
    pg.entity_id AS property_group_entity_id,
    class_entity.entity_id AS class_entity_id,
    class_entity.entity_type_code AS class_type,
    g.class_id,
    jsonb_agg(DISTINCT g.class_name ORDER BY g.class_name) FILTER (WHERE g.class_name IS NOT NULL) AS class_names,
    jsonb_agg(DISTINCT g.allowed_for_purpose_id ORDER BY g.allowed_for_purpose_id) FILTER (WHERE g.allowed_for_purpose_id IS NOT NULL) AS allowed_for_purpose_ids,
    min(g.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT g.source_row_number ORDER BY g.source_row_number) AS source_rows
  FROM rdl043_property_grouping g
  JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
  JOIN rdl.rdl_entity class_entity
    ON class_entity.package_id = g.package_id
   AND class_entity.entity_type_code IN ('tag_class', 'equipment_class')
   AND class_entity.native_identifier = g.class_id
  WHERE g.property_group_id IS NOT NULL AND g.class_id IS NOT NULL
  GROUP BY g.package_id, pg.entity_id, class_entity.entity_id, class_entity.entity_type_code, g.class_id
)
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT
  r.package_id,
  'property_group_class',
  r.property_group_entity_id,
  r.class_entity_id,
  'active',
  true,
  jsonb_strip_nulls(jsonb_build_object(
    'classId', r.class_id,
    'classNames', r.class_names,
    'classType', r.class_type,
    'sourceClassDomain', 'tag-or-equipment',
    'propertyGroupAllowedForPurposeIds', r.allowed_for_purpose_ids,
    'sourceRecordCount', jsonb_array_length(r.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )),
  jsonb_build_object('sheet', 'property groupings', 'sourceRows', r.source_rows, 'firstSourceRow', r.first_source_row, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM relationship_rows r
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

WITH relationship_rows AS (
  SELECT
    g.package_id,
    pg.entity_id AS property_group_entity_id,
    property.entity_id AS property_entity_id,
    jsonb_agg(DISTINCT g.assignment_id ORDER BY g.assignment_id) FILTER (WHERE g.assignment_id IS NOT NULL) AS assignment_ids,
    jsonb_agg(DISTINCT g.property_name ORDER BY g.property_name) FILTER (WHERE g.property_name IS NOT NULL) AS property_names,
    jsonb_agg(DISTINCT g.property_sequence_number ORDER BY g.property_sequence_number) FILTER (WHERE g.property_sequence_number IS NOT NULL) AS property_sequence_numbers,
    min(g.source_row_number) AS first_source_row,
    jsonb_agg(DISTINCT g.source_row_number ORDER BY g.source_row_number) AS source_rows
  FROM rdl043_property_grouping g
  JOIN rdl.rdl_entity pg ON pg.package_id = g.package_id AND pg.entity_type_code = 'property_group' AND pg.native_identifier = g.property_group_id
  JOIN rdl.rdl_entity property ON property.package_id = g.package_id AND property.entity_type_code = 'property' AND property.native_identifier = g.property_id
  WHERE g.property_group_id IS NOT NULL AND g.property_id IS NOT NULL
  GROUP BY g.package_id, pg.entity_id, property.entity_id
)
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT
  r.package_id,
  'property_group_property',
  r.property_group_entity_id,
  r.property_entity_id,
  'active',
  true,
  jsonb_strip_nulls(jsonb_build_object(
    'assignmentIds', r.assignment_ids,
    'propertyNames', r.property_names,
    'propertySequenceNumbers', r.property_sequence_numbers,
    'sourceRecordCount', jsonb_array_length(r.source_rows),
    'projectionAdapter', 'cfihos-projection-accounting-v2'
  )),
  jsonb_build_object('sheet', 'property groupings', 'sourceRows', r.source_rows, 'firstSourceRow', r.first_source_row, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM relationship_rows r
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

-- Exception relationships.
INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT DISTINCT
  d.package_id,
  'projection_exception_subject_class',
  ex.entity_id,
  tag.entity_id,
  'active',
  true,
  jsonb_build_object('exceptionCategory', 'asset_type_vs_tag_class_mismatch', 'assetType', d.asset_type, 'projectionAdapter', 'cfihos-projection-accounting-v2'),
  jsonb_build_object('sheet', 'document required per class', 'sourceRow', d.source_row_number, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM rdl043_class_document_unresolved d
JOIN rdl.rdl_entity ex ON ex.package_id = d.package_id AND ex.entity_type_code = 'projection_exception' AND ex.native_identifier = 'projection_exception:class_document_asset_type_mismatch:' || d.source_record_id::text
JOIN rdl.rdl_entity tag ON tag.package_id = d.package_id AND tag.entity_type_code = 'tag_class' AND tag.native_identifier = d.class_id
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT DISTINCT
  d.package_id,
  'projection_exception_document_type',
  ex.entity_id,
  doc.entity_id,
  'active',
  true,
  jsonb_build_object('exceptionCategory', 'asset_type_vs_tag_class_mismatch', 'requirementId', d.requirement_id, 'projectionAdapter', 'cfihos-projection-accounting-v2'),
  jsonb_build_object('sheet', 'document required per class', 'sourceRow', d.source_row_number, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM rdl043_class_document_unresolved d
JOIN rdl.rdl_entity ex ON ex.package_id = d.package_id AND ex.entity_type_code = 'projection_exception' AND ex.native_identifier = 'projection_exception:class_document_asset_type_mismatch:' || d.source_record_id::text
JOIN rdl.rdl_entity doc ON doc.package_id = d.package_id AND doc.entity_type_code = 'document_type' AND doc.native_identifier = d.document_type_id
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT DISTINCT
  d.package_id,
  'projection_exception_source_standard',
  ex.entity_id,
  standard.entity_id,
  'active',
  true,
  jsonb_build_object('exceptionCategory', 'asset_type_vs_tag_class_mismatch', 'requirementId', d.requirement_id, 'projectionAdapter', 'cfihos-projection-accounting-v2'),
  jsonb_build_object('sheet', 'document required per class', 'sourceRow', d.source_row_number, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM rdl043_class_document_unresolved d
JOIN rdl.rdl_entity ex ON ex.package_id = d.package_id AND ex.entity_type_code = 'projection_exception' AND ex.native_identifier = 'projection_exception:class_document_asset_type_mismatch:' || d.source_record_id::text
JOIN rdl.rdl_entity standard ON standard.package_id = d.package_id AND standard.entity_type_code = 'source_standard' AND standard.native_identifier = d.source_standard_id
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

INSERT INTO rdl.rdl_relationship (
  package_id,
  relationship_type_code,
  source_entity_id,
  target_entity_id,
  relationship_status,
  is_authoritative,
  attributes,
  source_locator
)
SELECT DISTINCT
  o.package_id,
  'projection_exception_external_identifier',
  ex.entity_id,
  ext.entity_id,
  'active',
  true,
  jsonb_build_object('exceptionCategory', 'external_equivalence_unresolved', 'cfihosId', o.cfihos_id, 'projectionAdapter', 'cfihos-projection-accounting-v2'),
  jsonb_build_object('sheet', 'CFIHOS object equivalent mappin', 'sourceRow', o.source_row_number, 'projectionAdapter', 'cfihos-projection-accounting-v2')
FROM rdl043_object_equivalence o
JOIN rdl.rdl_entity ex ON ex.package_id = o.package_id AND ex.entity_type_code = 'projection_exception' AND ex.native_identifier = 'projection_exception:object_equivalence:' || o.source_record_id::text
JOIN rdl.rdl_entity ext
  ON ext.package_id = o.package_id
 AND ext.entity_type_code = 'external_identifier'
 AND ext.native_identifier = 'external_identifier:' || lower(regexp_replace(o.coding_source_code, '[^A-Za-z0-9]+', '-', 'g')) || ':' || md5(o.external_value)
WHERE NOT EXISTS (
  SELECT 1 FROM rdl.rdl_entity e WHERE e.package_id = o.package_id AND e.native_identifier = o.cfihos_id
)
ON CONFLICT (package_id, relationship_type_code, source_entity_id, target_entity_id) DO UPDATE
SET attributes = EXCLUDED.attributes,
    source_locator = EXCLUDED.source_locator;

-- JIP33 semantic metadata repair. All duplicate requirement rows must already be
-- non-conflicting for these eight fields, as checked at the start of the script.
WITH jip33_source AS (
  SELECT
    sr.package_id,
    nullif(btrim(sr.raw_row->>'Source standard document and data requirement CFIHOS unique code'), '') AS requirement_id,
    max(nullif(btrim(sr.raw_row->>'source standard document and data requirement comment'), '')) AS requirement_comment,
    max(nullif(btrim(sr.raw_row->>'default required translation indicator'), '')) AS required_translation,
    max(nullif(btrim(sr.raw_row->>'default submit at proposal indicator'), '')) AS submit_at_proposal,
    max(nullif(btrim(sr.raw_row->>'default submit for review indicator'), '')) AS submit_for_review,
    max(nullif(btrim(sr.raw_row->>'default submit at delivery indicator'), '')) AS submit_at_delivery,
    max(nullif(btrim(sr.raw_row->>'default issue for review reference date'), '')) AS review_reference_date,
    max(nullif(btrim(sr.raw_row->>'default issue for approval reference date'), '')) AS approval_reference_date,
    max(nullif(btrim(sr.raw_row->>'default for information reference date'), '')) AS information_reference_date
  FROM rdl043_source_rows sr
  WHERE sr.sheet_name = 'Jip33 info required spec'
  GROUP BY sr.package_id, nullif(btrim(sr.raw_row->>'Source standard document and data requirement CFIHOS unique code'), '')
)
UPDATE rdl.rdl_entity e
SET normalized_metadata = e.normalized_metadata || jsonb_strip_nulls(jsonb_build_object(
      'comment', s.requirement_comment,
      'projectionComment', s.requirement_comment,
      'requiredTranslation', s.required_translation,
      'projectionRequiredTranslation', s.required_translation,
      'submitAtProposal', s.submit_at_proposal,
      'projectionSubmitAtProposal', s.submit_at_proposal,
      'submitForReview', s.submit_for_review,
      'projectionSubmitForReview', s.submit_for_review,
      'submitAtDelivery', s.submit_at_delivery,
      'projectionSubmitAtDelivery', s.submit_at_delivery,
      'reviewReferenceDate', s.review_reference_date,
      'projectionReviewReferenceDate', s.review_reference_date,
      'approvalReferenceDate', s.approval_reference_date,
      'projectionApprovalReferenceDate', s.approval_reference_date,
      'informationReferenceDate', s.information_reference_date,
      'projectionInformationReferenceDate', s.information_reference_date,
      'projectionAdapter', 'cfihos-projection-accounting-v2',
      'semanticDecision', 'NORMALIZE'
    ))
FROM jip33_source s
WHERE e.package_id = s.package_id
  AND e.entity_type_code = 'information_requirement'
  AND e.native_identifier = s.requirement_id;

COMMIT;

SELECT 'PASS RDL-043 normalized projection backfill' AS result;
