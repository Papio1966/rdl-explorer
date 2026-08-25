-- RDL-010: governed cross-RDL intelligence model.
-- Cross-RDL mappings are explicitly derived/curated and are never source-authoritative relationships.

CREATE TABLE IF NOT EXISTS rdl.cross_rdl_mapping (
  mapping_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_entity_id bigint NOT NULL REFERENCES rdl.rdl_entity(entity_id) ON DELETE CASCADE,
  target_entity_id bigint NOT NULL REFERENCES rdl.rdl_entity(entity_id) ON DELETE CASCADE,
  mapping_type text NOT NULL CHECK (mapping_type IN ('equivalent','broader','narrower','related','possible_match','no_match')),
  provenance_method text NOT NULL CHECK (provenance_method IN ('manual_curated','exact_name_rule','rule_derived','ai_suggested')),
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','rejected','retired')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  CHECK (source_entity_id <> target_entity_id),
  UNIQUE (source_entity_id, target_entity_id, mapping_type, provenance_method)
);

CREATE INDEX IF NOT EXISTS idx_cross_rdl_mapping_source ON rdl.cross_rdl_mapping(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_cross_rdl_mapping_target ON rdl.cross_rdl_mapping(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_cross_rdl_mapping_status ON rdl.cross_rdl_mapping(status, mapping_type);

COMMENT ON TABLE rdl.cross_rdl_mapping IS 'Derived or curated relationships between entities in different RDL packages. Never source-authoritative.';

CREATE OR REPLACE FUNCTION rdl.enforce_cross_rdl_mapping_sources()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_rdl_id bigint;
  target_rdl_id bigint;
BEGIN
  SELECT r.source_id INTO source_rdl_id
  FROM rdl.rdl_entity e JOIN rdl.rdl_package p ON p.package_id=e.package_id JOIN rdl.rdl_release r ON r.release_id=p.release_id
  WHERE e.entity_id=NEW.source_entity_id;
  SELECT r.source_id INTO target_rdl_id
  FROM rdl.rdl_entity e JOIN rdl.rdl_package p ON p.package_id=e.package_id JOIN rdl.rdl_release r ON r.release_id=p.release_id
  WHERE e.entity_id=NEW.target_entity_id;
  IF source_rdl_id IS NULL OR target_rdl_id IS NULL OR source_rdl_id=target_rdl_id THEN
    RAISE EXCEPTION 'cross_rdl_mapping must connect entities from different RDL sources';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cross_rdl_mapping_sources ON rdl.cross_rdl_mapping;
CREATE TRIGGER trg_cross_rdl_mapping_sources
BEFORE INSERT OR UPDATE OF source_entity_id, target_entity_id ON rdl.cross_rdl_mapping
FOR EACH ROW EXECUTE FUNCTION rdl.enforce_cross_rdl_mapping_sources();
