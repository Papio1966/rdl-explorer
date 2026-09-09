-- RDL-045: RDL-compliant external proposal bundle contract.
-- Extends RDL-044 with atomic multi-component bundles and dependency closure.

CREATE TABLE IF NOT EXISTS rdl.external_standards_proposal_bundle (
  proposal_bundle_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_proposal_id bigint NOT NULL UNIQUE REFERENCES rdl.external_standards_proposal(external_proposal_id) ON DELETE RESTRICT,
  source_system text NOT NULL CHECK (length(btrim(source_system)) > 0),
  external_request_key text NOT NULL CHECK (length(btrim(external_request_key)) > 0),
  source_bundle_key text NOT NULL CHECK (length(btrim(source_bundle_key)) > 0),
  source_pse_id text,
  source_pse_content_hash text CHECK (source_pse_content_hash IS NULL OR source_pse_content_hash ~ '^[0-9A-Fa-f]{64}$'),
  bundle_sha256 text NOT NULL CHECK (bundle_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  source_level text NOT NULL CHECK (source_level IN ('project','asset','company','industry','unknown')),
  target_level text NOT NULL CHECK (target_level IN ('project','asset','company','industry')),
  target_context_key text NOT NULL CHECK (length(btrim(target_context_key)) > 0),
  parent_package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  bundle_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(bundle_payload) = 'object'),
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_evidence) = 'object'),
  validation_status text NOT NULL DEFAULT 'received' CHECK (validation_status IN ('received','schema_validated','invalid')),
  completeness_status text NOT NULL DEFAULT 'incomplete_candidate' CHECK (completeness_status IN ('complete','incomplete_candidate')),
  component_count integer NOT NULL DEFAULT 0 CHECK (component_count >= 0),
  dependency_count integer NOT NULL DEFAULT 0 CHECK (dependency_count >= 0),
  missing_dependency_count integer NOT NULL DEFAULT 0 CHECK (missing_dependency_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_request_key)
);

CREATE INDEX IF NOT EXISTS idx_external_proposal_bundle_status ON rdl.external_standards_proposal_bundle(validation_status, completeness_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_proposal_bundle_target ON rdl.external_standards_proposal_bundle(target_context_key, target_level, parent_package_id);

CREATE TABLE IF NOT EXISTS rdl.external_standards_proposal_bundle_component (
  proposal_bundle_component_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_bundle_id bigint NOT NULL REFERENCES rdl.external_standards_proposal_bundle(proposal_bundle_id) ON DELETE CASCADE,
  component_key text NOT NULL CHECK (length(btrim(component_key)) > 0),
  component_kind text NOT NULL CHECK (component_kind IN ('object_delta','relationship_delta','existing_reference','dependency_declaration')),
  component_action text NOT NULL CHECK (component_action IN ('add','override','retire','reference','relationship_delta')),
  entity_type_code text NOT NULL CHECK (length(btrim(entity_type_code)) > 0),
  native_identifier text NOT NULL CHECK (length(btrim(native_identifier)) > 0),
  component_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(component_payload) = 'object'),
  required_fields_missing jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_fields_missing) = 'array'),
  component_status text NOT NULL DEFAULT 'complete' CHECK (component_status IN ('complete','incomplete_candidate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_bundle_id, component_key)
);

CREATE INDEX IF NOT EXISTS idx_external_proposal_bundle_component_identity ON rdl.external_standards_proposal_bundle_component(proposal_bundle_id, entity_type_code, native_identifier);

CREATE TABLE IF NOT EXISTS rdl.external_standards_proposal_bundle_dependency (
  proposal_bundle_dependency_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_bundle_id bigint NOT NULL REFERENCES rdl.external_standards_proposal_bundle(proposal_bundle_id) ON DELETE CASCADE,
  dependency_key text NOT NULL CHECK (length(btrim(dependency_key)) > 0),
  source_component_key text NOT NULL CHECK (length(btrim(source_component_key)) > 0),
  dependency_type text NOT NULL CHECK (length(btrim(dependency_type)) > 0),
  required boolean NOT NULL DEFAULT true,
  satisfied_by text NOT NULL CHECK (satisfied_by IN ('bundle_component','existing_governed_object','missing','not_applicable')),
  target_component_key text,
  target_entity_type_code text,
  target_native_identifier text,
  satisfaction_detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(satisfaction_detail) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_bundle_id, dependency_key)
);

