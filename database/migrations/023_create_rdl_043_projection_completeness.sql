-- RDL-043 Normalized Projection Completeness
-- Adds generic vocabulary and a semantic assessment ledger without altering the
-- lossless PostgreSQL source layer or the RDL-042 workbook runtime boundary.

INSERT INTO rdl.entity_type (entity_type_code, display_name, description)
VALUES
  ('external_identifier_system', 'External Identifier System', 'External coding or identifier system referenced by a governed RDL source artifact.'),
  ('external_identifier', 'External Identifier', 'Identifier value in an external coding system that is equivalent to or references a governed RDL entity.'),
  ('property_group', 'Property Group', 'Governed grouping of properties for a purpose, source standard, class or delivery context.'),
  ('grouping_purpose', 'Grouping Purpose', 'Purpose or decomposition context used to organize property groups.'),
  ('projection_exception', 'Projection Exception', 'Governed exception captured during semantic projection assessment without changing source evidence.')
ON CONFLICT (entity_type_code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

INSERT INTO rdl.relationship_type (relationship_type_code, display_name, description)
VALUES
  ('external_identifier_system_value', 'External Identifier System Value', 'Associates an external identifier value with its coding system.'),
  ('entity_equivalent_identifier', 'Entity Equivalent Identifier', 'Maps a governed RDL entity to an equivalent external identifier.'),
  ('property_group_purpose', 'Property Group Purpose', 'Associates a property group with its grouping purpose.'),
  ('property_group_source_standard', 'Property Group Source Standard', 'Associates a property group with the source standard that defines or uses it.'),
  ('property_group_class', 'Property Group Class', 'Associates a property group with a tag or equipment class.'),
  ('property_group_property', 'Property Group Property', 'Associates a property group with a property and assignment metadata.'),
  ('projection_exception_subject_class', 'Projection Exception Subject Class', 'Links a projection exception to the class referenced by the source row.'),
  ('projection_exception_document_type', 'Projection Exception Document Type', 'Links a projection exception to the document type referenced by the source row.'),
  ('projection_exception_source_standard', 'Projection Exception Source Standard', 'Links a projection exception to the source standard referenced by the source row.'),
  ('projection_exception_external_identifier', 'Projection Exception External Identifier', 'Links a projection exception to an external identifier involved in the unresolved mapping.')
ON CONFLICT (relationship_type_code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS rdl.rdl_source_semantic_assessment (
  semantic_assessment_id bigserial PRIMARY KEY,
  accounting_batch_id bigint NOT NULL REFERENCES rdl.rdl_projection_accounting_batch(accounting_batch_id) ON DELETE RESTRICT,
  package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  source_record_id bigint NOT NULL,
  semantic_decision text NOT NULL CHECK (semantic_decision IN (
    'NORMALIZE',
    'CONTRIBUTING_ONLY',
    'SOURCE_ONLY',
    'NOT_APPLICABLE',
    'UNRESOLVED',
    'DEFER_WITH_REASON'
  )),
  semantic_completeness_status text NOT NULL CHECK (semantic_completeness_status IN (
    'not_assessed',
    'normalized',
    'contributing_only',
    'source_only',
    'not_applicable',
    'unresolved',
    'deferred_with_reason'
  )),
  reason_code text NOT NULL,
  reason_detail text NOT NULL DEFAULT '',
  assessment_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (accounting_batch_id, source_record_id),
  FOREIGN KEY (source_record_id, package_id)
    REFERENCES rdl.rdl_source_record(source_record_id, package_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_rdl_source_semantic_assessment_batch
  ON rdl.rdl_source_semantic_assessment(accounting_batch_id, semantic_decision, reason_code);

CREATE INDEX IF NOT EXISTS idx_rdl_source_semantic_assessment_source_record
  ON rdl.rdl_source_semantic_assessment(source_record_id);

CREATE OR REPLACE FUNCTION rdl.reject_rdl_source_semantic_assessment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'RDL source semantic assessment evidence is immutable';
END
$$;

DROP TRIGGER IF EXISTS rdl_source_semantic_assessment_immutable_ud
  ON rdl.rdl_source_semantic_assessment;

CREATE TRIGGER rdl_source_semantic_assessment_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.rdl_source_semantic_assessment
FOR EACH ROW EXECUTE FUNCTION rdl.reject_rdl_source_semantic_assessment_mutation();

CREATE OR REPLACE VIEW rdl.rdl_source_projection_accounting AS
WITH current_batch AS (
  SELECT DISTINCT ON (b.package_id)
    b.accounting_batch_id,
    b.package_id,
    b.adapter_key,
    b.adapter_version,
    b.source_content_sha256,
    b.source_layer_sha256,
    b.normalized_projection_sha256,
    b.source_record_count,
    b.normalized_entity_count,
    b.normalized_relationship_count,
    b.projection_link_count,
    b.projected_source_record_count,
    b.disposition_count,
    b.summary,
    b.completed_at
  FROM rdl.rdl_projection_accounting_batch b
  ORDER BY b.package_id, b.completed_at DESC, b.accounting_batch_id DESC
), link_counts AS (
  SELECT
    l.accounting_batch_id,
    l.source_record_id,
    count(*) FILTER (WHERE l.projection_kind = 'entity')::integer AS entity_link_count,
    count(*) FILTER (WHERE l.projection_kind = 'relationship')::integer AS relationship_link_count,
    count(*) FILTER (WHERE l.lineage_role = 'primary')::integer AS primary_link_count,
    count(*) FILTER (WHERE l.lineage_role = 'contributing')::integer AS contributing_link_count
  FROM rdl.rdl_source_projection_link l
  JOIN current_batch b ON b.accounting_batch_id = l.accounting_batch_id
  GROUP BY l.accounting_batch_id, l.source_record_id
)
SELECT
  b.accounting_batch_id,
  sr.package_id,
  ss.source_sheet_id,
  ss.sheet_name,
  ss.sheet_order,
  sr.source_record_id,
  sr.source_row_number,
  sr.record_order,
  COALESCE(lc.entity_link_count, 0) AS entity_link_count,
  COALESCE(lc.relationship_link_count, 0) AS relationship_link_count,
  COALESCE(lc.primary_link_count, 0) AS primary_link_count,
  COALESCE(lc.contributing_link_count, 0) AS contributing_link_count,
  (COALESCE(lc.entity_link_count, 0) + COALESCE(lc.relationship_link_count, 0)) AS total_projection_link_count,
  CASE
    WHEN lc.source_record_id IS NOT NULL THEN 'projected'::text
    WHEN d.projection_disposition_id IS NOT NULL THEN d.disposition_status
    ELSE 'unaccounted'::text
  END AS projection_status,
  CASE
    WHEN lc.source_record_id IS NOT NULL THEN NULL::text
    ELSE d.reason_code
  END AS reason_code,
  CASE
    WHEN lc.source_record_id IS NOT NULL THEN NULL::text
    ELSE d.reason_detail
  END AS reason_detail,
  COALESCE(a.semantic_completeness_status, 'not_assessed'::text) AS semantic_completeness_status,
  sr.row_sha256,
  sr.raw_row
FROM current_batch b
JOIN rdl.rdl_source_record sr ON sr.package_id = b.package_id
JOIN rdl.rdl_source_sheet ss
  ON ss.source_sheet_id = sr.source_sheet_id
 AND ss.package_id = sr.package_id
LEFT JOIN link_counts lc
  ON lc.accounting_batch_id = b.accounting_batch_id
 AND lc.source_record_id = sr.source_record_id
LEFT JOIN rdl.rdl_source_projection_disposition d
  ON d.accounting_batch_id = b.accounting_batch_id
 AND d.source_record_id = sr.source_record_id
LEFT JOIN rdl.rdl_source_semantic_assessment a
  ON a.accounting_batch_id = b.accounting_batch_id
 AND a.source_record_id = sr.source_record_id;

COMMENT ON TABLE rdl.rdl_source_semantic_assessment IS 'RDL-043 immutable semantic assessment ledger. Projection links answer what normalized objects exist; this table records whether each source row was normalized, intentionally source-only, contributing-only, not applicable, unresolved or deferred with reason.';
COMMENT ON VIEW rdl.rdl_source_projection_accounting IS 'Current source projection accounting view with RDL-043 semantic-completeness status when an assessment exists for the current accounting batch.';
