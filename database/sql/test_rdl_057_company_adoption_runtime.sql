BEGIN;

DO $$
DECLARE
  v_context_id bigint;
  v_package_id bigint;
  v_source_entity_id bigint;
  v_source_entity_type text;
  v_extension_id bigint;
  v_composition_id bigint;
BEGIN
  SELECT p.package_id,e.entity_id,e.entity_type_code
  INTO v_package_id,v_source_entity_id,v_source_entity_type
  FROM rdl.rdl_source s
  JOIN rdl.rdl_release r
    ON r.source_id=s.source_id
  JOIN rdl.rdl_package p
    ON p.release_id=r.release_id
  JOIN rdl.rdl_entity e
    ON e.package_id=p.package_id
  WHERE s.source_key='cfihos'
    AND r.release_key='cfihos-2.0'
    AND r.release_status='published'
  ORDER BY e.entity_id
  LIMIT 1;

  IF v_package_id IS NULL
     OR v_source_entity_id IS NULL
     OR v_source_entity_type IS NULL THEN
    RAISE EXCEPTION 'Published CFIHOS 2.0 test anchor not found';
  END IF;

  SELECT x.context_id
  INTO v_context_id
  FROM rdl.create_company_rdl_context(
    'RDL057-TEST-COMPANY',
    'RDL-057 Test Company',
    'rdl057-test'
  ) x;

  IF v_context_id IS NULL THEN
    RAISE EXCEPTION 'Company context was not created';
  END IF;

  PERFORM *
  FROM rdl.pin_company_industry_package(
    'RDL057-TEST-COMPANY',
    v_package_id,
    10,
    'Adopt published CFIHOS 2.0 for rollback-only acceptance testing.'
  );

  IF (
    SELECT count(*)
    FROM rdl.context_package_pin
    WHERE context_id=v_context_id
      AND package_id=v_package_id
      AND layer_type='industry'
  ) <> 1 THEN
    RAISE EXCEPTION 'Exact Industry package pin was not created';
  END IF;

  SELECT x.extension_change_id,x.composition_id
  INTO v_extension_id,v_composition_id
  FROM rdl.create_company_adoption_composition(
    'RDL057-TEST-COMPANY',
    'derived_copy',
    v_source_entity_type,
    'RDL057-ENTITY-001',
    'RDL-057 governed test entity',
    'Rollback-only acceptance fixture',
    'Create a governed L1 to L2 derivation while retaining exact source provenance.',
    'rdl057-test-reviewer',
    jsonb_build_array(
      jsonb_build_object(
        'sourceEntityId',v_source_entity_id,
        'contributionRole','primary'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'componentKind','definition',
        'componentKey','definition',
        'resolution','use_source',
        'selectedSourceEntityId',v_source_entity_id,
        'resolvedPayload',jsonb_build_object(),
        'rationale','Retain the exact source definition for the Company adoption test.'
      )
    )
  ) x;

  IF v_extension_id IS NULL OR v_composition_id IS NULL THEN
    RAISE EXCEPTION 'Company adoption composition was not created';
  END IF;

  IF (
    SELECT count(*)
    FROM rdl.entity_composition_contributor
    WHERE composition_id=v_composition_id
      AND source_entity_id=v_source_entity_id
  ) <> 1 THEN
    RAISE EXCEPTION 'Exact composition contributor provenance was not retained';
  END IF;

  IF (
    SELECT count(*)
    FROM rdl.entity_composition_component_decision
    WHERE composition_id=v_composition_id
  ) <> 1 THEN
    RAISE EXCEPTION 'Component decision was not persisted';
  END IF;
END;
$$;

ROLLBACK;
