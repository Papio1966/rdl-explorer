\set ON_ERROR_STOP on
DO $$
DECLARE
  source_rows bigint;
  schema_rows bigint;
  orphan_rows bigint;
  constraint_rows bigint;
  known_rows bigint;
  entity_schema_types bigint;
BEGIN
  SELECT count(*) INTO source_rows
  FROM rdl.rdl_source_record sr
  JOIN rdl.rdl_source_sheet ss
    ON ss.source_sheet_id=sr.source_sheet_id
   AND ss.package_id=sr.package_id
  WHERE lower(btrim(ss.sheet_name))='data dictionary';

  SELECT count(*) INTO schema_rows FROM rdl.schema_definition;
  IF source_rows <= 0 THEN RAISE EXCEPTION 'No immutable Data Dictionary source rows are available'; END IF;
  IF schema_rows <> source_rows THEN
    RAISE EXCEPTION 'Schema definition count % differs from immutable Data Dictionary source count %', schema_rows, source_rows;
  END IF;

  SELECT count(*) INTO orphan_rows
  FROM rdl.schema_definition sd
  LEFT JOIN rdl.rdl_source_record sr
    ON sr.source_record_id=sd.source_record_id
   AND sr.package_id=sd.package_id
  WHERE sr.source_record_id IS NULL;
  IF orphan_rows <> 0 THEN RAISE EXCEPTION 'Schema definition provenance orphans=%', orphan_rows; END IF;

  SELECT count(*) INTO constraint_rows FROM rdl.schema_constraint;
  IF constraint_rows <= 0 THEN RAISE EXCEPTION 'No schema constraints were normalized'; END IF;

  SELECT count(*) INTO known_rows
  FROM rdl.schema_dictionary_projection
  WHERE source_key='cfihos'
    AND release_key='cfihos-2.0'
    AND native_identifier='CFIHOS-10000240'
    AND concept_kind='attribute'
    AND entity_name='site'
    AND property_name='measurement system code'
    AND requirement_status='Mandatory'
    AND format_specification='Text, max 10 characters'
    AND data_type_hint='text'
    AND presence_constraint='measurement system'
    AND relationship_verb='is used by default at';
  IF known_rows <> 1 THEN RAISE EXCEPTION 'Known CFIHOS schema anchor did not normalize exactly once'; END IF;

  SELECT count(*) INTO entity_schema_types
  FROM rdl.rdl_entity
  WHERE entity_type_code IN ('schema_definition','schema_constraint','schema_attribute','schema_field');
  IF entity_schema_types <> 0 THEN
    RAISE EXCEPTION 'Schema semantics were incorrectly flattened into ordinary rdl_entity rows';
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM rdl.schema_definition) AS schema_definition_count,
  (SELECT count(*) FROM rdl.schema_constraint) AS schema_constraint_count,
  (SELECT count(*) FROM rdl.schema_definition WHERE concept_kind='entity') AS entity_concept_count,
  (SELECT count(*) FROM rdl.schema_definition WHERE concept_kind='attribute') AS attribute_concept_count,
  (SELECT count(*) FROM rdl.schema_definition WHERE requirement_status IS NOT NULL) AS requirement_status_count,
  (SELECT count(*) FROM rdl.schema_definition WHERE format_specification IS NOT NULL) AS format_count,
  (SELECT count(*) FROM rdl.schema_definition WHERE presence_constraint IS NOT NULL) AS presence_constraint_count,
  (SELECT count(*) FROM rdl.schema_definition WHERE relationship_verb IS NOT NULL) AS relationship_constraint_count;

SELECT 'PASS_RDL056_GENERIC_SCHEMA_DICTIONARY_DATABASE_CONTRACT' AS result;