CREATE INDEX IF NOT EXISTS idx_external_proposal_bundle_dependency_status ON rdl.external_standards_proposal_bundle_dependency(proposal_bundle_id, required, satisfied_by);

CREATE TABLE IF NOT EXISTS rdl.external_standards_proposal_bundle_event (
  proposal_bundle_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_bundle_id bigint NOT NULL REFERENCES rdl.external_standards_proposal_bundle(proposal_bundle_id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('submit','validate','start_review','accept','reject','withdraw','link_publication')),
  actor_key text NOT NULL CHECK (length(btrim(actor_key)) > 0),
  rationale text NOT NULL DEFAULT '',
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_payload) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_proposal_bundle_event_bundle ON rdl.external_standards_proposal_bundle_event(proposal_bundle_id, proposal_bundle_event_id);

CREATE OR REPLACE FUNCTION rdl.prevent_external_proposal_bundle_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'external proposal bundle events are append-only';
END $$;

DROP TRIGGER IF EXISTS trg_external_proposal_bundle_event_immutable ON rdl.external_standards_proposal_bundle_event;
CREATE TRIGGER trg_external_proposal_bundle_event_immutable
BEFORE UPDATE OR DELETE ON rdl.external_standards_proposal_bundle_event
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_external_proposal_bundle_event_mutation();

CREATE OR REPLACE FUNCTION rdl.submit_external_standards_proposal_bundle(
  p_consumer_key text,
  p_request_key text,
  p_bundle_sha256 text,
  p_proposer_key text,
  p_source_system text,
  p_source_level text,
  p_target_level text,
  p_target_context_key text,
  p_parent_package_id bigint,
  p_bundle_payload jsonb,
  p_source_evidence jsonb,
  p_rationale text,
  p_promotion_target_level text DEFAULT NULL,
  p_promotion_target_context_key text DEFAULT NULL
) RETURNS rdl.external_standards_proposal_bundle
LANGUAGE plpgsql AS $$
DECLARE
  v_existing rdl.external_standards_proposal_bundle%ROWTYPE;
  v_proposal rdl.external_standards_proposal%ROWTYPE;
  v_bundle rdl.external_standards_proposal_bundle%ROWTYPE;
  v_components jsonb;
  v_dependencies jsonb;
  v_source_bundle_key text;
  v_source_pse_id text;
  v_source_pse_content_hash text;
  v_component_count integer;
  v_dependency_count integer;
  v_missing_count integer;
  v_root_entity_type text;
  v_root_native_identifier text;
