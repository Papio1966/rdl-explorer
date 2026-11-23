BEGIN;

DO $$
DECLARE
  v_mapping_id bigint;
  v_left_entity_id bigint;
  v_right_entity_id bigint;
  v_context_id bigint;
  v_decision_id bigint;
BEGIN
  SELECT
    m.mapping_id,
    m.source_entity_id,
    m.target_entity_id
  INTO
    v_mapping_id,
    v_left_entity_id,
    v_right_entity_id
  FROM rdl.cross_rdl_mapping m
  ORDER BY m.mapping_id
  LIMIT 1;

  IF v_mapping_id IS NULL THEN
    RAISE EXCEPTION
      'RDL-059 requires one cross-RDL mapping';
  END IF;

  SELECT x.context_id
  INTO v_context_id
  FROM rdl.create_company_rdl_context(
    'RDL059-TEST-COMPANY',
    'RDL-059 Test Company',
    'rdl059-test'
  ) x;


  BEGIN
    PERFORM *
    FROM rdl.record_company_adoption_collision_decision_v2(
      'RDL059-TEST-COMPANY',
      v_mapping_id,
      'rename',
      NULL,
      'Renamed concept',
      'Rename without a subject must fail closed.',
      'rdl059-test',
      0
    );

    RAISE EXCEPTION
      'Rename without subject was not rejected';

  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM=
        'Rename without subject was not rejected'
      THEN
        RAISE;
      END IF;
  END;


  SELECT x.collision_decision_id
  INTO v_decision_id
  FROM rdl.record_company_adoption_collision_decision_v2(
    'RDL059-TEST-COMPANY',
    v_mapping_id,
    'rename',
    v_left_entity_id,
    'Company governed test name',
    'Rename applies explicitly to one source concept and retains the exact subject identity.',
    'rdl059-test',
    0
  ) x;


  IF NOT EXISTS (
    SELECT 1
    FROM rdl.company_adoption_collision_decision
    WHERE collision_decision_id=v_decision_id
      AND subject_entity_id=v_left_entity_id
      AND decision_type='rename'
  ) THEN
    RAISE EXCEPTION
      'Rename subject identity was not persisted';
  END IF;


  PERFORM *
  FROM rdl.record_company_adoption_collision_decision_v2(
    'RDL059-TEST-COMPANY',
    v_mapping_id,
    'exclude',
    v_right_entity_id,
    NULL,
    'Exclude applies explicitly to the other source concept for this Company-context decision.',
    'rdl059-test',
    1
  );


  IF NOT EXISTS (
    SELECT 1
    FROM rdl.company_adoption_collision_decision
    WHERE collision_decision_id=v_decision_id
      AND subject_entity_id=v_right_entity_id
      AND decision_type='exclude'
      AND review_version=2
  ) THEN
    RAISE EXCEPTION
      'Exclude subject identity was not persisted';
  END IF;

END;
$$;

ROLLBACK;
