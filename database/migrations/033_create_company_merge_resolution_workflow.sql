-- RDL-061
-- Governed Company/L2 multi-source merge execution.
--
-- The mapping record is the authoritative source of contributor identities.
-- Browser-supplied contributor ids are never trusted.
--
-- Source L1 packages and entities remain immutable.
-- When a source package is pinned into the Company context, the inherited
-- contributor identity is suppressed at L2 through an explicit retire
-- extension draft. The merge target is a separate Company extension draft.
--
-- Target and retirement drafts still require normal extension governance.

CREATE OR REPLACE FUNCTION rdl.resolve_company_adoption_merge(
  p_context_key text,
  p_mapping_id bigint,
  p_target_native_identifier text,
  p_target_name text,
  p_target_definition text,
  p_rationale text,
  p_actor text,
  p_component_decisions jsonb
)
RETURNS TABLE(
  extension_change_id bigint,
  composition_id bigint,
  retire_extension_change_ids bigint[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id bigint;
  v_context_status text;

  v_source_entity_id bigint;
  v_source_package_id bigint;
  v_source_entity_type text;
  v_source_native_identifier text;
  v_source_name text;

  v_target_entity_id bigint;
  v_target_package_id bigint;
  v_target_entity_type text;
  v_target_native_identifier text;
  v_target_name text;

  v_extension_change_id bigint;
  v_composition_id bigint;

  v_retire_ids bigint[] := ARRAY[]::bigint[];
  v_retire_id bigint;

  v_contributor record;
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_context_key,'')),'') IS NULL THEN
    RAISE EXCEPTION 'A Company context key is required';
  END IF;

  IF p_mapping_id IS NULL OR p_mapping_id <= 0 THEN
    RAISE EXCEPTION 'A valid cross-RDL mapping id is required';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_target_native_identifier,'')),'') IS NULL THEN
    RAISE EXCEPTION 'A Company target native identifier is required';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_target_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'A Company target name is required';
  END IF;

  IF length(BTRIM(COALESCE(p_rationale,''))) < 10 THEN
    RAISE EXCEPTION 'A merge rationale of at least 10 characters is required';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_actor,'')),'') IS NULL THEN
    RAISE EXCEPTION 'A merge actor is required';
  END IF;

  IF jsonb_typeof(COALESCE(p_component_decisions,'null'::jsonb)) <> 'array'
     OR jsonb_array_length(p_component_decisions) = 0 THEN
    RAISE EXCEPTION 'Explicit component decisions are required for a Company merge';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_component_decisions) d
    WHERE d->>'componentKind' = 'other'
      AND d->>'componentKey' = 'merge_component_closure'
      AND d->>'resolution' = 'target_override'
      AND d#>>'{resolvedPayload,schemaVersion}' = 'rdl-company-merge-closure/v1'
  ) THEN
    RAISE EXCEPTION 'Company merge requires a governed rdl-company-merge-closure/v1 component closure';
  END IF;

  SELECT c.context_id,c.status
    INTO v_context_id,v_context_status
  FROM rdl.enterprise_context c
  WHERE c.context_key = BTRIM(p_context_key)
    AND c.context_type = 'company'
  LIMIT 1;

  IF v_context_id IS NULL THEN
    RAISE EXCEPTION 'Company context % does not exist',p_context_key;
  END IF;

  IF v_context_status <> 'draft' THEN
    RAISE EXCEPTION 'Company merge resolution requires a draft Company context';
  END IF;

  SELECT
    m.source_entity_id,
    se.package_id,
    se.entity_type_code,
    se.native_identifier,
    se.name,

    m.target_entity_id,
    te.package_id,
    te.entity_type_code,
    te.native_identifier,
    te.name

  INTO
    v_source_entity_id,
    v_source_package_id,
    v_source_entity_type,
    v_source_native_identifier,
    v_source_name,

    v_target_entity_id,
    v_target_package_id,
    v_target_entity_type,
    v_target_native_identifier,
    v_target_name

  FROM rdl.cross_rdl_mapping m
  JOIN rdl.rdl_entity se
    ON se.entity_id = m.source_entity_id
  JOIN rdl.rdl_entity te
    ON te.entity_id = m.target_entity_id
  WHERE m.mapping_id = p_mapping_id
  LIMIT 1;

  IF v_source_entity_id IS NULL OR v_target_entity_id IS NULL THEN
    RAISE EXCEPTION 'Cross-RDL mapping % does not exist',p_mapping_id;
  END IF;

  IF v_source_entity_type <> v_target_entity_type THEN
    RAISE EXCEPTION
      'Company merge contributors must have the same entity type: % versus %',
      v_source_entity_type,
      v_target_entity_type;
  END IF;

  IF v_source_package_id = v_target_package_id THEN
    RAISE EXCEPTION
      'Company multi-source merge requires contributors from distinct exact packages';
  END IF;

  /*
   * A merge action is only executable after the collision workbench has
   * explicitly recorded Merge for this mapping/context.
   */
  IF NOT EXISTS (
    SELECT 1
    FROM rdl.company_adoption_collision_decision d
    WHERE d.context_id = v_context_id
      AND d.mapping_id = p_mapping_id
      AND d.decision_type = 'merge'
  ) THEN
    RAISE EXCEPTION
      'A governed Merge collision decision must be recorded before component resolution';
  END IF;

  /*
   * RDL-061 currently executes merges between L1 standards that are both
   * adopted/pinned into the draft Company context. This guarantees that
   * relationship endpoints retained by the merge are present in the effective
   * Company package and avoids dangling consumer relationships.
   */
  IF NOT EXISTS (
    SELECT 1
    FROM rdl.context_package_pin p
    WHERE p.context_id = v_context_id
      AND p.package_id = v_source_package_id
  ) THEN
    RAISE EXCEPTION
      'Source contributor package % must be pinned into the Company context before merge',
      v_source_package_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rdl.context_package_pin p
    WHERE p.context_id = v_context_id
      AND p.package_id = v_target_package_id
  ) THEN
    RAISE EXCEPTION
      'Target contributor package % must be pinned into the Company context before merge',
      v_target_package_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rdl.entity_composition c
    JOIN rdl.context_extension_change ch
      ON ch.extension_change_id = c.target_extension_change_id
    WHERE c.target_context_id = v_context_id
      AND c.composition_kind = 'multi_source_merge'
      AND ch.entity_type_code = v_source_entity_type
      AND ch.native_identifier = BTRIM(p_target_native_identifier)
  ) THEN
    RAISE EXCEPTION
      'A Company merge composition already exists for %/%',
      v_source_entity_type,
      p_target_native_identifier;
  END IF;

  SELECT x.extension_change_id,x.composition_id
    INTO v_extension_change_id,v_composition_id
  FROM rdl.create_company_adoption_composition(
    BTRIM(p_context_key),
    'multi_source_merge',
    v_source_entity_type,
    BTRIM(p_target_native_identifier),
    BTRIM(p_target_name),
    NULLIF(BTRIM(COALESCE(p_target_definition,'')),''),
    BTRIM(p_rationale),
    BTRIM(p_actor),

    jsonb_build_array(
      jsonb_build_object(
        'sourceEntityId',v_source_entity_id,
        'contributionRole','primary'
      ),
      jsonb_build_object(
        'sourceEntityId',v_target_entity_id,
        'contributionRole','contributor'
      )
    ),

    p_component_decisions
  ) x;

  /*
   * Both exact inherited source identities must be explicitly suppressed from
   * the effective Company view. These are drafts so the normal extension
   * governance process remains authoritative.
   */
  FOR v_contributor IN
    SELECT *
    FROM (
      VALUES
        (
          v_source_entity_id,
          v_source_entity_type,
          v_source_native_identifier,
          v_source_name
        ),
        (
          v_target_entity_id,
          v_target_entity_type,
          v_target_native_identifier,
          v_target_name
        )
    ) AS q(entity_id,entity_type_code,native_identifier,name)
  LOOP

    SELECT ch.extension_change_id
      INTO v_retire_id
    FROM rdl.context_extension_change ch
    WHERE ch.context_id = v_context_id
      AND ch.change_kind = 'retire'
      AND ch.base_entity_id = v_contributor.entity_id
      AND ch.status IN ('draft','candidate','in_review','approved')
    ORDER BY ch.extension_change_id DESC
    LIMIT 1;

    IF v_retire_id IS NULL THEN
      INSERT INTO rdl.context_extension_change(
        context_id,
        change_kind,
        entity_type_code,
        native_identifier,
        base_entity_id,
        proposed_name,
        proposed_definition,
        status,
        rationale,
        provenance,
        proposed_by
      )
      VALUES(
        v_context_id,
        'retire',
        v_contributor.entity_type_code,
        v_contributor.native_identifier,
        v_contributor.entity_id,
        NULL,
        NULL,
        'draft',
        'Suppress exact inherited L1 contributor after governed Company multi-source merge. ' || BTRIM(p_rationale),
        jsonb_build_object(
          'workflow','company_rdl_multi_source_merge',
          'mappingId',p_mapping_id,
          'compositionId',v_composition_id,
          'companyTargetNativeIdentifier',BTRIM(p_target_native_identifier),
          'sourceEntityId',v_contributor.entity_id,
          'sourceEntityName',v_contributor.name,
          'sourceLayer','industry',
          'targetLayer','company',
          'sourceEntityImmutable',true
        ),
        BTRIM(p_actor)
      )
      RETURNING context_extension_change.extension_change_id
      INTO v_retire_id;
    END IF;

    v_retire_ids :=
      array_append(v_retire_ids,v_retire_id);

    v_retire_id := NULL;
  END LOOP;

  extension_change_id := v_extension_change_id;
  composition_id := v_composition_id;
  retire_extension_change_ids := v_retire_ids;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION rdl.resolve_company_adoption_merge(
  text,bigint,text,text,text,text,text,jsonb
) IS
'RDL-061. Executes an already-governed Company/L2 Merge collision by deriving exact contributors from the cross-RDL mapping, persisting component-resolution provenance through the existing RDL-054 composition engine, and creating explicit L2 retirement drafts for pinned inherited contributors. L1 source records remain immutable.';
