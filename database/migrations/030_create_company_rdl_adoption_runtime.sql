-- RDL-057
-- Governed Company/L2 adoption runtime.
--
-- Reuses the existing enterprise-context, extension-governance and
-- multi-RDL composition model. No source RDL entity/package is mutated.

CREATE OR REPLACE FUNCTION rdl.create_company_rdl_context(
  p_context_key text,
  p_name text,
  p_owner_reference text DEFAULT NULL
)
RETURNS TABLE(
  context_id bigint,
  context_key text,
  context_name text,
  context_status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id bigint;
BEGIN
  IF btrim(coalesce(p_context_key,'')) = '' THEN
    RAISE EXCEPTION 'Company context key is required';
  END IF;

  IF btrim(coalesce(p_name,'')) = '' THEN
    RAISE EXCEPTION 'Company context name is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rdl.enterprise_context c
    WHERE c.context_key = btrim(p_context_key)
  ) THEN
    RAISE EXCEPTION 'Enterprise context % already exists', btrim(p_context_key);
  END IF;

  INSERT INTO rdl.enterprise_context(
    context_key,
    context_type,
    name,
    owner_reference,
    status
  )
  VALUES (
    btrim(p_context_key),
    'company',
    btrim(p_name),
    NULLIF(btrim(coalesce(p_owner_reference,'')),''),
    'draft'
  )
  RETURNING enterprise_context.context_id
  INTO v_context_id;

  RETURN QUERY
  SELECT
    c.context_id,
    c.context_key,
    c.name,
    c.status
  FROM rdl.enterprise_context c
  WHERE c.context_id = v_context_id;
END;
$$;


