\set ON_ERROR_STOP on

BEGIN;
SET LOCAL standard_conforming_strings = on;
SELECT pg_advisory_xact_lock(
  hashtext('rdl-0412-projection-accounting'),
  hashtext(:'package_key')
);

CREATE OR REPLACE FUNCTION pg_temp.rdl0412_text(p_row jsonb, p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(p_row ->> p_key), '');
$$;

CREATE TEMP TABLE rdl0412_context (
  package_id bigint PRIMARY KEY,
  package_key text NOT NULL,
  source_content_sha256 text NOT NULL,
  source_layer_sha256 text NOT NULL,
  normalized_projection_sha256 text NOT NULL
) ON COMMIT DROP;

INSERT INTO rdl0412_context (
  package_id,
  package_key,
  source_content_sha256,
  source_layer_sha256,
  normalized_projection_sha256
)
SELECT
  p.package_id,
  p.package_key,
  p.content_sha256,
  :'source_layer_sha256',
  :'normalized_projection_sha256'
FROM rdl.rdl_package p
JOIN rdl.rdl_release r ON r.release_id = p.release_id
JOIN rdl.rdl_source src ON src.source_id = r.source_id
WHERE p.package_key = :'package_key'
  AND p.content_sha256 = :'source_content_sha256'
  AND src.source_key = 'cfihos'
  AND r.release_key = 'cfihos-2.0'
  AND p.package_kind = 'normalized'
  AND p.package_status = 'validated';

DO $rdl0412_context_check$
DECLARE
  v_context_count integer;
  v_source_sheet_count integer;
  v_source_record_count integer;
  v_entity_count integer;
  v_relationship_count integer;
BEGIN
  SELECT count(*)::integer INTO v_context_count FROM rdl0412_context;
  IF v_context_count <> 1 THEN
    RAISE EXCEPTION 'RDL-041.2 expected one exact validated CFIHOS package, found %', v_context_count
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO v_source_sheet_count
  FROM rdl.rdl_source_sheet ss
  JOIN rdl0412_context c ON c.package_id = ss.package_id;

  SELECT count(*)::integer INTO v_source_record_count
  FROM rdl.rdl_source_record sr
  JOIN rdl0412_context c ON c.package_id = sr.package_id;

  SELECT count(*)::integer INTO v_entity_count
  FROM rdl.rdl_entity e
  JOIN rdl0412_context c ON c.package_id = e.package_id;

  SELECT count(*)::integer INTO v_relationship_count
  FROM rdl.rdl_relationship rel
  JOIN rdl0412_context c ON c.package_id = rel.package_id;

  IF v_source_sheet_count <> 23
     OR v_source_record_count <> 42514
     OR v_entity_count <> 13609
     OR v_relationship_count <> 39461 THEN
    RAISE EXCEPTION
      'RDL-041.2 foundation mismatch: sheets %, records %, entities %, relationships %',
      v_source_sheet_count,
      v_source_record_count,
      v_entity_count,
      v_relationship_count
      USING ERRCODE = '23514';
  END IF;
END;
$rdl0412_context_check$;

CREATE TEMP VIEW rdl0412_source_row AS
SELECT
  sr.source_record_id,
  sr.package_id,
  ss.sheet_name,
  ss.sheet_order,
  sr.source_row_number,
  sr.record_order,
  sr.raw_row,
  sr.row_sha256
FROM rdl.rdl_source_record sr
JOIN rdl.rdl_source_sheet ss
  ON ss.source_sheet_id = sr.source_sheet_id
 AND ss.package_id = sr.package_id
JOIN rdl0412_context c ON c.package_id = sr.package_id;

CREATE TEMP TABLE rdl0412_entity_candidate (
  source_record_id bigint NOT NULL,
  entity_id bigint NOT NULL,
  sheet_order integer NOT NULL,
  source_row_number integer NOT NULL,
  evidence jsonb NOT NULL,
  PRIMARY KEY (source_record_id, entity_id)
) ON COMMIT DROP;

