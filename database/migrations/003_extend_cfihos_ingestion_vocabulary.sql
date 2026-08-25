-- RDL-004: vocabulary required to preserve CFIHOS 2.0 semantics during ingestion.
-- This migration extends the generic RDL-003 registries; it does not load source data.

INSERT INTO rdl.entity_type (entity_type_code, display_name, description)
VALUES
  ('controlled_list', 'Controlled List', 'Named controlled-value/picklist definition.'),
  ('information_requirement', 'Information Requirement', 'Document/data requirement defined by a source RDL or source standard.'),
  ('handover_event', 'Handover Event', 'Information handover milestone or event.'),
  ('source_mapping', 'Source Mapping', 'Source-specific mapping record retained as a first-class entity when a binary relationship would lose context.')
ON CONFLICT (entity_type_code) DO NOTHING;

INSERT INTO rdl.relationship_type (relationship_type_code, display_name, description)
VALUES
  ('controlled_list_value', 'Controlled List to Value', 'Associates a controlled list with one of its values.'),
  ('property_controlled_list', 'Property to Controlled List', 'Associates a property with its controlled list.'),
  ('tag_equipment_mapping', 'Tag Class to Equipment Class', 'Maps a tag class to an equipment class.'),
  ('information_requirement_class', 'Information Requirement to Class', 'Scopes an information requirement to a class.'),
  ('information_requirement_document', 'Information Requirement to Document Type', 'Associates an information requirement with a document type.'),
  ('information_requirement_standard', 'Information Requirement to Source Standard', 'Traces an information requirement to its source standard.'),
  ('information_requirement_discipline', 'Information Requirement to Discipline', 'Associates an information requirement with a discipline.'),
  ('property_source_standard', 'Property to Source Standard', 'Direct property-to-standard trace where binary semantics are sufficient.'),
  ('mapping_property', 'Mapping to Property', 'Associates a source mapping record with a property.'),
  ('mapping_standard', 'Mapping to Source Standard', 'Associates a source mapping record with its source standard.'),
  ('mapping_tag_class', 'Mapping to Tag Class', 'Associates a source mapping record with a matching tag-class identity.'),
  ('mapping_equipment_class', 'Mapping to Equipment Class', 'Associates a source mapping record with a matching equipment-class identity.')
ON CONFLICT (relationship_type_code) DO NOTHING;
