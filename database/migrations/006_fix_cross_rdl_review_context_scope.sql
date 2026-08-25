-- RDL-011.1: scope the governed review context to the internal review update only.
-- Migration 005 used a transaction-local custom setting. Without restoring it,
-- a successful governed review left the transaction marked as governed, which
-- allowed a later direct UPDATE in the same transaction to bypass the trigger.

CREATE OR REPLACE FUNCTION rdl.review_cross_rdl_mapping(
  p_mapping_id bigint,
  p_action text,
  p_reviewer text,
  p_rationale text,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_expected_version integer DEFAULT NULL,
  p_successor_mapping_id bigint DEFAULT NULL
)
RETURNS TABLE(mapping_id bigint, status text, review_version integer, reviewed_by text, reviewed_at timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
  current_row rdl.cross_rdl_mapping%ROWTYPE;
  next_status text;
  previous_review_context text;
BEGIN
  IF p_action NOT IN ('approve','reject','supersede') THEN
    RAISE EXCEPTION 'unsupported review action: %', p_action;
  END IF;

  IF length(btrim(coalesce(p_reviewer,''))) = 0
     OR length(btrim(coalesce(p_rationale,''))) = 0 THEN
    RAISE EXCEPTION 'reviewer and rationale are required';
  END IF;

  SELECT *
  INTO current_row
  FROM rdl.cross_rdl_mapping
  WHERE rdl.cross_rdl_mapping.mapping_id = p_mapping_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mapping % not found', p_mapping_id;
  END IF;

  IF p_expected_version IS NOT NULL
     AND current_row.review_version <> p_expected_version THEN
    RAISE EXCEPTION 'review version conflict for mapping %: expected %, actual %',
      p_mapping_id, p_expected_version, current_row.review_version;
  END IF;

  IF p_action = 'approve' THEN
    IF current_row.status <> 'candidate' THEN
      RAISE EXCEPTION 'only candidate mappings can be approved';
    END IF;
    next_status := 'approved';
  ELSIF p_action = 'reject' THEN
    IF current_row.status <> 'candidate' THEN
      RAISE EXCEPTION 'only candidate mappings can be rejected';
    END IF;
    next_status := 'rejected';
  ELSE
    IF current_row.status <> 'approved' THEN
      RAISE EXCEPTION 'only approved mappings can be superseded';
    END IF;
    IF p_successor_mapping_id IS NULL OR p_successor_mapping_id = p_mapping_id THEN
      RAISE EXCEPTION 'supersede requires a different successor mapping';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM rdl.cross_rdl_mapping
      WHERE rdl.cross_rdl_mapping.mapping_id = p_successor_mapping_id
    ) THEN
      RAISE EXCEPTION 'successor mapping % not found', p_successor_mapping_id;
    END IF;
    next_status := 'retired';
  END IF;

  previous_review_context := current_setting('rdl.review_context', true);
  PERFORM set_config('rdl.review_context', 'governed', true);

  BEGIN
    UPDATE rdl.cross_rdl_mapping m
    SET status = next_status,
        reviewed_at = now(),
        reviewed_by = btrim(p_reviewer),
        review_rationale = btrim(p_rationale),
        review_version = current_row.review_version + 1,
        superseded_by_mapping_id = CASE
          WHEN p_action = 'supersede' THEN p_successor_mapping_id
          ELSE NULL
        END
    WHERE m.mapping_id = p_mapping_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'rdl.review_context',
      coalesce(previous_review_context, ''),
      true
    );
    RAISE;
  END;

  -- Critical RDL-011.1 fix: do not leave the transaction in governed mode.
  PERFORM set_config(
    'rdl.review_context',
    coalesce(previous_review_context, ''),
    true
  );

  INSERT INTO rdl.cross_rdl_mapping_review_event(
    mapping_id,
    action,
    from_status,
    to_status,
    reviewer,
    rationale,
    evidence,
    review_version
  ) VALUES (
    p_mapping_id,
    p_action,
    current_row.status,
    next_status,
    btrim(p_reviewer),
    btrim(p_rationale),
    coalesce(p_evidence, '{}'::jsonb),
    current_row.review_version + 1
  );

  RETURN QUERY
  SELECT m.mapping_id, m.status, m.review_version, m.reviewed_by, m.reviewed_at
  FROM rdl.cross_rdl_mapping m
  WHERE m.mapping_id = p_mapping_id;
END;
$$;