BEGIN
  IF length(btrim(coalesce(p_consumer_key,''))) = 0 THEN RAISE EXCEPTION 'consumer_key is required'; END IF;
  IF length(btrim(coalesce(p_request_key,''))) = 0 THEN RAISE EXCEPTION 'request_key is required'; END IF;
  IF lower(coalesce(p_bundle_sha256,'')) !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'bundle_sha256 must be a 64 character SHA-256'; END IF;
  IF coalesce(jsonb_typeof(p_bundle_payload),'null') <> 'object' THEN RAISE EXCEPTION 'bundle_payload must be a JSON object'; END IF;

  SELECT * INTO v_existing FROM rdl.external_standards_proposal_bundle
  WHERE source_system = btrim(p_source_system) AND external_request_key = btrim(p_request_key);
  IF FOUND THEN
    IF lower(v_existing.bundle_sha256) <> lower(p_bundle_sha256) THEN
      RAISE EXCEPTION 'idempotency conflict for source system % request %', p_source_system, p_request_key;
    END IF;
    RETURN v_existing;
  END IF;

  v_components := coalesce(p_bundle_payload->'components', '[]'::jsonb);
  v_dependencies := coalesce(p_bundle_payload->'dependencies', '[]'::jsonb);
  IF jsonb_typeof(v_components) <> 'array' THEN RAISE EXCEPTION 'bundle_payload.components must be an array'; END IF;
  IF jsonb_typeof(v_dependencies) <> 'array' THEN RAISE EXCEPTION 'bundle_payload.dependencies must be an array'; END IF;
  v_component_count := jsonb_array_length(v_components);
  v_dependency_count := jsonb_array_length(v_dependencies);
  IF v_component_count = 0 THEN RAISE EXCEPTION 'proposal bundle requires at least one component'; END IF;

  v_source_bundle_key := coalesce(nullif(btrim(p_bundle_payload->>'bundleKey'), ''), nullif(btrim(p_bundle_payload->>'bundle_key'), ''), btrim(p_request_key));
  v_source_pse_id := nullif(btrim(coalesce(p_bundle_payload->>'sourcePseId', p_bundle_payload->>'source_pse_id', '')), '');
  v_source_pse_content_hash := nullif(btrim(coalesce(p_bundle_payload->>'sourcePseContentHash', p_bundle_payload->>'source_pse_content_hash', '')), '');
  v_root_entity_type := coalesce(nullif(btrim(p_bundle_payload->>'rootEntityTypeCode'), ''), nullif(btrim(p_bundle_payload->>'root_entity_type_code'), ''), 'proposal_bundle');
  v_root_native_identifier := coalesce(nullif(btrim(p_bundle_payload->>'rootNativeIdentifier'), ''), nullif(btrim(p_bundle_payload->>'root_native_identifier'), ''), btrim(p_request_key));

  SELECT * INTO v_proposal FROM rdl.submit_external_standards_proposal(
    p_consumer_key, p_request_key, lower(p_bundle_sha256), p_proposer_key, p_source_system,
    p_source_level, p_target_level, p_target_context_key, p_parent_package_id,
    'relationship_delta', v_root_entity_type, v_root_native_identifier,
    p_bundle_payload, p_source_evidence, p_rationale, p_promotion_target_level, p_promotion_target_context_key
  );

  INSERT INTO rdl.external_standards_proposal_bundle(
    external_proposal_id, source_system, external_request_key, source_bundle_key,
    source_pse_id, source_pse_content_hash, bundle_sha256, source_level, target_level,
    target_context_key, parent_package_id, bundle_payload, source_evidence, component_count, dependency_count
  ) VALUES (
    v_proposal.external_proposal_id, btrim(p_source_system), btrim(p_request_key), v_source_bundle_key,
    v_source_pse_id, v_source_pse_content_hash, lower(p_bundle_sha256), p_source_level, p_target_level,
    btrim(p_target_context_key), p_parent_package_id, p_bundle_payload, coalesce(p_source_evidence,'{}'::jsonb), v_component_count, v_dependency_count
  ) RETURNING * INTO v_bundle;

  INSERT INTO rdl.external_standards_proposal_bundle_component(
    proposal_bundle_id, component_key, component_kind, component_action,
    entity_type_code, native_identifier, component_payload, required_fields_missing, component_status
  )
  SELECT
    v_bundle.proposal_bundle_id,
    btrim(coalesce(item.value->>'componentKey', item.value->>'component_key')),
    coalesce(nullif(btrim(coalesce(item.value->>'componentKind', item.value->>'component_kind', '')), ''), 'object_delta'),
    coalesce(nullif(btrim(coalesce(item.value->>'action', item.value->>'component_action', '')), ''), 'add'),
    btrim(coalesce(item.value->>'entityTypeCode', item.value->>'entity_type_code')),
    btrim(coalesce(item.value->>'nativeIdentifier', item.value->>'native_identifier')),
    coalesce(item.value->'payload', item.value->'component_payload', '{}'::jsonb),
    coalesce(item.value->'requiredFieldsMissing', item.value->'required_fields_missing', '[]'::jsonb),
    CASE WHEN jsonb_array_length(coalesce(item.value->'requiredFieldsMissing', item.value->'required_fields_missing', '[]'::jsonb)) > 0 THEN 'incomplete_candidate' ELSE 'complete' END
  FROM jsonb_array_elements(v_components) AS item(value);

  WITH raw_dependency AS (
    SELECT
      item.value,
      btrim(coalesce(item.value->>'dependencyKey', item.value->>'dependency_key')) AS dependency_key,
      btrim(coalesce(item.value->>'sourceComponentKey', item.value->>'source_component_key')) AS source_component_key,
      coalesce(nullif(btrim(coalesce(item.value->>'dependencyType', item.value->>'dependency_type', '')), ''), 'semantic_dependency') AS dependency_type,
      coalesce((item.value->>'required')::boolean, true) AS required,
      nullif(btrim(coalesce(item.value->>'targetComponentKey', item.value->>'target_component_key', '')), '') AS target_component_key,
      nullif(btrim(coalesce(item.value->>'targetEntityTypeCode', item.value->>'target_entity_type_code', '')), '') AS target_entity_type_code,
      nullif(btrim(coalesce(item.value->>'targetNativeIdentifier', item.value->>'target_native_identifier', '')), '') AS target_native_identifier
    FROM jsonb_array_elements(v_dependencies) AS item(value)
  ), resolved_dependency AS (
    SELECT d.*,
      CASE
        WHEN NOT d.required THEN 'not_applicable'
        WHEN d.target_component_key IS NOT NULL AND EXISTS (
          SELECT 1 FROM rdl.external_standards_proposal_bundle_component c WHERE c.proposal_bundle_id = v_bundle.proposal_bundle_id AND c.component_key = d.target_component_key
        ) THEN 'bundle_component'
        WHEN d.target_entity_type_code IS NOT NULL AND d.target_native_identifier IS NOT NULL AND EXISTS (
          SELECT 1 FROM rdl.rdl_entity e WHERE e.package_id = p_parent_package_id AND e.entity_type_code = d.target_entity_type_code AND e.native_identifier = d.target_native_identifier
        ) THEN 'existing_governed_object'
        ELSE 'missing'
      END AS resolved_by
    FROM raw_dependency d
  )
  INSERT INTO rdl.external_standards_proposal_bundle_dependency(
    proposal_bundle_id, dependency_key, source_component_key, dependency_type, required,
    satisfied_by, target_component_key, target_entity_type_code, target_native_identifier, satisfaction_detail
  )
  SELECT v_bundle.proposal_bundle_id, dependency_key, source_component_key, dependency_type, required,
         resolved_by, target_component_key, target_entity_type_code, target_native_identifier,
         jsonb_build_object('resolvedBy', resolved_by)
  FROM resolved_dependency;

  SELECT count(*)::integer INTO v_missing_count FROM rdl.external_standards_proposal_bundle_dependency
  WHERE proposal_bundle_id = v_bundle.proposal_bundle_id AND required AND satisfied_by = 'missing';

  UPDATE rdl.external_standards_proposal_bundle
  SET validation_status = 'schema_validated',
      completeness_status = CASE WHEN v_missing_count = 0 THEN 'complete' ELSE 'incomplete_candidate' END,
      missing_dependency_count = v_missing_count,
      updated_at = now()
  WHERE proposal_bundle_id = v_bundle.proposal_bundle_id
  RETURNING * INTO v_bundle;

  INSERT INTO rdl.external_standards_proposal_bundle_event(proposal_bundle_id, action, actor_key, rationale, event_payload) VALUES
    (v_bundle.proposal_bundle_id, 'submit', btrim(p_proposer_key), btrim(p_rationale), jsonb_build_object('sourceSystem', p_source_system, 'externalRequestKey', p_request_key)),
    (v_bundle.proposal_bundle_id, 'validate', btrim(p_proposer_key), 'Dependency closure validation completed.', jsonb_build_object('completenessStatus', v_bundle.completeness_status, 'missingDependencyCount', v_missing_count));

  RETURN v_bundle;
