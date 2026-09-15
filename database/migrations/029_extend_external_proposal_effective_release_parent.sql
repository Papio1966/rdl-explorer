-- RDL-055R4: backward-compatible effective-release parent identity for external proposals.
-- Legacy raw-package parent mode remains valid. Effective-release mode points to one immutable
-- rdl.effective_standard_release and never collapses a multi-RDL release to one inherited package.

ALTER TABLE rdl.external_standards_proposal
  ALTER COLUMN parent_package_id DROP NOT NULL;
ALTER TABLE rdl.external_standards_proposal
  ADD COLUMN IF NOT EXISTS parent_effective_release_id bigint
    REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT;

ALTER TABLE rdl.external_standards_proposal_bundle
  ALTER COLUMN parent_package_id DROP NOT NULL;
ALTER TABLE rdl.external_standards_proposal_bundle
  ADD COLUMN IF NOT EXISTS parent_effective_release_id bigint
    REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'rdl.external_standards_proposal'::regclass
      AND conname = 'external_standards_proposal_exactly_one_parent'
  ) THEN
    ALTER TABLE rdl.external_standards_proposal
      ADD CONSTRAINT external_standards_proposal_exactly_one_parent
      CHECK (num_nonnulls(parent_package_id, parent_effective_release_id) = 1);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'rdl.external_standards_proposal_bundle'::regclass
      AND conname = 'external_standards_proposal_bundle_exactly_one_parent'
  ) THEN
    ALTER TABLE rdl.external_standards_proposal_bundle
      ADD CONSTRAINT external_standards_proposal_bundle_exactly_one_parent
      CHECK (num_nonnulls(parent_package_id, parent_effective_release_id) = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_external_standards_proposal_effective_parent
  ON rdl.external_standards_proposal(parent_effective_release_id)
  WHERE parent_effective_release_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_proposal_bundle_effective_parent
  ON rdl.external_standards_proposal_bundle(parent_effective_release_id)
  WHERE parent_effective_release_id IS NOT NULL;

-- Resolve existence against the exact immutable effective release projection. This is an
-- existence proof only; it does not equate same-name objects from different source packages.
CREATE OR REPLACE FUNCTION rdl.effective_release_contains_entity(
  p_effective_standard_release_id bigint,
  p_entity_type_code text,
  p_native_identifier text
) RETURNS boolean
LANGUAGE sql STABLE AS $$
WITH release_data AS (
  SELECT package_manifest, package_payload
  FROM rdl.effective_standard_release
  WHERE effective_standard_release_id = p_effective_standard_release_id
), pins AS (
  SELECT (pin.value->>'packageId')::bigint AS package_id
  FROM release_data r
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.package_manifest->'packagePins','[]'::jsonb)) pin(value)
  WHERE coalesce(pin.value->>'packageId','') ~ '^[0-9]+$'
), base AS (
  SELECT e.entity_id,e.entity_type_code,e.native_identifier
  FROM rdl.rdl_entity e
  JOIN pins p ON p.package_id=e.package_id
), changes AS (
  SELECT
    change.value->>'changeKind' AS change_kind,
    change.value->>'entityType' AS entity_type_code,
    change.value->>'nativeIdentifier' AS native_identifier,
    CASE WHEN coalesce(change.value->>'baseEntityId','') ~ '^[0-9]+$'
      THEN (change.value->>'baseEntityId')::bigint ELSE NULL END AS base_entity_id
  FROM release_data r
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.package_payload->'changes','[]'::jsonb)) change(value)
), live_base AS (
  SELECT b.entity_id
  FROM base b
  WHERE b.entity_type_code=p_entity_type_code
    AND b.native_identifier=p_native_identifier
    AND NOT EXISTS (
      SELECT 1 FROM changes c
      WHERE c.change_kind='retire'
        AND c.entity_type_code=b.entity_type_code
        AND c.native_identifier=b.native_identifier
        AND (
          c.base_entity_id=b.entity_id
          OR (
            c.base_entity_id IS NULL
            AND (SELECT count(*) FROM base bx
                 WHERE bx.entity_type_code=b.entity_type_code
                   AND bx.native_identifier=b.native_identifier)=1
          )
        )
    )
), live_extension AS (
  SELECT 1
  FROM changes c
  WHERE c.entity_type_code=p_entity_type_code
    AND c.native_identifier=p_native_identifier
    AND c.change_kind IN ('add','override')
)
SELECT EXISTS(SELECT 1 FROM live_base UNION ALL SELECT 1 FROM live_extension);
$$;

