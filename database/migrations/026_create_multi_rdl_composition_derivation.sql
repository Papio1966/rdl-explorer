-- RDL-054: first-class multi-RDL target-layer composition and derivation provenance.
-- Additive only: no authoritative source entity, package, release or historical context is mutated.

CREATE TABLE IF NOT EXISTS rdl.entity_composition (
  composition_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_context_id bigint NOT NULL REFERENCES rdl.enterprise_context(context_id) ON DELETE RESTRICT,
  target_extension_change_id bigint NOT NULL UNIQUE REFERENCES rdl.context_extension_change(extension_change_id) ON DELETE RESTRICT,
  composition_kind text NOT NULL CHECK (composition_kind IN ('multi_source_merge','derived_copy','promotion')),
  rationale text NOT NULL CHECK (btrim(rationale) <> ''),
  created_by text NOT NULL CHECK (btrim(created_by) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rdl.entity_composition_contributor (
  composition_contributor_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  composition_id bigint NOT NULL REFERENCES rdl.entity_composition(composition_id) ON DELETE CASCADE,
  source_package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  source_entity_id bigint NOT NULL REFERENCES rdl.rdl_entity(entity_id) ON DELETE RESTRICT,
  contribution_role text NOT NULL DEFAULT 'contributor' CHECK (contribution_role IN ('primary','contributor','reference')),
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (composition_id, source_entity_id)
);

CREATE TABLE IF NOT EXISTS rdl.entity_composition_component_decision (
  composition_component_decision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  composition_id bigint NOT NULL REFERENCES rdl.entity_composition(composition_id) ON DELETE CASCADE,
  component_kind text NOT NULL CHECK (component_kind IN ('definition','hierarchy','property','attribute','document_type','discipline','information_requirement','relationship','controlled_value','unit_of_measure','other')),
  component_key text NOT NULL CHECK (btrim(component_key) <> ''),
  resolution text NOT NULL CHECK (resolution IN ('use_source','combine','target_override','keep_separate','exclude','reference_only')),
  selected_source_entity_id bigint REFERENCES rdl.rdl_entity(entity_id) ON DELETE RESTRICT,
  resolved_payload jsonb,
  rationale text NOT NULL CHECK (btrim(rationale) <> ''),
  decided_by text NOT NULL CHECK (btrim(decided_by) <> ''),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (composition_id, component_kind, component_key)
);

CREATE OR REPLACE FUNCTION rdl.enforce_entity_composition_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_extension_context bigint;
  v_context_type text;
BEGIN
  SELECT ch.context_id, c.context_type
    INTO v_extension_context, v_context_type
  FROM rdl.context_extension_change ch
  JOIN rdl.enterprise_context c ON c.context_id = ch.context_id
  WHERE ch.extension_change_id = NEW.target_extension_change_id;

  IF v_extension_context IS NULL THEN
    RAISE EXCEPTION 'composition target extension % does not exist', NEW.target_extension_change_id;
  END IF;
  IF v_extension_context <> NEW.target_context_id THEN
    RAISE EXCEPTION 'composition target context mismatch: extension %, composition %', v_extension_context, NEW.target_context_id;
  END IF;
  IF v_context_type NOT IN ('company','asset','project') THEN
    RAISE EXCEPTION 'composition target context must be company, asset or project; found %', v_context_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entity_composition_target ON rdl.entity_composition;
CREATE TRIGGER trg_entity_composition_target
BEFORE INSERT OR UPDATE OF target_context_id,target_extension_change_id ON rdl.entity_composition
FOR EACH ROW EXECUTE FUNCTION rdl.enforce_entity_composition_target();

CREATE OR REPLACE FUNCTION rdl.enforce_composition_contributor_package()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_package_id bigint;
BEGIN
  SELECT package_id INTO v_package_id FROM rdl.rdl_entity WHERE entity_id = NEW.source_entity_id;
  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'composition contributor source entity % does not exist', NEW.source_entity_id;
  END IF;
  IF v_package_id <> NEW.source_package_id THEN
    RAISE EXCEPTION 'composition contributor package mismatch: entity package %, supplied package %', v_package_id, NEW.source_package_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_composition_contributor_package ON rdl.entity_composition_contributor;
CREATE TRIGGER trg_composition_contributor_package
BEFORE INSERT OR UPDATE OF source_package_id,source_entity_id ON rdl.entity_composition_contributor
FOR EACH ROW EXECUTE FUNCTION rdl.enforce_composition_contributor_package();

CREATE OR REPLACE VIEW rdl.entity_composition_dependency AS
SELECT c.composition_id,
       c.composition_kind,
       c.target_context_id,
       c.target_extension_change_id,
       cc.source_entity_id,
       e.entity_type_code AS source_entity_type_code,
       e.native_identifier AS source_native_identifier,
       p.package_id AS source_package_id,
       p.package_key AS source_package_key,
       rel.release_id AS source_release_id,
       rel.release_key AS source_release_key,
       src.source_id,
       src.source_key
FROM rdl.entity_composition c
JOIN rdl.entity_composition_contributor cc ON cc.composition_id = c.composition_id
JOIN rdl.rdl_entity e ON e.entity_id = cc.source_entity_id
JOIN rdl.rdl_package p ON p.package_id = cc.source_package_id
JOIN rdl.rdl_release rel ON rel.release_id = p.release_id
JOIN rdl.rdl_source src ON src.source_id = rel.source_id;

CREATE OR REPLACE FUNCTION rdl.derived_compositions_impacted_by_release(p_release_id bigint)
RETURNS TABLE (
  composition_id bigint,
  target_context_id bigint,
  target_extension_change_id bigint,
  source_entity_id bigint,
  source_entity_type_code text,
  source_native_identifier text,
  source_package_id bigint,
  source_package_key text,
  source_release_id bigint,
  source_release_key text,
  source_key text
)
LANGUAGE sql
STABLE
AS $$
  SELECT d.composition_id,
         d.target_context_id,
         d.target_extension_change_id,
         d.source_entity_id,
         d.source_entity_type_code,
         d.source_native_identifier,
         d.source_package_id,
         d.source_package_key,
         d.source_release_id,
         d.source_release_key,
         d.source_key
  FROM rdl.entity_composition_dependency d
  WHERE d.source_release_id = p_release_id
  ORDER BY d.composition_id, d.source_entity_id;
$$;

CREATE OR REPLACE VIEW rdl.upward_promotion_candidate AS
SELECT ch.extension_change_id,
       ch.context_id AS source_context_id,
       c.context_key AS source_context_key,
       c.context_type AS source_context_type,
       c.parent_context_id AS target_context_id,
       parent.context_key AS target_context_key,
       parent.context_type AS target_context_type,
       ch.entity_type_code,
       ch.native_identifier,
       ch.proposed_name,
       ch.approved_at
FROM rdl.context_extension_change ch
JOIN rdl.enterprise_context c ON c.context_id = ch.context_id
JOIN rdl.enterprise_context parent ON parent.context_id = c.parent_context_id
WHERE ch.status = 'approved'
  AND c.context_type IN ('project','asset');

COMMENT ON TABLE rdl.entity_composition IS 'First-class derivation record for a new governed target-layer entity composed from exact source entity versions. Source RDL entities remain immutable.';
COMMENT ON TABLE rdl.entity_composition_contributor IS 'Exact source package/entity contributors retained for target-layer derivation provenance and future source-upgrade impact.';
COMMENT ON TABLE rdl.entity_composition_component_decision IS 'Auditable component-level resolution across definitions, hierarchy, properties, documents, disciplines, requirements and relationships.';
COMMENT ON VIEW rdl.entity_composition_dependency IS 'Read-only dependency projection used to identify derived target-layer objects impacted by a changed upstream source release.';
COMMENT ON VIEW rdl.upward_promotion_candidate IS 'Advisory approved Project/Asset extension candidates for possible upward promotion; no automatic promotion is performed.';
