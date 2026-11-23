-- RDL-059
-- Refine Company collision decisions so Rename / Exclude identify the
-- exact source entity to which the contextual decision applies.

ALTER TABLE rdl.company_adoption_collision_decision
  ADD COLUMN IF NOT EXISTS subject_entity_id bigint
  REFERENCES rdl.rdl_entity(entity_id) ON DELETE RESTRICT;

ALTER TABLE rdl.company_adoption_collision_decision_event
  ADD COLUMN IF NOT EXISTS subject_entity_id bigint
  REFERENCES rdl.rdl_entity(entity_id) ON DELETE RESTRICT;


CREATE OR REPLACE FUNCTION
rdl.record_company_adoption_collision_decision_v2(
  p_context_key text,
  p_mapping_id bigint,
  p_decision_type text,
  p_subject_entity_id bigint,
  p_target_name text,
  p_rationale text,
  p_decided_by text,
  p_expected_version integer DEFAULT 0
)
RETURNS TABLE(
  collision_decision_id bigint,
  decision_type text,
  subject_entity_id bigint,
  target_name text,
  review_version integer,
  decided_by text,
  decided_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id bigint;
  v_context_type text;
  v_context_status text;

  v_mapping_source_entity_id bigint;
  v_mapping_target_entity_id bigint;

  v_decision_id bigint;
  v_current_version integer;
  v_from_decision text;
  v_next_version integer;

  v_effective_subject_entity_id bigint;
BEGIN
  SELECT
    c.context_id,
    c.context_type,
    c.status
  INTO
    v_context_id,
    v_context_type,
    v_context_status
  FROM rdl.enterprise_context c
  WHERE c.context_key=btrim(p_context_key);

  IF v_context_id IS NULL
     OR v_context_type <> 'company' THEN
    RAISE EXCEPTION
      'A valid Company context is required';
  END IF;

  IF v_context_status='retired' THEN
    RAISE EXCEPTION
      'Collision decisions cannot be recorded against a retired Company context';
  END IF;

  SELECT
    m.source_entity_id,
    m.target_entity_id
  INTO
    v_mapping_source_entity_id,
    v_mapping_target_entity_id
  FROM rdl.cross_rdl_mapping m
  WHERE m.mapping_id=p_mapping_id;

  IF v_mapping_source_entity_id IS NULL THEN
    RAISE EXCEPTION
      'A valid cross-RDL mapping candidate is required';
  END IF;

  IF p_decision_type NOT IN (
    'merge',
    'keep_separate',
    'rename',
    'exclude',
    'defer'
  ) THEN
    RAISE EXCEPTION
      'Unsupported Company adoption collision decision';
  END IF;

  IF length(btrim(coalesce(p_rationale,''))) < 10 THEN
    RAISE EXCEPTION
      'Collision decision rationale must contain at least 10 characters';
  END IF;

  IF btrim(coalesce(p_decided_by,''))='' THEN
    RAISE EXCEPTION
      'Collision decision reviewer is required';
  END IF;

  IF p_decision_type IN ('rename','exclude') THEN

    IF p_subject_entity_id IS NULL THEN
      RAISE EXCEPTION
        'Rename and Exclude require the exact subject entity';
    END IF;

    IF p_subject_entity_id NOT IN (
      v_mapping_source_entity_id,
      v_mapping_target_entity_id
    ) THEN
      RAISE EXCEPTION
        'Collision decision subject must belong to the selected mapping';
    END IF;

    v_effective_subject_entity_id := p_subject_entity_id;

  ELSE
    v_effective_subject_entity_id := NULL;
  END IF;

  IF p_decision_type='rename'
     AND btrim(coalesce(p_target_name,''))='' THEN
    RAISE EXCEPTION
      'Rename requires a governed target name';
  END IF;

  SELECT
    d.collision_decision_id,
    d.decision_type,
    d.review_version
  INTO
    v_decision_id,
    v_from_decision,
    v_current_version
  FROM rdl.company_adoption_collision_decision d
  WHERE d.context_id=v_context_id
    AND d.mapping_id=p_mapping_id
  FOR UPDATE;

  IF v_decision_id IS NULL THEN

    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION
        'Company adoption collision decision version conflict';
    END IF;

    INSERT INTO rdl.company_adoption_collision_decision(
      context_id,
      mapping_id,
      decision_type,
      subject_entity_id,
      target_name,
      rationale,
      review_version,
      decided_by
    )
    VALUES (
      v_context_id,
      p_mapping_id,
      p_decision_type,
      v_effective_subject_entity_id,
      CASE
        WHEN p_decision_type='rename'
        THEN btrim(p_target_name)
        ELSE NULL
      END,
      btrim(p_rationale),
      1,
      btrim(p_decided_by)
    )
    RETURNING
      company_adoption_collision_decision.collision_decision_id
    INTO v_decision_id;

    v_from_decision := NULL;
    v_next_version := 1;

  ELSE

    IF p_expected_version <> v_current_version THEN
      RAISE EXCEPTION
        'Company adoption collision decision version conflict';
    END IF;

    v_next_version := v_current_version + 1;

    UPDATE rdl.company_adoption_collision_decision d
    SET
      decision_type=p_decision_type,
      subject_entity_id=v_effective_subject_entity_id,
      target_name=
        CASE
          WHEN p_decision_type='rename'
          THEN btrim(p_target_name)
          ELSE NULL
        END,
      rationale=btrim(p_rationale),
      review_version=v_next_version,
      decided_by=btrim(p_decided_by),
      decided_at=now()
    WHERE d.collision_decision_id=v_decision_id;

  END IF;

  INSERT INTO rdl.company_adoption_collision_decision_event(
    collision_decision_id,
    from_decision_type,
    to_decision_type,
    subject_entity_id,
    target_name,
    rationale,
    decided_by,
    review_version
  )
  VALUES (
    v_decision_id,
    v_from_decision,
    p_decision_type,
    v_effective_subject_entity_id,
    CASE
      WHEN p_decision_type='rename'
      THEN btrim(p_target_name)
      ELSE NULL
    END,
    btrim(p_rationale),
    btrim(p_decided_by),
    v_next_version
  );

  RETURN QUERY
  SELECT
    d.collision_decision_id,
    d.decision_type,
    d.subject_entity_id,
    d.target_name,
    d.review_version,
    d.decided_by,
    d.decided_at
  FROM rdl.company_adoption_collision_decision d
  WHERE d.collision_decision_id=v_decision_id;
END;
$$;


COMMENT ON FUNCTION
rdl.record_company_adoption_collision_decision_v2 IS
'RDL-059 contextual Company collision decision with explicit Rename / Exclude subject identity.';