INSERT INTO rdl0412_entity_candidate (
  source_record_id,
  entity_id,
  sheet_order,
  source_row_number,
  evidence
)
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'discipline'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'discipline'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'document_type'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'document type'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'equipment_class'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'equipment class CFIHOS unique code')
WHERE s.sheet_name = 'equipment class'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'handover_event'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'handover event'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'property'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'property'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'controlled_list'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property picklist CFIHOS unique code')
WHERE s.sheet_name = 'property picklist values'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'controlled_value'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property picklist value CFIHOS unique code')
WHERE s.sheet_name = 'property picklist values'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'source_standard'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'source standard'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'tag_class'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'tag class'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'unit_of_measure'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'unit of measure'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'information_requirement'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'Source standard document and data requirement CFIHOS unique code')
WHERE s.sheet_name = 'Jip33 info required spec'
UNION ALL
SELECT
  s.source_record_id,
  e.entity_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'entityType', e.entity_type_code,
    'nativeIdentifier', e.native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl.rdl_entity e
  ON e.package_id = s.package_id
 AND e.entity_type_code = 'source_mapping'
 AND e.native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
WHERE s.sheet_name = 'tag equip class prop src std';

CREATE TEMP TABLE rdl0412_relationship_object ON COMMIT DROP AS
SELECT
  rel.relationship_id,
  rel.package_id,
  rel.relationship_type_code,
  src.entity_type_code AS source_type,
  src.native_identifier AS source_native_identifier,
  src.name AS source_name,
  tgt.entity_type_code AS target_type,
  tgt.native_identifier AS target_native_identifier,
  tgt.name AS target_name
FROM rdl.rdl_relationship rel
JOIN rdl0412_context c ON c.package_id = rel.package_id
JOIN rdl.rdl_entity src
  ON src.entity_id = rel.source_entity_id
 AND src.package_id = rel.package_id
JOIN rdl.rdl_entity tgt
  ON tgt.entity_id = rel.target_entity_id
 AND tgt.package_id = rel.package_id;

CREATE UNIQUE INDEX rdl0412_relationship_object_id_uidx
  ON rdl0412_relationship_object(relationship_id);

CREATE INDEX rdl0412_relationship_object_semantic_idx
  ON rdl0412_relationship_object(
    relationship_type_code,
    source_type,
    source_native_identifier,
    target_type,
    target_native_identifier
  );

CREATE TEMP TABLE rdl0412_relationship_candidate (
  source_record_id bigint NOT NULL,
  relationship_id bigint NOT NULL,
  sheet_order integer NOT NULL,
  source_row_number integer NOT NULL,
  evidence jsonb NOT NULL,
  PRIMARY KEY (source_record_id, relationship_id)
) ON COMMIT DROP;

INSERT INTO rdl0412_relationship_candidate (
  source_record_id,
  relationship_id,
  sheet_order,
  source_row_number,
  evidence
)
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'document_discipline'
 AND ro.source_type = 'document_type'
 AND ro.target_type = 'discipline'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'document type CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'discipline CFIHOS unique code')
WHERE s.sheet_name = 'discipline document type'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'class_document'
 AND ro.source_type = 'equipment_class'
 AND ro.target_type = 'document_type'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag or equipment class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'document type CFIHOS unique code')
WHERE s.sheet_name = 'document required per class'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'class_document'
 AND ro.source_type = 'tag_class'
 AND ro.target_type = 'document_type'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag or equipment class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'document type CFIHOS unique code')
WHERE s.sheet_name = 'document required per class'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'entity_parent'
 AND ro.source_type = 'equipment_class'
 AND ro.target_type = 'equipment_class'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'equipment class CFIHOS unique code')
 AND ro.target_native_identifier = ro.target_native_identifier
 AND lower(btrim(ro.target_name)) = lower(pg_temp.rdl0412_text(s.raw_row, 'parent equipment class name'))
WHERE s.sheet_name = 'equipment class'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'class_property'
 AND ro.source_type = 'equipment_class'
 AND ro.target_type = 'property'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'equipment class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property CFIHOS unique code')
WHERE s.sheet_name = 'equipment class property'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'information_requirement_class'
 AND ro.source_type = 'information_requirement'
 AND ro.target_type = 'tag_class'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'Source standard document and data requirement CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag class CFIHOS unique code')
