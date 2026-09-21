CREATE TABLE IF NOT EXISTS rdl.schema_definition (
  schema_definition_id bigserial PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  source_record_id bigint NOT NULL,
  native_identifier text NOT NULL,
  concept_kind text NOT NULL,
  section text,
  entity_name text,
  property_name text,
  entity_attribute_name text,
  definition text,
  note_comment text,
  example text,
  requirement_status text,
  format_specification text,
  data_type_hint text,
  presence_constraint text,
  data_source text,
  former_section text,
  relationship_verb text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schema_definition_source_record_fk
    FOREIGN KEY (source_record_id, package_id)
    REFERENCES rdl.rdl_source_record(source_record_id, package_id)
    ON DELETE RESTRICT,
  CONSTRAINT schema_definition_concept_kind_ck
    CHECK (concept_kind IN ('entity','attribute','relationship','constraint','unknown')),
  CONSTRAINT schema_definition_package_source_uidx
    UNIQUE (package_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_schema_definition_package_kind
  ON rdl.schema_definition(package_id, concept_kind);
CREATE INDEX IF NOT EXISTS idx_schema_definition_native_identifier
  ON rdl.schema_definition(native_identifier);
CREATE INDEX IF NOT EXISTS idx_schema_definition_entity_name_lower
  ON rdl.schema_definition(lower(entity_name));
CREATE INDEX IF NOT EXISTS idx_schema_definition_property_name_lower
  ON rdl.schema_definition(lower(property_name));

CREATE TABLE IF NOT EXISTS rdl.schema_constraint (
  schema_constraint_id bigserial PRIMARY KEY,
  schema_definition_id bigint NOT NULL REFERENCES rdl.schema_definition(schema_definition_id) ON DELETE CASCADE,
  constraint_kind text NOT NULL,
  constraint_value text NOT NULL,
  normalized_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schema_constraint_kind_ck
    CHECK (constraint_kind IN ('requirement_status','format','presence','relationship')),
  CONSTRAINT schema_constraint_definition_kind_uidx
    UNIQUE (schema_definition_id, constraint_kind)
);

CREATE INDEX IF NOT EXISTS idx_schema_constraint_kind
  ON rdl.schema_constraint(constraint_kind, schema_definition_id);

CREATE OR REPLACE FUNCTION rdl.prevent_schema_dictionary_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'RDL schema dictionary projection is immutable; rebuild from immutable source records instead.';
END;
$$;

DROP TRIGGER IF EXISTS schema_definition_immutable_ud ON rdl.schema_definition;
CREATE TRIGGER schema_definition_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.schema_definition
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_schema_dictionary_mutation();

DROP TRIGGER IF EXISTS schema_constraint_immutable_ud ON rdl.schema_constraint;
CREATE TRIGGER schema_constraint_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.schema_constraint
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_schema_dictionary_mutation();

CREATE OR REPLACE VIEW rdl.schema_dictionary_projection AS
SELECT
  sd.schema_definition_id,
  s.source_key,
  s.name AS source_name,
  r.release_key,
  r.version_label,
  r.release_status,
  p.package_id,
  p.package_key,
  sd.source_record_id,
  sr.source_row_number,
  sr.row_sha256,
  sd.native_identifier,
  sd.concept_kind,
  sd.section,
  sd.entity_name,
  sd.property_name,
  sd.entity_attribute_name,
  sd.definition,
  sd.note_comment,
  sd.example,
  sd.requirement_status,
  sd.format_specification,
  sd.data_type_hint,
  sd.presence_constraint,
  sd.data_source,
  sd.former_section,
  sd.relationship_verb,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'kind', sc.constraint_kind,
        'value', sc.constraint_value,
        'normalized', sc.normalized_value
      )
      ORDER BY sc.constraint_kind
    )
    FROM rdl.schema_constraint sc
    WHERE sc.schema_definition_id=sd.schema_definition_id
  ), '[]'::jsonb) AS constraints
FROM rdl.schema_definition sd
JOIN rdl.rdl_source_record sr ON sr.source_record_id=sd.source_record_id AND sr.package_id=sd.package_id
JOIN rdl.rdl_package p ON p.package_id=sd.package_id
JOIN rdl.rdl_release r ON r.release_id=p.release_id
JOIN rdl.rdl_source s ON s.source_id=r.source_id;