CREATE OR REPLACE FUNCTION rdl.pin_company_industry_package(
  p_context_key text,
  p_package_id bigint,
  p_precedence integer,
  p_reason text
)
RETURNS TABLE(
  context_package_pin_id bigint,
  context_id bigint,
  package_id bigint,
  precedence integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id bigint;
  v_context_status text;
  v_context_type text;
  v_release_status text;
  v_pin_id bigint;
BEGIN
  SELECT c.context_id,c.context_type,c.status
  INTO v_context_id,v_context_type,v_context_status
  FROM rdl.enterprise_context c
  WHERE c.context_key=btrim(p_context_key);

  IF v_context_id IS NULL OR v_context_type <> 'company' THEN
    RAISE EXCEPTION 'A valid Company context is required';
  END IF;

  IF v_context_status <> 'draft' THEN
    RAISE EXCEPTION
      'Industry packages may only be added while the Company context is draft';
  END IF;

  IF p_precedence < 1 OR p_precedence > 400 THEN
    RAISE EXCEPTION 'Package precedence must be between 1 and 400';
  END IF;

  SELECT r.release_status
  INTO v_release_status
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r
    ON r.release_id=p.release_id
  WHERE p.package_id=p_package_id;

  IF v_release_status IS NULL THEN
    RAISE EXCEPTION 'A valid Industry package is required';
  END IF;

  IF v_release_status <> 'published' THEN
    RAISE EXCEPTION
      'Only a published L1 release may be adopted into an operational Company RDL';
  END IF;

  INSERT INTO rdl.context_package_pin(
    context_id,
    layer_type,
    package_id,
    precedence,
    pin_reason
  )
  VALUES (
    v_context_id,
    'industry',
    p_package_id,
    p_precedence,
    NULLIF(btrim(coalesce(p_reason,'')),'')
  )
  RETURNING context_package_pin.context_package_pin_id
  INTO v_pin_id;

  RETURN QUERY
  SELECT
    pin.context_package_pin_id,
    pin.context_id,
    pin.package_id,
    pin.precedence
  FROM rdl.context_package_pin pin
  WHERE pin.context_package_pin_id=v_pin_id;
END;
$$;


CREATE OR REPLACE FUNCTION rdl.create_company_adoption_composition(
  p_context_key text,
  p_composition_kind text,
  p_target_entity_type text,
  p_target_native_identifier text,
  p_target_name text,
  p_target_definition text,
  p_rationale text,
  p_created_by text,
  p_contributors jsonb,
  p_component_decisions jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(
  extension_change_id bigint,
  composition_id bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id bigint;
  v_context_type text;
  v_context_status text;
  v_extension_id bigint;
  v_composition_id bigint;
  v_item jsonb;
  v_source_entity_id bigint;
  v_source_package_id bigint;
  v_release_status text;
  v_selected_entity_id bigint;
  v_package_count integer;
BEGIN
  IF p_composition_kind NOT IN ('multi_source_merge','derived_copy','promotion') THEN
    RAISE EXCEPTION 'Unsupported composition kind';
  END IF;

  IF btrim(coalesce(p_target_entity_type,''))='' OR
     btrim(coalesce(p_target_native_identifier,''))='' OR
     btrim(coalesce(p_target_name,''))='' THEN
    RAISE EXCEPTION
      'Target entity type, identifier and name are required';
  END IF;

  IF length(btrim(coalesce(p_rationale,''))) < 10 THEN
    RAISE EXCEPTION 'Composition rationale must contain at least 10 characters';
  END IF;

  IF btrim(coalesce(p_created_by,''))='' THEN
    RAISE EXCEPTION 'Composition creator is required';
  END IF;

  SELECT c.context_id,c.context_type,c.status
  INTO v_context_id,v_context_type,v_context_status
  FROM rdl.enterprise_context c
  WHERE c.context_key=btrim(p_context_key);

  IF v_context_id IS NULL OR v_context_type <> 'company' THEN
    RAISE EXCEPTION 'A valid Company context is required';
  END IF;

  IF v_context_status='retired' THEN
    RAISE EXCEPTION 'A retired Company context cannot receive adopted content';
  END IF;

  IF jsonb_typeof(coalesce(p_contributors,'[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_contributors,'[]'::jsonb))=0 THEN
    RAISE EXCEPTION 'At least one exact L1 contributor is required';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.rdl057_contributor_validation(
    source_entity_id bigint PRIMARY KEY,
    source_package_id bigint NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE pg_temp.rdl057_contributor_validation;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_contributors)
  LOOP
    v_source_entity_id :=
      NULLIF(v_item->>'sourceEntityId','')::bigint;

    IF v_source_entity_id IS NULL THEN
      RAISE EXCEPTION 'Each contributor requires sourceEntityId';
    END IF;

    SELECT e.package_id,r.release_status
    INTO v_source_package_id,v_release_status
    FROM rdl.rdl_entity e
    JOIN rdl.rdl_package p
      ON p.package_id=e.package_id
    JOIN rdl.rdl_release r
      ON r.release_id=p.release_id
    WHERE e.entity_id=v_source_entity_id;

    IF v_source_package_id IS NULL THEN
      RAISE EXCEPTION 'Source entity % does not exist',v_source_entity_id;
    END IF;

    IF v_release_status <> 'published' THEN
      RAISE EXCEPTION
        'Source entity % does not belong to a published L1 release',
        v_source_entity_id;
    END IF;

    INSERT INTO pg_temp.rdl057_contributor_validation(
      source_entity_id,
      source_package_id
    )
    VALUES (
      v_source_entity_id,
      v_source_package_id
    )
    ON CONFLICT (source_entity_id) DO NOTHING;
  END LOOP;

  SELECT count(DISTINCT source_package_id)
  INTO v_package_count
  FROM pg_temp.rdl057_contributor_validation;

  IF p_composition_kind='multi_source_merge' AND v_package_count < 2 THEN
    RAISE EXCEPTION
      'multi_source_merge requires contributors from at least two exact L1 packages';
  END IF;

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
  VALUES (
    v_context_id,
    'add',
    btrim(p_target_entity_type),
    btrim(p_target_native_identifier),
    NULL,
    btrim(p_target_name),
    NULLIF(btrim(coalesce(p_target_definition,'')),''),
    'draft',
    btrim(p_rationale),
    jsonb_build_object(
      'workflow','company_rdl_adoption',
      'sourceLayer','industry',
      'targetLayer','company',
      'exactContributorCount',
      (SELECT count(*) FROM pg_temp.rdl057_contributor_validation)
    ),
    btrim(p_created_by)
  )
  RETURNING context_extension_change.extension_change_id
  INTO v_extension_id;

  INSERT INTO rdl.entity_composition(
    target_context_id,
    target_extension_change_id,
    composition_kind,
    rationale,
    created_by
  )
  VALUES (
    v_context_id,
    v_extension_id,
    p_composition_kind,
    btrim(p_rationale),
    btrim(p_created_by)
  )
  RETURNING entity_composition.composition_id
  INTO v_composition_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_contributors)
  LOOP
    v_source_entity_id :=
      NULLIF(v_item->>'sourceEntityId','')::bigint;

    SELECT source_package_id
    INTO v_source_package_id
    FROM pg_temp.rdl057_contributor_validation
    WHERE source_entity_id=v_source_entity_id;

    INSERT INTO rdl.entity_composition_contributor(
      composition_id,
      source_package_id,
      source_entity_id,
      contribution_role,
      source_snapshot
    )
    SELECT
      v_composition_id,
      v_source_package_id,
      e.entity_id,
      COALESCE(NULLIF(v_item->>'contributionRole',''),'contributor'),
      jsonb_build_object(
        'entityId',e.entity_id,
        'entityTypeCode',e.entity_type_code,
        'nativeIdentifier',e.native_identifier,
        'name',e.name,
        'definition',e.definition,
        'packageId',p.package_id,
        'packageKey',p.package_key,
        'releaseId',r.release_id,
        'releaseKey',r.release_key,
        'sourceId',s.source_id,
        'sourceKey',s.source_key,
        'packageContentSha256',p.content_sha256
      )
    FROM rdl.rdl_entity e
    JOIN rdl.rdl_package p
      ON p.package_id=e.package_id
    JOIN rdl.rdl_release r
      ON r.release_id=p.release_id
    JOIN rdl.rdl_source s
      ON s.source_id=r.source_id
    WHERE e.entity_id=v_source_entity_id;
  END LOOP;

  IF jsonb_typeof(coalesce(p_component_decisions,'[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Component decisions must be a JSON array';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(coalesce(p_component_decisions,'[]'::jsonb))
  LOOP
    v_selected_entity_id :=
      NULLIF(v_item->>'selectedSourceEntityId','')::bigint;

    IF v_selected_entity_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM rdl.entity_composition_contributor cc
         WHERE cc.composition_id=v_composition_id
           AND cc.source_entity_id=v_selected_entity_id
       ) THEN
      RAISE EXCEPTION
        'Selected source entity % is not a composition contributor',
        v_selected_entity_id;
    END IF;

    INSERT INTO rdl.entity_composition_component_decision(
      composition_id,
      component_kind,
      component_key,
      resolution,
      selected_source_entity_id,
      resolved_payload,
      rationale,
      decided_by
    )
    VALUES (
      v_composition_id,
      btrim(v_item->>'componentKind'),
      btrim(v_item->>'componentKey'),
      btrim(v_item->>'resolution'),
      v_selected_entity_id,
      COALESCE(v_item->'resolvedPayload','{}'::jsonb),
      btrim(v_item->>'rationale'),
      btrim(p_created_by)
    );
  END LOOP;

  RETURN QUERY
  SELECT v_extension_id,v_composition_id;
END;
$$;


COMMENT ON FUNCTION rdl.create_company_rdl_context IS
'RDL-057 governed creation of a draft Company/L2 context.';

COMMENT ON FUNCTION rdl.pin_company_industry_package IS
'RDL-057 exact published L1 package adoption into a draft Company/L2 context.';

COMMENT ON FUNCTION rdl.create_company_adoption_composition IS
'RDL-057 creates a governed Company extension plus exact entity-composition provenance without mutating source RDL content.';