WHERE s.sheet_name = 'Jip33 info required spec'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'information_requirement_discipline'
 AND ro.source_type = 'information_requirement'
 AND ro.target_type = 'discipline'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'Source standard document and data requirement CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'discipline CFIHOS unique code')
WHERE s.sheet_name = 'Jip33 info required spec'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'information_requirement_document'
 AND ro.source_type = 'information_requirement'
 AND ro.target_type = 'document_type'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'Source standard document and data requirement CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'document type CFIHOS unique code')
WHERE s.sheet_name = 'Jip33 info required spec'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'information_requirement_standard'
 AND ro.source_type = 'information_requirement'
 AND ro.target_type = 'source_standard'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'Source standard document and data requirement CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'source standard CFIHOS unique code')
WHERE s.sheet_name = 'Jip33 info required spec'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'property_controlled_list'
 AND ro.source_type = 'property'
 AND ro.target_type = 'controlled_list'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property picklist name CFIHOS unique code')
WHERE s.sheet_name = 'property'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'controlled_list_value'
 AND ro.source_type = 'controlled_list'
 AND ro.target_type = 'controlled_value'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property picklist CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property picklist value CFIHOS unique code')
WHERE s.sheet_name = 'property picklist values'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'entity_source_standard'
 AND ro.source_type = 'controlled_value'
 AND ro.target_type = 'source_standard'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property picklist value CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'Source standard CFIHOS unique code')
WHERE s.sheet_name = 'property picklist values'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'entity_parent'
 AND ro.source_type = 'tag_class'
 AND ro.target_type = 'tag_class'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
 AND ro.target_native_identifier = ro.target_native_identifier
 AND lower(btrim(ro.target_name)) = lower(pg_temp.rdl0412_text(s.raw_row, 'parent tag class name'))
WHERE s.sheet_name = 'tag class'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'class_property'
 AND ro.source_type = 'tag_class'
 AND ro.target_type = 'property'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property CFIHOS unique code')
WHERE s.sheet_name = 'tag class property'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'mapping_equipment_class'
 AND ro.source_type = 'source_mapping'
 AND ro.target_type = 'equipment_class'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag or equipment class CFIHOS unique code')
WHERE s.sheet_name = 'tag equip class prop src std'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'mapping_property'
 AND ro.source_type = 'source_mapping'
 AND ro.target_type = 'property'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'property CFIHOS unique code')
WHERE s.sheet_name = 'tag equip class prop src std'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'mapping_standard'
 AND ro.source_type = 'source_mapping'
 AND ro.target_type = 'source_standard'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'source standard code CFIHOS unique code')
WHERE s.sheet_name = 'tag equip class prop src std'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'mapping_tag_class'
 AND ro.source_type = 'source_mapping'
 AND ro.target_type = 'tag_class'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag or equipment class CFIHOS unique code')
WHERE s.sheet_name = 'tag equip class prop src std'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'tag_equipment_mapping'
 AND ro.source_type = 'tag_class'
 AND ro.target_type = 'equipment_class'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'equipment class CFIHOS unique code')
WHERE s.sheet_name = 'tag equipment class relationshi'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'entity_source_standard'
 AND ro.source_type = 'equipment_class'
 AND ro.target_type = 'source_standard'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag or equipment class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'source standard CFIHOS unique code')
WHERE s.sheet_name = 'tag or equip class src standard'
UNION ALL
SELECT
  s.source_record_id,
  ro.relationship_id,
  s.sheet_order,
  s.source_row_number,
  jsonb_build_object(
    'sourceSheet', s.sheet_name,
    'sourceRow', s.source_row_number,
    'relationshipType', ro.relationship_type_code,
    'sourceType', ro.source_type,
    'sourceIdentifier', ro.source_native_identifier,
    'targetType', ro.target_type,
    'targetIdentifier', ro.target_native_identifier
  ) AS evidence
FROM rdl0412_source_row s
JOIN rdl0412_relationship_object ro
  ON ro.relationship_type_code = 'entity_source_standard'
 AND ro.source_type = 'tag_class'
 AND ro.target_type = 'source_standard'
 AND ro.source_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'tag or equipment class CFIHOS unique code')
 AND ro.target_native_identifier = pg_temp.rdl0412_text(s.raw_row, 'source standard CFIHOS unique code')