COMMENT ON FUNCTION rdl.effective_release_contains_entity(bigint,text,text) IS
  'RDL-055R4 exact effective-release dependency existence proof. It preserves package-aware source identities and performs no name-based equivalence.';

-- New overload. The original package-parent function remains present for legacy callers.
CREATE OR REPLACE FUNCTION rdl.submit_external_standards_proposal(
  p_consumer_key text,
  p_request_key text,
  p_proposal_sha256 text,
  p_proposer_key text,
  p_source_system text,
  p_source_level text,
  p_target_level text,
  p_target_context_key text,
  p_parent_package_id bigint,
  p_parent_effective_release_id bigint,
  p_change_kind text,
  p_entity_type_code text,
  p_native_identifier text,
  p_delta_payload jsonb,
  p_source_evidence jsonb,
  p_rationale text,
  p_promotion_target_level text DEFAULT NULL,
  p_promotion_target_context_key text DEFAULT NULL
) RETURNS rdl.external_standards_proposal
LANGUAGE plpgsql AS $$
DECLARE
  v_existing rdl.external_standards_proposal%ROWTYPE;
  v_created rdl.external_standards_proposal%ROWTYPE;
  v_proposal_key text;
  v_parent_context_key text;
  v_parent_context_type text;
  v_parent_release_key text;
  v_parent_release_version text;
  v_parent_composition_sha256 text;
  v_claimed_composition_sha256 text;
