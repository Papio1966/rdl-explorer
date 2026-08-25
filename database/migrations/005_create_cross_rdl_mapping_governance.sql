-- RDL-011: governed review and audit workflow for cross-RDL mappings.
-- Review decisions are server-side database operations. Browser code remains read-only.

ALTER TABLE rdl.cross_rdl_mapping
  ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_rationale text,
  ADD COLUMN IF NOT EXISTS superseded_by_mapping_id bigint REFERENCES rdl.cross_rdl_mapping(mapping_id);

CREATE TABLE IF NOT EXISTS rdl.cross_rdl_mapping_review_event (
  review_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mapping_id bigint NOT NULL REFERENCES rdl.cross_rdl_mapping(mapping_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve','reject','supersede')),
  from_status text NOT NULL,
  to_status text NOT NULL,
  reviewer text NOT NULL CHECK (length(btrim(reviewer)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_version integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cross_rdl_review_event_mapping
  ON rdl.cross_rdl_mapping_review_event(mapping_id, occurred_at, review_event_id);
CREATE INDEX IF NOT EXISTS idx_cross_rdl_review_event_reviewer
  ON rdl.cross_rdl_mapping_review_event(reviewer, occurred_at);

COMMENT ON TABLE rdl.cross_rdl_mapping_review_event IS
  'Append-only review audit trail for governed cross-RDL mapping decisions.';

CREATE OR REPLACE FUNCTION rdl.prevent_cross_rdl_review_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'cross_rdl_mapping_review_event is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_cross_rdl_review_event_append_only ON rdl.cross_rdl_mapping_review_event;
CREATE TRIGGER trg_cross_rdl_review_event_append_only
BEFORE UPDATE OR DELETE ON rdl.cross_rdl_mapping_review_event
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_cross_rdl_review_event_mutation();

CREATE OR REPLACE FUNCTION rdl.prevent_direct_cross_rdl_review_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('rdl.review_context', true) IS DISTINCT FROM 'governed' AND
     (NEW.status IS DISTINCT FROM OLD.status OR
      NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
      NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
      NEW.review_rationale IS DISTINCT FROM OLD.review_rationale OR
      NEW.review_version IS DISTINCT FROM OLD.review_version OR
      NEW.superseded_by_mapping_id IS DISTINCT FROM OLD.superseded_by_mapping_id) THEN
    RAISE EXCEPTION 'review fields must be changed through rdl.review_cross_rdl_mapping';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cross_rdl_mapping_governed_review ON rdl.cross_rdl_mapping;
CREATE TRIGGER trg_cross_rdl_mapping_governed_review
BEFORE UPDATE ON rdl.cross_rdl_mapping
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_direct_cross_rdl_review_update();

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
BEGIN
  IF p_action NOT IN ('approve','reject','supersede') THEN
    RAISE EXCEPTION 'unsupported review action: %', p_action;
  END IF;
  IF length(btrim(coalesce(p_reviewer,''))) = 0 OR length(btrim(coalesce(p_rationale,''))) = 0 THEN
    RAISE EXCEPTION 'reviewer and rationale are required';
  END IF;

  SELECT * INTO current_row FROM rdl.cross_rdl_mapping WHERE rdl.cross_rdl_mapping.mapping_id=p_mapping_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mapping % not found', p_mapping_id; END IF;
  IF p_expected_version IS NOT NULL AND current_row.review_version <> p_expected_version THEN
    RAISE EXCEPTION 'review version conflict for mapping %: expected %, actual %', p_mapping_id, p_expected_version, current_row.review_version;
  END IF;

  IF p_action='approve' THEN
    IF current_row.status <> 'candidate' THEN RAISE EXCEPTION 'only candidate mappings can be approved'; END IF;
    next_status := 'approved';
  ELSIF p_action='reject' THEN
    IF current_row.status <> 'candidate' THEN RAISE EXCEPTION 'only candidate mappings can be rejected'; END IF;
    next_status := 'rejected';
  ELSE
    IF current_row.status <> 'approved' THEN RAISE EXCEPTION 'only approved mappings can be superseded'; END IF;
    IF p_successor_mapping_id IS NULL OR p_successor_mapping_id=p_mapping_id THEN
      RAISE EXCEPTION 'supersede requires a different successor mapping';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rdl.cross_rdl_mapping WHERE rdl.cross_rdl_mapping.mapping_id=p_successor_mapping_id) THEN
      RAISE EXCEPTION 'successor mapping % not found', p_successor_mapping_id;
    END IF;
    next_status := 'retired';
  END IF;

  PERFORM set_config('rdl.review_context','governed',true);
  UPDATE rdl.cross_rdl_mapping m
  SET status=next_status,
      reviewed_at=now(),
      reviewed_by=btrim(p_reviewer),
      review_rationale=btrim(p_rationale),
      review_version=current_row.review_version+1,
      superseded_by_mapping_id=CASE WHEN p_action='supersede' THEN p_successor_mapping_id ELSE NULL END
  WHERE m.mapping_id=p_mapping_id;

  INSERT INTO rdl.cross_rdl_mapping_review_event(
    mapping_id, action, from_status, to_status, reviewer, rationale, evidence, review_version
  ) VALUES (
    p_mapping_id, p_action, current_row.status, next_status, btrim(p_reviewer), btrim(p_rationale),
    coalesce(p_evidence,'{}'::jsonb), current_row.review_version+1
  );

  RETURN QUERY
  SELECT m.mapping_id, m.status, m.review_version, m.reviewed_by, m.reviewed_at
  FROM rdl.cross_rdl_mapping m WHERE m.mapping_id=p_mapping_id;
END;
$$;