WHERE s.sheet_name = 'tag or equip class src standard';

CREATE TEMP TABLE rdl0412_projection_link_stage (
  source_record_id bigint NOT NULL,
  projection_kind text NOT NULL,
  entity_id bigint,
  relationship_id bigint,
  lineage_role text NOT NULL,
  linkage_method text NOT NULL,
  evidence jsonb NOT NULL,
  CHECK (
    (projection_kind = 'entity' AND entity_id IS NOT NULL AND relationship_id IS NULL)
    OR
    (projection_kind = 'relationship' AND relationship_id IS NOT NULL AND entity_id IS NULL)
  )
) ON COMMIT DROP;

INSERT INTO rdl0412_projection_link_stage (
  source_record_id,
  projection_kind,
  entity_id,
  relationship_id,
  lineage_role,
  linkage_method,
  evidence
)
SELECT
  source_record_id,
  'entity',
  entity_id,
  NULL,
  CASE
    WHEN row_number() OVER (
      PARTITION BY entity_id
      ORDER BY sheet_order, source_row_number, source_record_id
    ) = 1 THEN 'primary'
    ELSE 'contributing'
  END,
  'semantic_identifier',
  evidence
FROM rdl0412_entity_candidate;

INSERT INTO rdl0412_projection_link_stage (
  source_record_id,
  projection_kind,
  entity_id,
  relationship_id,
  lineage_role,
  linkage_method,
  evidence
)
SELECT
  source_record_id,
  'relationship',
  NULL,
  relationship_id,
  CASE
    WHEN row_number() OVER (
      PARTITION BY relationship_id
      ORDER BY sheet_order, source_row_number, source_record_id
    ) = 1 THEN 'primary'
    ELSE 'contributing'
  END,
  'semantic_endpoints',
  evidence
FROM rdl0412_relationship_candidate;