BEGIN
  IF length(btrim(coalesce(p_consumer_key,''))) = 0 THEN RAISE EXCEPTION 'consumer_key is required'; END IF;
  IF length(btrim(coalesce(p_request_key,''))) = 0 THEN RAISE EXCEPTION 'request_key is required'; END IF;
  IF p_proposal_sha256 IS NULL OR p_proposal_sha256 !~ '^[0-9A-Fa-f]{64}$' THEN RAISE EXCEPTION 'proposal_sha256 must be a SHA-256 hex string'; END IF;
  IF num_nonnulls(p_parent_package_id,p_parent_effective_release_id) <> 1 THEN
    RAISE EXCEPTION 'exactly one parent identity is required: parent package XOR parent effective release';
  END IF;

  IF p_parent_package_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM rdl.rdl_package WHERE package_id=p_parent_package_id) THEN
      RAISE EXCEPTION 'parent package % does not exist',p_parent_package_id;
    END IF;
  ELSE
    SELECT c.context_key,c.context_type,r.release_key,r.release_version,r.composition_sha256
    INTO v_parent_context_key,v_parent_context_type,v_parent_release_key,v_parent_release_version,v_parent_composition_sha256
    FROM rdl.effective_standard_release r
    JOIN rdl.enterprise_context c ON c.context_id=r.context_id
    WHERE r.effective_standard_release_id=p_parent_effective_release_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'parent effective release % does not exist',p_parent_effective_release_id; END IF;
    IF v_parent_context_key <> btrim(p_target_context_key) THEN
      RAISE EXCEPTION 'parent effective release context % does not match target context %',v_parent_context_key,p_target_context_key;
    END IF;
    IF v_parent_context_type <> p_target_level THEN
      RAISE EXCEPTION 'parent effective release context type % does not match target level %',v_parent_context_type,p_target_level;
    END IF;
    v_claimed_composition_sha256 := nullif(btrim(coalesce(
      coalesce(p_source_evidence,'{}'::jsonb)->>'parentEffectiveReleaseCompositionSha256',
      coalesce(p_source_evidence,'{}'::jsonb)->'parentEffectiveRelease'->>'compositionSha256',
      ''
    )), '');
    IF v_claimed_composition_sha256 IS NOT NULL
       AND lower(v_claimed_composition_sha256) <> lower(v_parent_composition_sha256) THEN
      RAISE EXCEPTION 'parent effective release composition SHA-256 mismatch';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM rdl.external_standards_proposal
  WHERE consumer_key=btrim(p_consumer_key) AND request_key=btrim(p_request_key)
  LIMIT 1;
  IF FOUND THEN
    IF lower(v_existing.proposal_sha256) <> lower(p_proposal_sha256)
       OR v_existing.parent_package_id IS DISTINCT FROM p_parent_package_id
       OR v_existing.parent_effective_release_id IS DISTINCT FROM p_parent_effective_release_id THEN
      RAISE EXCEPTION 'idempotency conflict for consumer % request %',p_consumer_key,p_request_key;
    END IF;
    RETURN v_existing;
  END IF;

  v_proposal_key := btrim(p_consumer_key)||':'||btrim(p_request_key);
  INSERT INTO rdl.external_standards_proposal(
    proposal_key,consumer_key,request_key,proposal_sha256,proposer_key,
    source_system,source_level,target_level,target_context_key,parent_package_id,parent_effective_release_id,
    change_kind,entity_type_code,native_identifier,delta_payload,source_evidence,
    rationale,promotion_target_level,promotion_target_context_key
  ) VALUES (
    v_proposal_key,btrim(p_consumer_key),btrim(p_request_key),lower(p_proposal_sha256),btrim(p_proposer_key),
    btrim(p_source_system),p_source_level,p_target_level,btrim(p_target_context_key),p_parent_package_id,p_parent_effective_release_id,
    p_change_kind,btrim(p_entity_type_code),btrim(p_native_identifier),coalesce(p_delta_payload,'{}'::jsonb),coalesce(p_source_evidence,'{}'::jsonb),
    btrim(p_rationale),p_promotion_target_level,NULLIF(btrim(coalesce(p_promotion_target_context_key,'')),'')
  ) RETURNING * INTO v_created;

  INSERT INTO rdl.external_standards_proposal_event(
    external_proposal_id,action,from_status,to_status,actor_key,rationale,evidence,review_version
  ) VALUES (
    v_created.external_proposal_id,'submit','none',v_created.proposal_status,
    v_created.proposer_key,v_created.rationale,
    jsonb_build_object(
      'consumerKey',v_created.consumer_key,
      'requestKey',v_created.request_key,
      'sourceSystem',v_created.source_system,
      'parentMode',CASE WHEN v_created.parent_package_id IS NOT NULL THEN 'package' ELSE 'effective_release' END,
      'parentPackageId',v_created.parent_package_id,
      'parentEffectiveReleaseId',v_created.parent_effective_release_id
    ),
    v_created.review_version
  );
  RETURN v_created;
END $$;

