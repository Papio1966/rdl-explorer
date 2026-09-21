BEGIN;

INSERT INTO rdl.schema_definition (
  package_id,
  source_record_id,
  native_identifier,
  concept_kind,
  section,
  entity_name,
  property_name,
  entity_attribute_name,
  definition,
  note_comment,
  example,
  requirement_status,
  format_specification,
  data_type_hint,
  presence_constraint,
  data_source,
  former_section,
  relationship_verb
)
SELECT
  sr.package_id,
  sr.source_record_id,
  COALESCE(NULLIF(BTRIM(sr.raw_row->>'CFIHOS unique code'), ''), 'source-record-' || sr.source_record_id::text),
  CASE
    WHEN LOWER(REGEXP_REPLACE(BTRIM(COALESCE(sr.raw_row->>'object','')), '[:[:space:]]+$', '', 'g')) IN ('entity','attribute','relationship','constraint')
      THEN LOWER(REGEXP_REPLACE(BTRIM(COALESCE(sr.raw_row->>'object','')), '[:[:space:]]+$', '', 'g'))
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
JOIN rdl.rdl_source_sheet ss
  ON ss.source_sheet_id=sr.source_sheet_id
 AND ss.package_id=sr.package_id
WHERE LOWER(BTRIM(ss.sheet_name))='data dictionary'
ON CONFLICT (package_id, source_record_id) DO NOTHING;

INSERT INTO rdl.schema_constraint (
  schema_definition_id,
  constraint_kind,
  constraint_value,
  normalized_value
)
SELECT
  sd.schema_definition_id,
  v.constraint_kind,
  v.constraint_value,
  v.normalized_value
FROM rdl.schema_definition sd
CROSS JOIN LATERAL (
  VALUES
    (
      'requirement_status'::text,
      sd.requirement_status,
      CASE WHEN sd.requirement_status IS NULL THEN '{}'::jsonb
           ELSE jsonb_build_object('normalized', LOWER(sd.requirement_status)) END
    ),
    (
      'format'::text,
      sd.format_specification,
      CASE WHEN sd.format_specification IS NULL THEN '{}'::jsonb
           ELSE jsonb_build_object('dataTypeHint', sd.data_type_hint) END
    ),
    (
      'presence'::text,
      sd.presence_constraint,
      '{}'::jsonb
    ),
    (
      'relationship'::text,
      sd.relationship_verb,
      '{}'::jsonb
    )
) AS v(constraint_kind, constraint_value, normalized_value)
WHERE v.constraint_value IS NOT NULL
ON CONFLICT (schema_definition_id, constraint_kind) DO NOTHING;

COMMIT;