END $$;

CREATE OR REPLACE FUNCTION rdl.review_external_standards_proposal_bundle(
  p_proposal_bundle_id bigint,
  p_action text,
  p_actor_key text,
  p_rationale text,
  p_expected_version integer,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_publication_result jsonb DEFAULT '{}'::jsonb
) RETURNS rdl.external_standards_proposal_bundle
LANGUAGE plpgsql AS $$
DECLARE
  v_bundle rdl.external_standards_proposal_bundle%ROWTYPE;
  v_proposal rdl.external_standards_proposal%ROWTYPE;
BEGIN
  SELECT * INTO v_bundle FROM rdl.external_standards_proposal_bundle WHERE proposal_bundle_id = p_proposal_bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'external proposal bundle % not found', p_proposal_bundle_id; END IF;
  IF p_action = 'accept' AND v_bundle.completeness_status <> 'complete' THEN RAISE EXCEPTION 'incomplete proposal bundle cannot be accepted'; END IF;

  SELECT * INTO v_proposal FROM rdl.review_external_standards_proposal(
    v_bundle.external_proposal_id, p_action, p_actor_key, p_rationale, p_expected_version,
    coalesce(p_evidence,'{}'::jsonb), coalesce(p_publication_result,'{}'::jsonb)
  );

  UPDATE rdl.external_standards_proposal_bundle SET updated_at = now()
  WHERE proposal_bundle_id = p_proposal_bundle_id RETURNING * INTO v_bundle;

  INSERT INTO rdl.external_standards_proposal_bundle_event(proposal_bundle_id, action, actor_key, rationale, event_payload)
  VALUES (p_proposal_bundle_id, p_action, btrim(p_actor_key), btrim(p_rationale), jsonb_build_object('proposalStatus', v_proposal.proposal_status, 'reviewVersion', v_proposal.review_version));

  RETURN v_bundle;