-- New bundle overload. The original package-parent bundle function remains present.
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
  p_parent_effective_release_id bigint,
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
  IF num_nonnulls(p_parent_package_id,p_parent_effective_release_id) <> 1 THEN
    RAISE EXCEPTION 'exactly one parent identity is required: parent package XOR parent effective release';
  END IF;

  SELECT * INTO v_existing FROM rdl.external_standards_proposal_bundle
  WHERE source_system=btrim(p_source_system) AND external_request_key=btrim(p_request_key);
  IF FOUND THEN
    IF lower(v_existing.bundle_sha256) <> lower(p_bundle_sha256)
       OR v_existing.parent_package_id IS DISTINCT FROM p_parent_package_id
       OR v_existing.parent_effective_release_id IS DISTINCT FROM p_parent_effective_release_id THEN
      RAISE EXCEPTION 'idempotency conflict for source system % request %',p_source_system,p_request_key;
    END IF;
    RETURN v_existing;
  END IF;

  v_components := coalesce(p_bundle_payload->'components','[]'::jsonb);
  v_dependencies := coalesce(p_bundle_payload->'dependencies','[]'::jsonb);
  IF jsonb_typeof(v_components) <> 'array' THEN RAISE EXCEPTION 'bundle_payload.components must be an array'; END IF;
  IF jsonb_typeof(v_dependencies) <> 'array' THEN RAISE EXCEPTION 'bundle_payload.dependencies must be an array'; END IF;
  v_component_count := jsonb_array_length(v_components);
  v_dependency_count := jsonb_array_length(v_dependencies);
  IF v_component_count=0 THEN RAISE EXCEPTION 'proposal bundle requires at least one component'; END IF;
  v_source_bundle_key := coalesce(nullif(btrim(p_bundle_payload->>'bundleKey'),''),nullif(btrim(p_bundle_payload->>'bundle_key'),''),btrim(p_request_key));
  v_source_pse_id := nullif(btrim(coalesce(p_bundle_payload->>'sourcePseId',p_bundle_payload->>'source_pse_id','')),'');
  v_source_pse_content_hash := nullif(btrim(coalesce(p_bundle_payload->>'sourcePseContentHash',p_bundle_payload->>'source_pse_content_hash','')),'');
  v_root_entity_type := coalesce(nullif(btrim(p_bundle_payload->>'rootEntityTypeCode'),''),nullif(btrim(p_bundle_payload->>'root_entity_type_code'),''),'proposal_bundle');
  v_root_native_identifier := coalesce(nullif(btrim(p_bundle_payload->>'rootNativeIdentifier'),''),nullif(btrim(p_bundle_payload->>'root_native_identifier'),''),btrim(p_request_key));

  SELECT * INTO v_proposal FROM rdl.submit_external_standards_proposal(
    p_consumer_key,p_request_key,lower(p_bundle_sha256),p_proposer_key,p_source_system,
    p_source_level,p_target_level,p_target_context_key,p_parent_package_id,p_parent_effective_release_id,
    'relationship_delta',v_root_entity_type,v_root_native_identifier,
    p_bundle_payload,p_source_evidence,p_rationale,p_promotion_target_level,p_promotion_target_context_key
  );

  INSERT INTO rdl.external_standards_proposal_bundle(
    external_proposal_id,source_system,external_request_key,source_bundle_key,
    source_pse_id,source_pse_content_hash,bundle_sha256,source_level,target_level,
    target_context_key,parent_package_id,parent_effective_release_id,bundle_payload,source_evidence,component_count,dependency_count
  ) VALUES (
    v_proposal.external_proposal_id,btrim(p_source_system),btrim(p_request_key),v_source_bundle_key,
    v_source_pse_id,v_source_pse_content_hash,lower(p_bundle_sha256),p_source_level,p_target_level,
    btrim(p_target_context_key),p_parent_package_id,p_parent_effective_release_id,p_bundle_payload,coalesce(p_source_evidence,'{}'::jsonb),v_component_count,v_dependency_count
  ) RETURNING * INTO v_bundle;

  INSERT INTO rdl.external_standards_proposal_bundle_component(
    proposal_bundle_id,component_key,component_kind,component_action,
    entity_type_code,native_identifier,component_payload,required_fields_missing,component_status
  )
  SELECT
    v_bundle.proposal_bundle_id,
    btrim(coalesce(item.value->>'componentKey',item.value->>'component_key')),
    coalesce(nullif(btrim(coalesce(item.value->>'componentKind',item.value->>'component_kind','')),''),'object_delta'),
    coalesce(nullif(btrim(coalesce(item.value->>'action',item.value->>'component_action','')),''),'add'),
    btrim(coalesce(item.value->>'entityTypeCode',item.value->>'entity_type_code')),
    btrim(coalesce(item.value->>'nativeIdentifier',item.value->>'native_identifier')),
    coalesce(item.value->'payload',item.value->'component_payload','{}'::jsonb),
    coalesce(item.value->'requiredFieldsMissing',item.value->'required_fields_missing','[]'::jsonb),
    CASE WHEN jsonb_array_length(coalesce(item.value->'requiredFieldsMissing',item.value->'required_fields_missing','[]'::jsonb))>0 THEN 'incomplete_candidate' ELSE 'complete' END
  FROM jsonb_array_elements(v_components) AS item(value);

  WITH raw_dependency AS (
    SELECT
      item.value,
      btrim(coalesce(item.value->>'dependencyKey',item.value->>'dependency_key')) AS dependency_key,
      btrim(coalesce(item.value->>'sourceComponentKey',item.value->>'source_component_key')) AS source_component_key,
      coalesce(nullif(btrim(coalesce(item.value->>'dependencyType',item.value->>'dependency_type','')),''),'semantic_dependency') AS dependency_type,
      coalesce((item.value->>'required')::boolean,true) AS required,
      nullif(btrim(coalesce(item.value->>'targetComponentKey',item.value->>'target_component_key','')),'') AS target_component_key,
      nullif(btrim(coalesce(item.value->>'targetEntityTypeCode',item.value->>'target_entity_type_code','')),'') AS target_entity_type_code,
      nullif(btrim(coalesce(item.value->>'targetNativeIdentifier',item.value->>'target_native_identifier','')),'') AS target_native_identifier
    FROM jsonb_array_elements(v_dependencies) AS item(value)
  ), resolved_dependency AS (
    SELECT d.*,
      CASE
        WHEN NOT d.required THEN 'not_applicable'
        WHEN d.target_component_key IS NOT NULL AND EXISTS (
          SELECT 1 FROM rdl.external_standards_proposal_bundle_component c
          WHERE c.proposal_bundle_id=v_bundle.proposal_bundle_id AND c.component_key=d.target_component_key
        ) THEN 'bundle_component'
        WHEN d.target_entity_type_code IS NOT NULL AND d.target_native_identifier IS NOT NULL AND (
          (p_parent_package_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM rdl.rdl_entity e
            WHERE e.package_id=p_parent_package_id
              AND e.entity_type_code=d.target_entity_type_code
              AND e.native_identifier=d.target_native_identifier
          ))
          OR
          (p_parent_effective_release_id IS NOT NULL AND rdl.effective_release_contains_entity(
            p_parent_effective_release_id,d.target_entity_type_code,d.target_native_identifier
          ))
        ) THEN 'existing_governed_object'
        ELSE 'missing'
      END AS resolved_by
    FROM raw_dependency d
  )
  INSERT INTO rdl.external_standards_proposal_bundle_dependency(
    proposal_bundle_id,dependency_key,source_component_key,dependency_type,required,
    satisfied_by,target_component_key,target_entity_type_code,target_native_identifier,satisfaction_detail
  )
  SELECT v_bundle.proposal_bundle_id,dependency_key,source_component_key,dependency_type,required,
         resolved_by,target_component_key,target_entity_type_code,target_native_identifier,
         jsonb_build_object(
           'resolvedBy',resolved_by,
           'parentMode',CASE WHEN p_parent_package_id IS NOT NULL THEN 'package' ELSE 'effective_release' END,
           'parentPackageId',p_parent_package_id,
           'parentEffectiveReleaseId',p_parent_effective_release_id
         )
  FROM resolved_dependency;

  SELECT count(*)::integer INTO v_missing_count
  FROM rdl.external_standards_proposal_bundle_dependency
  WHERE proposal_bundle_id=v_bundle.proposal_bundle_id AND required AND satisfied_by='missing';

  UPDATE rdl.external_standards_proposal_bundle
  SET validation_status='schema_validated',
      completeness_status=CASE WHEN v_missing_count=0 THEN 'complete' ELSE 'incomplete_candidate' END,
      missing_dependency_count=v_missing_count,
      updated_at=now()
  WHERE proposal_bundle_id=v_bundle.proposal_bundle_id
  RETURNING * INTO v_bundle;

  INSERT INTO rdl.external_standards_proposal_bundle_event(proposal_bundle_id,action,actor_key,rationale,event_payload) VALUES
    (v_bundle.proposal_bundle_id,'submit',btrim(p_proposer_key),btrim(p_rationale),jsonb_build_object(
      'sourceSystem',p_source_system,'externalRequestKey',p_request_key,
      'parentMode',CASE WHEN p_parent_package_id IS NOT NULL THEN 'package' ELSE 'effective_release' END,
      'parentPackageId',p_parent_package_id,'parentEffectiveReleaseId',p_parent_effective_release_id
    )),
    (v_bundle.proposal_bundle_id,'validate',btrim(p_proposer_key),'Dependency closure validation completed.',jsonb_build_object(
      'completenessStatus',v_bundle.completeness_status,'missingDependencyCount',v_missing_count
    ));
  RETURN v_bundle;
