-- RDL-003: generic, provenance-aware RDL domain model.
-- No CFIHOS content is loaded by this migration.

CREATE TABLE IF NOT EXISTS rdl.entity_type (
  entity_type_code text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO rdl.entity_type (entity_type_code, display_name, description)
VALUES
  ('class', 'Class', 'Generic class when the source RDL does not distinguish class domains.'),
  ('tag_class', 'Tag Class', 'Tag-oriented engineering class.'),
  ('equipment_class', 'Equipment Class', 'Equipment-oriented engineering class.'),
  ('property', 'Property', 'Property or attribute definition.'),
  ('document_type', 'Document Type', 'Document or information deliverable type.'),
  ('unit_of_measure', 'Unit of Measure', 'Unit used to express a quantitative property.'),
  ('controlled_value', 'Controlled Value', 'Picklist or controlled-vocabulary value.'),
  ('source_standard', 'Source Standard', 'Standard or specification referenced by RDL content.'),
  ('discipline', 'Discipline', 'Engineering or information-management discipline.'),
  ('lifecycle_requirement', 'Lifecycle Requirement', 'Lifecycle-specific information requirement.')
ON CONFLICT (entity_type_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS rdl.relationship_type (
  relationship_type_code text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO rdl.relationship_type (relationship_type_code, display_name, description)
VALUES
  ('class_property', 'Class to Property', 'Assigns a property to a class.'),
  ('class_document', 'Class to Document Type', 'Associates a document requirement with a class.'),
  ('class_class', 'Class to Class', 'Relates one class to another class.'),
  ('property_unit', 'Property to Unit', 'Associates a property with an allowed/applicable unit.'),
  ('property_controlled_value', 'Property to Controlled Value', 'Associates a property with a controlled value.'),
  ('entity_source_standard', 'Entity to Source Standard', 'Traces an entity to a referenced source standard.'),
  ('document_discipline', 'Document Type to Discipline', 'Associates a document type with a discipline.'),
  ('entity_parent', 'Entity Parent', 'Represents hierarchy or specialization between entities.'),
  ('related_entity', 'Related Entity', 'Generic typed relationship for source-specific semantics.')
ON CONFLICT (relationship_type_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS rdl.rdl_source (
  source_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  publisher text,
  authoritative_uri text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rdl.rdl_release (
  release_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES rdl.rdl_source(source_id) ON DELETE RESTRICT,
  release_key text NOT NULL,
  version_label text NOT NULL,
  release_status text NOT NULL DEFAULT 'candidate'
    CHECK (release_status IN ('candidate', 'published', 'superseded', 'withdrawn')),
  published_at timestamptz,
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, release_key),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS rdl.rdl_package (
  package_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  release_id bigint NOT NULL REFERENCES rdl.rdl_release(release_id) ON DELETE RESTRICT,
  package_key text NOT NULL UNIQUE,
  package_kind text NOT NULL DEFAULT 'source'
    CHECK (package_kind IN ('source', 'normalized', 'effective')),
  package_status text NOT NULL DEFAULT 'staged'
    CHECK (package_status IN ('staged', 'validated', 'published', 'retired', 'rejected')),
  source_uri text,
  content_sha256 text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  published_at timestamptz,
  CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9A-Fa-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_rdl_release_source ON rdl.rdl_release(source_id);
CREATE INDEX IF NOT EXISTS idx_rdl_package_release ON rdl.rdl_package(release_id);

CREATE TABLE IF NOT EXISTS rdl.rdl_entity (
  entity_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  entity_type_code text NOT NULL REFERENCES rdl.entity_type(entity_type_code) ON DELETE RESTRICT,
  native_identifier text NOT NULL,
  name text NOT NULL,
  definition text,
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'deprecated', 'superseded', 'withdrawn')),
  is_authoritative boolean NOT NULL DEFAULT true,
  normalized_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, entity_type_code, native_identifier),
  UNIQUE (entity_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_rdl_entity_package_type ON rdl.rdl_entity(package_id, entity_type_code);
CREATE INDEX IF NOT EXISTS idx_rdl_entity_native_identifier ON rdl.rdl_entity(native_identifier);
CREATE INDEX IF NOT EXISTS idx_rdl_entity_name_lower ON rdl.rdl_entity(lower(name));

CREATE TABLE IF NOT EXISTS rdl.rdl_relationship (
  relationship_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  relationship_type_code text NOT NULL REFERENCES rdl.relationship_type(relationship_type_code) ON DELETE RESTRICT,
  source_entity_id bigint NOT NULL,
  target_entity_id bigint NOT NULL,
  relationship_status text NOT NULL DEFAULT 'active'
    CHECK (relationship_status IN ('active', 'deprecated', 'superseded', 'withdrawn')),
  is_authoritative boolean NOT NULL DEFAULT true,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_entity_id, package_id)
    REFERENCES rdl.rdl_entity(entity_id, package_id) ON DELETE RESTRICT,
  FOREIGN KEY (target_entity_id, package_id)
    REFERENCES rdl.rdl_entity(entity_id, package_id) ON DELETE RESTRICT,
  CHECK (source_entity_id <> target_entity_id),
  UNIQUE (package_id, relationship_type_code, source_entity_id, target_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rdl_relationship_source ON rdl.rdl_relationship(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_rdl_relationship_target ON rdl.rdl_relationship(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_rdl_relationship_package_type ON rdl.rdl_relationship(package_id, relationship_type_code);

CREATE TABLE IF NOT EXISTS ingestion.ingestion_run (
  ingestion_run_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  source_uri text,
  content_sha256 text,
  adapter_key text NOT NULL,
  adapter_version text,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'validated', 'completed', 'failed', 'rejected')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_run_package ON ingestion.ingestion_run(package_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_run_status ON ingestion.ingestion_run(status);

CREATE OR REPLACE VIEW rdl.entity_identity AS
SELECT
  e.entity_id,
  s.source_key,
  r.release_key,
  r.version_label,
  p.package_key,
  e.entity_type_code,
  e.native_identifier,
  e.name,
  e.lifecycle_status,
  e.is_authoritative,
  concat_ws(':', s.source_key, r.release_key, e.entity_type_code, e.native_identifier) AS logical_identity
FROM rdl.rdl_entity e
JOIN rdl.rdl_package p ON p.package_id = e.package_id
JOIN rdl.rdl_release r ON r.release_id = p.release_id
JOIN rdl.rdl_source s ON s.source_id = r.source_id;

COMMENT ON TABLE rdl.rdl_source IS 'Publisher/governance source for an RDL, distinct from workbook-level source standards.';
COMMENT ON TABLE rdl.rdl_release IS 'Governed release/version of an RDL source.';
COMMENT ON TABLE rdl.rdl_package IS 'Version-identified package representing source, normalized, or effective RDL content.';
COMMENT ON TABLE rdl.rdl_entity IS 'Generic source-aware entity. Native identifiers are unique only within package and entity type.';
COMMENT ON TABLE rdl.rdl_relationship IS 'First-class typed relationship between entities in the same package.';
COMMENT ON TABLE ingestion.ingestion_run IS 'Auditable ingestion execution retaining adapter and source provenance.';
