-- RDL-017: enterprise extension authoring and governance.
-- Extends the RDL-016 hierarchy with draft/review workflow, optimistic review versioning,
-- append-only audit history, conflict detection and effective-preview support.

ALTER TABLE rdl.context_extension_change
  ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS review_rationale text;

ALTER TABLE rdl.context_extension_change
  DROP CONSTRAINT IF EXISTS context_extension_change_status_check;

ALTER TABLE rdl.context_extension_change
  ADD CONSTRAINT context_extension_change_status_check
  CHECK (status IN ('draft','candidate','in_review','approved','rejected','retired'));

CREATE TABLE IF NOT EXISTS rdl.context_extension_review_event (
  review_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  extension_change_id bigint NOT NULL REFERENCES rdl.context_extension_change(extension_change_id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('submit','approve','reject','retire')),
  from_status text NOT NULL,
  to_status text NOT NULL,
  reviewer text NOT NULL CHECK (length(btrim(reviewer)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) >= 10),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_version integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_extension_review_event_change
  ON rdl.context_extension_review_event(extension_change_id,review_event_id);

CREATE OR REPLACE FUNCTION rdl.prevent_extension_review_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'context extension review events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_context_extension_review_event_immutable ON rdl.context_extension_review_event;
CREATE TRIGGER trg_context_extension_review_event_immutable
BEFORE UPDATE OR DELETE ON rdl.context_extension_review_event
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_extension_review_event_mutation();

CREATE OR REPLACE FUNCTION rdl.review_context_extension(
  p_extension_change_id bigint,
  p_action text,
  p_reviewer text,
  p_rationale text,
  p_evidence jsonb,
  p_expected_version integer
)
RETURNS rdl.context_extension_change
LANGUAGE plpgsql AS $$
DECLARE
  v_change rdl.context_extension_change%ROWTYPE;
  v_from text;
  v_to text;
BEGIN
  IF length(btrim(coalesce(p_reviewer,''))) = 0 THEN RAISE EXCEPTION 'reviewer is required'; END IF;
  IF length(btrim(coalesce(p_rationale,''))) < 10 THEN RAISE EXCEPTION 'review rationale must be at least 10 characters'; END IF;

  SELECT * INTO v_change
  FROM rdl.context_extension_change
  WHERE extension_change_id=p_extension_change_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'extension change % not found', p_extension_change_id; END IF;
  IF v_change.review_version <> p_expected_version THEN
    RAISE EXCEPTION 'extension version conflict: expected %, actual %', p_expected_version, v_change.review_version;
  END IF;

  v_from := v_change.status;
  v_to := CASE
    WHEN p_action='submit' AND v_from IN ('draft','candidate','rejected') THEN 'in_review'
    WHEN p_action='approve' AND v_from='in_review' THEN 'approved'
    WHEN p_action='reject' AND v_from='in_review' THEN 'rejected'
    WHEN p_action='retire' AND v_from='approved' THEN 'retired'
    ELSE NULL
  END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'unsupported extension transition: % from %', p_action, v_from; END IF;

  UPDATE rdl.context_extension_change
  SET status=v_to,
      review_version=review_version+1,
      submitted_at=CASE WHEN p_action='submit' THEN now() ELSE submitted_at END,
      reviewed_at=CASE WHEN p_action IN ('approve','reject','retire') THEN now() ELSE reviewed_at END,
      reviewed_by=CASE WHEN p_action IN ('approve','reject','retire') THEN p_reviewer ELSE reviewed_by END,
      review_rationale=CASE WHEN p_action IN ('approve','reject','retire') THEN btrim(p_rationale) ELSE review_rationale END,
      approved_by=CASE WHEN p_action='approve' THEN p_reviewer ELSE approved_by END,
      approved_at=CASE WHEN p_action='approve' THEN now() ELSE approved_at END
  WHERE extension_change_id=p_extension_change_id
  RETURNING * INTO v_change;

  INSERT INTO rdl.context_extension_review_event(
    extension_change_id,action,from_status,to_status,reviewer,rationale,evidence,review_version
  ) VALUES (
    p_extension_change_id,p_action,v_from,v_to,p_reviewer,btrim(p_rationale),coalesce(p_evidence,'{}'::jsonb),v_change.review_version
  );

  RETURN v_change;
END;
$$;

CREATE OR REPLACE FUNCTION rdl.extension_conflicts(
  p_context_id bigint,
  p_entity_type_code text,
  p_native_identifier text,
  p_exclude_extension_change_id bigint DEFAULT NULL
)
RETURNS TABLE(
  extension_change_id bigint,
  context_key text,
  context_type text,
  change_kind text,
  status text,
  proposed_name text,
  rationale text
)
LANGUAGE sql STABLE AS $$
  SELECT ch.extension_change_id,c.context_key,c.context_type,ch.change_kind,ch.status,ch.proposed_name,ch.rationale
  FROM rdl.context_lineage(p_context_id) l
  JOIN rdl.enterprise_context c ON c.context_id=l.context_id
  JOIN rdl.context_extension_change ch ON ch.context_id=c.context_id
  WHERE ch.entity_type_code=p_entity_type_code
    AND ch.native_identifier=p_native_identifier
    AND (ch.status IN ('draft','candidate','in_review') OR (ch.status='approved' AND ch.context_id=p_context_id))
    AND (p_exclude_extension_change_id IS NULL OR ch.extension_change_id<>p_exclude_extension_change_id)
  ORDER BY l.depth DESC,ch.extension_change_id;
$$;

CREATE OR REPLACE VIEW rdl.context_extension_governance_queue AS
SELECT ch.extension_change_id,ch.context_id,c.context_key,c.context_type,c.name AS context_name,c.status AS context_status,
       ch.change_kind,ch.entity_type_code,ch.native_identifier,ch.base_entity_id,ch.proposed_name,ch.proposed_definition,
       ch.status,ch.rationale,ch.provenance,ch.proposed_by,ch.proposed_at,ch.submitted_at,ch.reviewed_at,ch.reviewed_by,
       ch.review_rationale,ch.review_version
FROM rdl.context_extension_change ch
JOIN rdl.enterprise_context c ON c.context_id=ch.context_id;

COMMENT ON TABLE rdl.context_extension_review_event IS 'Append-only audit trail for enterprise extension submit/approve/reject/retire decisions.';
COMMENT ON FUNCTION rdl.review_context_extension IS 'Governed optimistic-locking transition function for RDL-017 enterprise extension lifecycle.';
COMMENT ON FUNCTION rdl.extension_conflicts IS 'Returns same-identity extension changes in the selected context lineage for pre-publication conflict detection.';