END $$;

-- Preserve all pre-existing queue columns in the same order; append explicit parent identity fields.
CREATE OR REPLACE VIEW rdl.external_standards_proposal_queue AS
SELECT
  p.external_proposal_id,p.proposal_key,p.consumer_key,p.request_key,p.proposer_key,
  p.source_system,p.source_level,p.target_level,p.target_context_key,p.parent_package_id,
  pkg.package_key AS parent_package_key,p.change_kind,p.entity_type_code,p.native_identifier,
  p.proposal_status,p.review_version,p.reviewed_by,p.reviewed_at,p.created_at,p.updated_at,
  p.proposal_sha256,
  CASE WHEN p.parent_package_id IS NOT NULL THEN 'package' ELSE 'effective_release' END AS parent_mode,
  p.parent_effective_release_id,
  erc.context_key AS parent_effective_context_key,
  erc.context_type AS parent_effective_context_type,
  er.release_key AS parent_effective_release_key,
  er.release_version AS parent_effective_release_version,
  er.composition_sha256 AS parent_effective_composition_sha256,
  p.delta_payload,p.source_evidence,p.rationale,p.promotion_target_level,p.promotion_target_context_key,
  p.review_rationale,p.publication_result
FROM rdl.external_standards_proposal p
LEFT JOIN rdl.rdl_package pkg ON pkg.package_id=p.parent_package_id
LEFT JOIN rdl.effective_standard_release er ON er.effective_standard_release_id=p.parent_effective_release_id
LEFT JOIN rdl.enterprise_context erc ON erc.context_id=er.context_id;