CREATE UNIQUE INDEX rdl0412_projection_link_stage_entity_uidx
  ON rdl0412_projection_link_stage(source_record_id, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE UNIQUE INDEX rdl0412_projection_link_stage_relationship_uidx
  ON rdl0412_projection_link_stage(source_record_id, relationship_id)
  WHERE relationship_id IS NOT NULL;

CREATE TEMP TABLE rdl0412_disposition_stage (
  source_record_id bigint PRIMARY KEY,
  disposition_status text NOT NULL,
  reason_code text NOT NULL,
  reason_detail text,
  evidence jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO rdl0412_disposition_stage (
  source_record_id,
  disposition_status,
  reason_code,
  reason_detail,
  evidence
)
SELECT
  s.source_record_id,
  CASE
    WHEN s.sheet_name IN ('Cover and Index', 'Guidance') THEN 'not_applicable'
    WHEN s.sheet_name IN (
      'RDL master object',
      'data dictionary',
      'CFIHOS object equivalent mappin',
      'property groupings'
    ) THEN 'unmapped'
    WHEN s.sheet_name = 'document required per class'
      AND lower(pg_temp.rdl0412_text(s.raw_row, 'asset type reference')) = 'equipment'
      AND NOT EXISTS (
        SELECT 1
        FROM rdl.rdl_entity e
        WHERE e.package_id = s.package_id
          AND e.entity_type_code = 'equipment_class'
          AND e.native_identifier = pg_temp.rdl0412_text(
            s.raw_row,
            'tag or equipment class CFIHOS unique code'
          )
      ) THEN 'unresolved'
    ELSE 'error'
  END AS disposition_status,
  CASE
    WHEN s.sheet_name = 'Cover and Index'
      THEN 'release_metadata_not_normalized'
    WHEN s.sheet_name = 'Guidance'
      THEN 'guidance_content_not_normalized'
    WHEN s.sheet_name = 'RDL master object'
      THEN 'rdl_master_object_projection_not_implemented'
    WHEN s.sheet_name = 'data dictionary'
      THEN 'data_dictionary_projection_not_implemented'
    WHEN s.sheet_name = 'CFIHOS object equivalent mappin'
      THEN 'equivalence_mapping_projection_not_implemented'
    WHEN s.sheet_name = 'property groupings'
      THEN 'property_grouping_projection_not_implemented'
    WHEN s.sheet_name = 'document required per class'
      AND lower(pg_temp.rdl0412_text(s.raw_row, 'asset type reference')) = 'equipment'
      AND NOT EXISTS (
        SELECT 1
        FROM rdl.rdl_entity e
        WHERE e.package_id = s.package_id
          AND e.entity_type_code = 'equipment_class'
          AND e.native_identifier = pg_temp.rdl0412_text(
            s.raw_row,
            'tag or equipment class CFIHOS unique code'
          )
      ) THEN 'equipment_class_endpoint_missing'
    ELSE 'unclassified_zero_output'
  END AS reason_code,
  CASE
    WHEN s.sheet_name = 'document required per class' THEN
      'The source row requires an Equipment class, but that Equipment-class endpoint is absent from the normalized package. The row must not be reinterpreted as a Tag requirement.'
    WHEN s.sheet_name IN ('Cover and Index', 'Guidance') THEN
      'Release presentation or guidance content is preserved losslessly but is outside the normalized semantic projection.'
    ELSE
      'The source semantics are preserved losslessly; a normalized projection is not implemented in the current package.'
  END AS reason_detail,
  CASE
    WHEN s.sheet_name = 'document required per class' THEN
      jsonb_build_object(
        'sourceSheet', s.sheet_name,
        'sourceRow', s.source_row_number,
        'assetType', pg_temp.rdl0412_text(s.raw_row, 'asset type reference'),
        'classIdentifier', pg_temp.rdl0412_text(
          s.raw_row,
          'tag or equipment class CFIHOS unique code'
        ),
        'documentTypeIdentifier', pg_temp.rdl0412_text(
          s.raw_row,
          'document type CFIHOS unique code'
        )
      )
    ELSE
      jsonb_build_object(
        'sourceSheet', s.sheet_name,
        'sourceRow', s.source_row_number
      )
  END AS evidence
FROM rdl0412_source_row s
WHERE NOT EXISTS (
  SELECT 1
  FROM rdl0412_projection_link_stage l
  WHERE l.source_record_id = s.source_record_id
);

DO $rdl0412_stage_check$
DECLARE
  v_entity_object_count integer;
  v_relationship_object_count integer;
  v_entity_link_count integer;
  v_relationship_link_count integer;
  v_primary_link_count integer;
  v_contributing_link_count integer;
  v_projected_source_count integer;
  v_disposition_count integer;
  v_unmapped_count integer;
  v_not_applicable_count integer;
  v_unresolved_count integer;
  v_error_count integer;
  v_missing_entity_count integer;
  v_missing_relationship_count integer;
BEGIN
  SELECT count(DISTINCT entity_id)::integer,
         count(*)::integer
    INTO v_entity_object_count, v_entity_link_count
  FROM rdl0412_projection_link_stage
  WHERE projection_kind = 'entity';

  SELECT count(DISTINCT relationship_id)::integer,
         count(*)::integer
    INTO v_relationship_object_count, v_relationship_link_count
  FROM rdl0412_projection_link_stage
  WHERE projection_kind = 'relationship';

  SELECT count(*) FILTER (WHERE lineage_role = 'primary')::integer,
         count(*) FILTER (WHERE lineage_role = 'contributing')::integer,
         count(DISTINCT source_record_id)::integer
    INTO v_primary_link_count, v_contributing_link_count, v_projected_source_count
  FROM rdl0412_projection_link_stage;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE disposition_status = 'unmapped')::integer,
         count(*) FILTER (WHERE disposition_status = 'not_applicable')::integer,
         count(*) FILTER (WHERE disposition_status = 'unresolved')::integer,
         count(*) FILTER (WHERE disposition_status = 'error')::integer
    INTO v_disposition_count,
         v_unmapped_count,
         v_not_applicable_count,
         v_unresolved_count,
         v_error_count
  FROM rdl0412_disposition_stage;

  SELECT count(*)::integer INTO v_missing_entity_count
  FROM rdl.rdl_entity e
  JOIN rdl0412_context c ON c.package_id = e.package_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM rdl0412_projection_link_stage l
    WHERE l.entity_id = e.entity_id
  );

  SELECT count(*)::integer INTO v_missing_relationship_count
  FROM rdl.rdl_relationship rel
  JOIN rdl0412_context c ON c.package_id = rel.package_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM rdl0412_projection_link_stage l
    WHERE l.relationship_id = rel.relationship_id
  );

  IF v_entity_object_count <> 13609
     OR v_relationship_object_count <> 39461
     OR v_entity_link_count <> 16314
     OR v_relationship_link_count <> 39552
     OR v_primary_link_count <> 53070
     OR v_contributing_link_count <> 2796
     OR v_projected_source_count <> 25532
     OR v_disposition_count <> 16982
     OR v_unmapped_count <> 16924
     OR v_not_applicable_count <> 48
     OR v_unresolved_count <> 10
     OR v_error_count <> 0
     OR v_missing_entity_count <> 0
     OR v_missing_relationship_count <> 0 THEN
    RAISE EXCEPTION
      'RDL-041.2 stage mismatch: objects %/%, links %/%, roles %/%, projected %, dispositions % (% unmapped, % not-applicable, % unresolved, % error), missing %/%',
      v_entity_object_count,
      v_relationship_object_count,
      v_entity_link_count,
      v_relationship_link_count,
      v_primary_link_count,
      v_contributing_link_count,
      v_projected_source_count,
      v_disposition_count,
      v_unmapped_count,
      v_not_applicable_count,
      v_unresolved_count,
      v_error_count,
      v_missing_entity_count,
      v_missing_relationship_count
      USING ERRCODE = '23514';
  END IF;
