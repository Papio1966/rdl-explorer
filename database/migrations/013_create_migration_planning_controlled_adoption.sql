-- RDL-022: migration planning and controlled adoption.
-- Advisory impact analysis becomes an explicit plan; no project or consumer is migrated automatically.

CREATE TABLE IF NOT EXISTS rdl.release_migration_plan (
  migration_plan_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_type text NOT NULL CHECK (subject_type IN ('consumer','project')),
  subject_key text NOT NULL CHECK (length(btrim(subject_key)) > 0),
  from_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  to_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  release_change_analysis_id bigint REFERENCES rdl.release_change_analysis(release_change_analysis_id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  owner_key text NOT NULL CHECK (length(btrim(owner_key)) > 0),
  due_date date,
  readiness_status text NOT NULL DEFAULT 'not_ready'
    CHECK (readiness_status IN ('not_ready','in_progress','ready','blocked')),
  lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','in_review','approved','staged','activated','rejected','cancelled')),
  expected_version integer NOT NULL DEFAULT 1 CHECK (expected_version > 0),
  approved_by text,
  approved_at timestamptz,
  staged_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_release_id <> to_release_id),
  CHECK (lifecycle_status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (lifecycle_status <> 'staged' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND staged_at IS NOT NULL)),
  CHECK (lifecycle_status <> 'activated' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND staged_at IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK (lifecycle_status <> 'rejected' OR rejected_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_release_migration_plan_open_subject_target
ON rdl.release_migration_plan(subject_type,subject_key,from_release_id,to_release_id)
WHERE lifecycle_status NOT IN ('activated','rejected','cancelled');

CREATE TABLE IF NOT EXISTS rdl.release_migration_action (
  migration_action_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  migration_plan_id bigint NOT NULL REFERENCES rdl.release_migration_plan(migration_plan_id) ON DELETE CASCADE,
  action_key text NOT NULL CHECK (length(btrim(action_key)) > 0),
  entity_type text,
  native_identifier text,
  change_kind text CHECK (change_kind IS NULL OR change_kind IN ('added','removed','modified','unchanged')),
  breaking boolean NOT NULL DEFAULT false,
  action_text text NOT NULL CHECK (length(btrim(action_text)) > 0),
  owner_key text,
  due_date date,
  action_status text NOT NULL DEFAULT 'open'
    CHECK (action_status IN ('open','in_progress','completed','waived')),
  evidence_text text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (migration_plan_id,action_key),
  CHECK (action_status NOT IN ('completed','waived') OR completed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS rdl.release_migration_history (
  migration_history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  migration_plan_id bigint NOT NULL REFERENCES rdl.release_migration_plan(migration_plan_id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('created','submitted','approved','rejected','staged','activated','cancelled','readiness_changed','action_changed')),
  from_status text,
  to_status text,
  actor text NOT NULL CHECK (length(btrim(actor)) > 0),
  rationale text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION rdl.prevent_release_migration_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'release migration history is append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_release_migration_history_immutable ON rdl.release_migration_history;
CREATE TRIGGER trg_release_migration_history_immutable
BEFORE UPDATE OR DELETE ON rdl.release_migration_history
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_release_migration_history_mutation();

CREATE OR REPLACE FUNCTION rdl.transition_release_migration_plan(
  p_plan_id bigint,
  p_action text,
  p_actor text,
  p_rationale text,
  p_expected_version integer
) RETURNS rdl.release_migration_plan LANGUAGE plpgsql AS $$
DECLARE
  v_plan rdl.release_migration_plan;
  v_from text;
  v_to text;
  v_incomplete integer;
BEGIN
  SELECT * INTO v_plan FROM rdl.release_migration_plan WHERE migration_plan_id=p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'migration plan not found'; END IF;
  IF v_plan.expected_version <> p_expected_version THEN RAISE EXCEPTION 'migration plan version conflict'; END IF;
  IF length(btrim(COALESCE(p_actor,'')))=0 THEN RAISE EXCEPTION 'trusted actor is required'; END IF;
  v_from := v_plan.lifecycle_status;
  v_to := CASE p_action
    WHEN 'submit' THEN 'in_review'
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'stage' THEN 'staged'
    WHEN 'activate' THEN 'activated'
    WHEN 'cancel' THEN 'cancelled'
    ELSE NULL END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'unsupported migration transition'; END IF;

  IF p_action='submit' AND v_from<>'draft' THEN RAISE EXCEPTION 'only draft plans can be submitted'; END IF;
  IF p_action='approve' AND v_from<>'in_review' THEN RAISE EXCEPTION 'only in-review plans can be approved'; END IF;
  IF p_action='reject' AND v_from NOT IN ('draft','in_review','approved','staged') THEN RAISE EXCEPTION 'plan cannot be rejected from current status'; END IF;
  IF p_action='cancel' AND v_from NOT IN ('draft','in_review') THEN RAISE EXCEPTION 'only draft or in-review plans can be cancelled'; END IF;
  IF p_action='stage' THEN
    IF v_from<>'approved' THEN RAISE EXCEPTION 'migration plan must be approved before staging'; END IF;
    IF v_plan.readiness_status<>'ready' THEN RAISE EXCEPTION 'migration plan must be ready before staging'; END IF;
    SELECT count(*) INTO v_incomplete FROM rdl.release_migration_action
      WHERE migration_plan_id=p_plan_id AND action_status NOT IN ('completed','waived');
    IF v_incomplete>0 THEN RAISE EXCEPTION 'all migration actions must be completed or waived before staging'; END IF;
  END IF;
  IF p_action='activate' AND v_from<>'staged' THEN RAISE EXCEPTION 'migration plan must be staged before activation'; END IF;

  UPDATE rdl.release_migration_plan
  SET lifecycle_status=v_to,
      expected_version=expected_version+1,
      approved_by=CASE WHEN p_action='approve' THEN p_actor ELSE approved_by END,
      approved_at=CASE WHEN p_action='approve' THEN now() ELSE approved_at END,
      staged_at=CASE WHEN p_action='stage' THEN now() ELSE staged_at END,
      activated_at=CASE WHEN p_action='activate' THEN now() ELSE activated_at END,
      rejected_at=CASE WHEN p_action='reject' THEN now() ELSE rejected_at END,
      updated_at=now()
  WHERE migration_plan_id=p_plan_id
  RETURNING * INTO v_plan;

  INSERT INTO rdl.release_migration_history(migration_plan_id,event_type,from_status,to_status,actor,rationale)
  VALUES(p_plan_id,CASE p_action WHEN 'submit' THEN 'submitted' ELSE p_action||'d' END,v_from,v_to,p_actor,NULLIF(btrim(COALESCE(p_rationale,'')),''));
  RETURN v_plan;
END;
$$;

CREATE OR REPLACE FUNCTION rdl.set_release_migration_readiness(
  p_plan_id bigint,
  p_readiness text,
  p_actor text,
  p_rationale text,
  p_expected_version integer
) RETURNS rdl.release_migration_plan LANGUAGE plpgsql AS $$
DECLARE v_plan rdl.release_migration_plan; v_old text;
BEGIN
  IF p_readiness NOT IN ('not_ready','in_progress','ready','blocked') THEN RAISE EXCEPTION 'invalid readiness status'; END IF;
  SELECT * INTO v_plan FROM rdl.release_migration_plan WHERE migration_plan_id=p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'migration plan not found'; END IF;
  IF v_plan.expected_version<>p_expected_version THEN RAISE EXCEPTION 'migration plan version conflict'; END IF;
  IF v_plan.lifecycle_status IN ('activated','rejected','cancelled') THEN RAISE EXCEPTION 'terminal migration plans cannot change readiness'; END IF;
  v_old:=v_plan.readiness_status;
  UPDATE rdl.release_migration_plan SET readiness_status=p_readiness,expected_version=expected_version+1,updated_at=now()
  WHERE migration_plan_id=p_plan_id RETURNING * INTO v_plan;
  INSERT INTO rdl.release_migration_history(migration_plan_id,event_type,actor,rationale,event_payload)
  VALUES(p_plan_id,'readiness_changed',p_actor,NULLIF(btrim(COALESCE(p_rationale,'')),''),jsonb_build_object('from',v_old,'to',p_readiness));
  RETURN v_plan;
END;
$$;

CREATE OR REPLACE VIEW rdl.release_migration_plan_summary AS
SELECT p.migration_plan_id,p.subject_type,p.subject_key,p.title,p.rationale,p.owner_key,p.due_date,
       p.readiness_status,p.lifecycle_status,p.expected_version,p.approved_by,p.approved_at,p.staged_at,p.activated_at,
       p.created_by,p.created_at,p.updated_at,
       fr.release_key AS from_release_key,fr.release_version AS from_release_version,
       tr.release_key AS to_release_key,tr.release_version AS to_release_version,
       count(a.migration_action_id)::integer AS action_count,
       count(*) FILTER (WHERE a.action_status NOT IN ('completed','waived'))::integer AS open_action_count,
       count(*) FILTER (WHERE a.breaking)::integer AS breaking_action_count
FROM rdl.release_migration_plan p
JOIN rdl.effective_standard_release fr ON fr.effective_standard_release_id=p.from_release_id
JOIN rdl.effective_standard_release tr ON tr.effective_standard_release_id=p.to_release_id
LEFT JOIN rdl.release_migration_action a ON a.migration_plan_id=p.migration_plan_id
GROUP BY p.migration_plan_id,fr.release_key,fr.release_version,tr.release_key,tr.release_version;

COMMENT ON TABLE rdl.release_migration_plan IS 'Governed source-to-target adoption plan. Approval, readiness and staging are required before explicit activation.';
COMMENT ON TABLE rdl.release_migration_action IS 'Remediation checklist for a migration plan, optionally traced to an impacted release entity.';