CREATE OR REPLACE VIEW rdl.external_standards_proposal_bundle_queue AS
SELECT b.proposal_bundle_id,p.external_proposal_id,p.proposal_key,p.consumer_key,p.request_key,
       b.source_system,b.external_request_key,b.source_bundle_key,b.source_pse_id,
       b.source_level,b.target_level,b.target_context_key,b.parent_package_id,
       pkg.package_key AS parent_package_key,b.bundle_sha256,b.validation_status,
       b.completeness_status,b.component_count,b.dependency_count,b.missing_dependency_count,
       p.proposal_status,p.review_version,p.reviewed_by,p.reviewed_at,b.created_at,b.updated_at,
       CASE WHEN b.parent_package_id IS NOT NULL THEN 'package' ELSE 'effective_release' END AS parent_mode,
       b.parent_effective_release_id,
       erc.context_key AS parent_effective_context_key,
       erc.context_type AS parent_effective_context_type,
       er.release_key AS parent_effective_release_key,
       er.release_version AS parent_effective_release_version,
       er.composition_sha256 AS parent_effective_composition_sha256
FROM rdl.external_standards_proposal_bundle b
JOIN rdl.external_standards_proposal p ON p.external_proposal_id=b.external_proposal_id
LEFT JOIN rdl.rdl_package pkg ON pkg.package_id=b.parent_package_id
LEFT JOIN rdl.effective_standard_release er ON er.effective_standard_release_id=b.parent_effective_release_id
LEFT JOIN rdl.enterprise_context erc ON erc.context_id=er.context_id;

COMMENT ON COLUMN rdl.external_standards_proposal.parent_effective_release_id IS
  'Immutable effective-standard release parent. Mutually exclusive with parent_package_id.';
COMMENT ON COLUMN rdl.external_standards_proposal_bundle.parent_effective_release_id IS
  'Immutable effective-standard release parent. Mutually exclusive with parent_package_id.';