END;
$rdl0412_stage_check$;

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
  c.package_id,
  'cfihos-projection-accounting-v1',
  '1.0.0',
  c.source_content_sha256,
  c.source_layer_sha256,
  c.normalized_projection_sha256,
  42514,
  13609,
  39461,
  55866,
  25532,
  16982,
  jsonb_build_object(
    'primaryLinks', 53070,
    'contributingLinks', 2796,
    'entityLinks', 16314,
    'relationshipLinks', 39552,
    'projectedSourceRecords', 25532,
    'unmappedSourceRecords', 16924,
    'notApplicableSourceRecords', 48,
    'unresolvedSourceRecords', 10,
    'errorSourceRecords', 0,
    'semanticCompleteness', 'not_assessed'
  )
FROM rdl0412_context c
WHERE NOT EXISTS (
  SELECT 1
  FROM rdl.rdl_projection_accounting_batch b
  WHERE b.package_id = c.package_id
    AND b.adapter_key = 'cfihos-projection-accounting-v1'
    AND b.adapter_version = '1.0.0'
    AND b.source_layer_sha256 = c.source_layer_sha256
    AND b.normalized_projection_sha256 = c.normalized_projection_sha256
);

CREATE TEMP TABLE rdl0412_batch_context ON COMMIT DROP AS
SELECT
  b.accounting_batch_id,
  b.package_id
FROM rdl.rdl_projection_accounting_batch b
JOIN rdl0412_context c
  ON c.package_id = b.package_id
 AND c.source_layer_sha256 = b.source_layer_sha256
 AND c.normalized_projection_sha256 = b.normalized_projection_sha256
WHERE b.adapter_key = 'cfihos-projection-accounting-v1'
  AND b.adapter_version = '1.0.0';

CREATE UNIQUE INDEX rdl0412_batch_context_uidx
  ON rdl0412_batch_context(accounting_batch_id, package_id);

INSERT INTO rdl.rdl_source_projection_link (
  accounting_batch_id,
  package_id,
  source_record_id,
  projection_kind,
  entity_id,
  relationship_id,
  lineage_role,
  linkage_method,
  evidence
)
SELECT
  b.accounting_batch_id,
  b.package_id,
  s.source_record_id,
  s.projection_kind,
  s.entity_id,
  s.relationship_id,
  s.lineage_role,
  s.linkage_method,
  s.evidence