END $$;

CREATE OR REPLACE VIEW rdl.external_standards_proposal_bundle_queue AS
SELECT b.proposal_bundle_id, p.external_proposal_id, p.proposal_key, p.consumer_key, p.request_key,
       b.source_system, b.external_request_key, b.source_bundle_key, b.source_pse_id,
       b.source_level, b.target_level, b.target_context_key, b.parent_package_id,
       pkg.package_key AS parent_package_key, b.bundle_sha256, b.validation_status,
       b.completeness_status, b.component_count, b.dependency_count, b.missing_dependency_count,
       p.proposal_status, p.review_version, p.reviewed_by, p.reviewed_at, b.created_at, b.updated_at
FROM rdl.external_standards_proposal_bundle b
JOIN rdl.external_standards_proposal p ON p.external_proposal_id = b.external_proposal_id
JOIN rdl.rdl_package pkg ON pkg.package_id = b.parent_package_id;

COMMENT ON TABLE rdl.external_standards_proposal_bundle IS 'Atomic RDL-compliant external proposal bundle for multi-component DataGate or consumer-originated standards proposals.';
COMMENT ON TABLE rdl.external_standards_proposal_bundle_component IS 'Component object, relationship or existing-reference delta within one atomic external proposal bundle.';
COMMENT ON TABLE rdl.external_standards_proposal_bundle_dependency IS 'Dependency-closure evidence for proposal bundle components; required missing dependencies keep the bundle incomplete.';
COMMENT ON FUNCTION rdl.submit_external_standards_proposal_bundle IS 'Idempotent RDL-compliant bundle submission layered on the RDL-044 external proposal contract.';
COMMENT ON FUNCTION rdl.review_external_standards_proposal_bundle IS 'Governed review transition for proposal bundles; incomplete bundles cannot be accepted.';
