BEGIN;

DO $$
DECLARE
  v_mapping_id bigint;
  v_context_id bigint;
  v_decision_id bigint;
  v_version integer;
BEGIN
  SELECT mapping_id
  INTO v_mapping_id
  FROM rdl.cross_rdl_mapping
  ORDER BY mapping_id
  LIMIT 1;

  IF v_mapping_id IS NULL THEN
    RAISE EXCEPTION
      'RDL-058 acceptance requires at least one cross-RDL mapping';
  END IF;

  SELECT x.context_id
  INTO v_context_id
  FROM rdl.create_company_rdl_context(
    'RDL058-TEST-COMPANY',
    'RDL-058 Test Company',
    'rdl058-test'
  ) x;

  SELECT
    x.collision_decision_id,
    x.review_version
  INTO
    v_decision_id,
    v_version
  FROM rdl.record_company_adoption_collision_decision(
    'RDL058-TEST-COMPANY',
    v_mapping_id,
    'defer',
    NULL,
    'Additional semantic evidence is required before this Company adoption collision can be resolved.',
    'rdl058-test-reviewer',
    0
  ) x;

  IF v_decision_id IS NULL
     OR v_version <> 1 THEN
    RAISE EXCEPTION
      'Initial deferred collision decision was not recorded';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rdl.company_adoption_collision_decision
    WHERE collision_decision_id=v_decision_id
      AND decision_type='defer'
  ) THEN
    RAISE EXCEPTION
      'Explicit defer state was not persisted';
  END IF;

  SELECT x.review_version
  INTO v_version
  FROM rdl.record_company_adoption_collision_decision(
    'RDL058-TEST-COMPANY',
    v_mapping_id,
    'rename',
    'Company governed renamed concept',
    'Company governance keeps this concept distinct and assigns an explicit Company name.',
    'rdl058-test-reviewer',
    1
  ) x;

  IF v_version <> 2 THEN
    RAISE EXCEPTION
      'Collision decision optimistic version did not advance';
  END IF;

  IF (
    SELECT count(*)
    FROM rdl.company_adoption_collision_decision_event
    WHERE collision_decision_id=v_decision_id
  ) <> 2 THEN
    RAISE EXCEPTION
      'Collision decision history is not append-only';
  END IF;
END;
$$;

ROLLBACK;