FROM rdl0412_batch_context b
CROSS JOIN rdl0412_projection_link_stage s
WHERE NOT EXISTS (
  SELECT 1
  FROM rdl.rdl_source_projection_link existing
  WHERE existing.accounting_batch_id = b.accounting_batch_id
    AND existing.source_record_id = s.source_record_id
    AND (
      (s.entity_id IS NOT NULL AND existing.entity_id = s.entity_id)
      OR
      (s.relationship_id IS NOT NULL AND existing.relationship_id = s.relationship_id)
    )
);

INSERT INTO rdl.rdl_source_projection_disposition (
  accounting_batch_id,
  package_id,
  source_record_id,
  disposition_status,
  reason_code,
  reason_detail,
  evidence
)
SELECT
  b.accounting_batch_id,
  b.package_id,
  s.source_record_id,
  s.disposition_status,
  s.reason_code,
  s.reason_detail,
  s.evidence
FROM rdl0412_batch_context b
CROSS JOIN rdl0412_disposition_stage s
WHERE NOT EXISTS (
  SELECT 1
  FROM rdl.rdl_source_projection_disposition existing
  WHERE existing.accounting_batch_id = b.accounting_batch_id
    AND existing.source_record_id = s.source_record_id
);

DO $rdl0412_persistent_check$
DECLARE
  v_batch_count integer;
  v_link_count integer;
  v_disposition_count integer;
  v_unaccounted_count integer;
  v_primary_object_count integer;
BEGIN
  SELECT count(*)::integer INTO v_batch_count FROM rdl0412_batch_context;

  SELECT count(*)::integer INTO v_link_count
  FROM rdl.rdl_source_projection_link l
  JOIN rdl0412_batch_context b
    ON b.accounting_batch_id = l.accounting_batch_id;

  SELECT count(*)::integer INTO v_disposition_count
  FROM rdl.rdl_source_projection_disposition d
  JOIN rdl0412_batch_context b
    ON b.accounting_batch_id = d.accounting_batch_id;

  SELECT count(*)::integer INTO v_primary_object_count
  FROM rdl.rdl_source_projection_link l
  JOIN rdl0412_batch_context b
    ON b.accounting_batch_id = l.accounting_batch_id
  WHERE l.lineage_role = 'primary';

  SELECT count(*)::integer INTO v_unaccounted_count
  FROM rdl0412_source_row s
  WHERE NOT EXISTS (
    SELECT 1
    FROM rdl.rdl_source_projection_link l
    JOIN rdl0412_batch_context b
      ON b.accounting_batch_id = l.accounting_batch_id
    WHERE l.source_record_id = s.source_record_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM rdl.rdl_source_projection_disposition d
    JOIN rdl0412_batch_context b
      ON b.accounting_batch_id = d.accounting_batch_id
    WHERE d.source_record_id = s.source_record_id
  );

  IF v_batch_count <> 1
     OR v_link_count <> 55866
     OR v_disposition_count <> 16982
     OR v_primary_object_count <> 53070
     OR v_unaccounted_count <> 0 THEN
    RAISE EXCEPTION
      'RDL-041.2 persistent accounting mismatch: batches %, links %, dispositions %, primary objects %, unaccounted %',
      v_batch_count,
      v_link_count,
      v_disposition_count,
      v_primary_object_count,
      v_unaccounted_count
      USING ERRCODE = '23514';
  END IF;
END;
$rdl0412_persistent_check$;

COMMIT;

SELECT
  'PASS RDL-041.2 projection accounting: '
  || b.source_record_count
  || ' source records / '
  || b.projection_link_count
  || ' lineage links / '
  || b.disposition_count
  || ' zero-output dispositions' AS result
FROM rdl.rdl_projection_accounting_batch b
JOIN rdl.rdl_package p ON p.package_id = b.package_id
WHERE p.package_key = :'package_key'
  AND b.adapter_key = 'cfihos-projection-accounting-v1'
  AND b.adapter_version = '1.0.0'
  AND b.source_layer_sha256 = :'source_layer_sha256'
  AND b.normalized_projection_sha256 = :'normalized_projection_sha256';
