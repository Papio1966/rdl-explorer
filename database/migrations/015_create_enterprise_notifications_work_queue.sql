-- RDL-024: enterprise notifications and work queue.
-- Durable operational assignments and reminders around governed workflows.
-- Work items orchestrate attention only; they never approve, publish, stage, activate or migrate governed state.

CREATE TABLE IF NOT EXISTS rdl.enterprise_work_item (
  work_item_id bigserial PRIMARY KEY,
  work_key text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('extension_review','consumer_notification','migration_plan','release_impact','publication','other')),
  source_record_key text NOT NULL,
  scope_key text,
  title text NOT NULL,
  summary text,
  drill_through_path text NOT NULL CHECK (drill_through_path LIKE '/%'),
  assignee_key text,
  created_by text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_progress','completed','dismissed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','critical')),
  due_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  last_reminded_at timestamptz,
  escalation_level integer NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  expected_version integer NOT NULL DEFAULT 1 CHECK (expected_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_work_item_assignee_idx
  ON rdl.enterprise_work_item(assignee_key,status,due_at);
CREATE INDEX IF NOT EXISTS enterprise_work_item_source_idx
  ON rdl.enterprise_work_item(source_type,source_record_key);

CREATE TABLE IF NOT EXISTS rdl.enterprise_work_item_event (
  work_item_event_id bigserial PRIMARY KEY,
  work_item_id bigint NOT NULL REFERENCES rdl.enterprise_work_item(work_item_id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created','assigned','acknowledged','started','completed','dismissed','reopened','reminder','escalated')),
  actor_key text NOT NULL,
  from_status text,
  to_status text,
  rationale text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_work_item_event_item_idx
  ON rdl.enterprise_work_item_event(work_item_id,work_item_event_id);

CREATE OR REPLACE FUNCTION rdl.transition_enterprise_work_item(
  p_work_item_id bigint,
  p_action text,
  p_actor_key text,
  p_rationale text,
  p_expected_version integer
) RETURNS SETOF rdl.enterprise_work_item
LANGUAGE plpgsql
AS $$
DECLARE
  v_item rdl.enterprise_work_item%ROWTYPE;
  v_old_status text;
  v_next text;
  v_event text;
BEGIN
  SELECT * INTO v_item FROM rdl.enterprise_work_item WHERE work_item_id=p_work_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work item % does not exist', p_work_item_id; END IF;
  IF v_item.expected_version <> p_expected_version THEN
    RAISE EXCEPTION 'Work item % version conflict: expected %, current %', p_work_item_id, p_expected_version, v_item.expected_version;
  END IF;
  v_old_status := v_item.status;

  CASE p_action
    WHEN 'acknowledge' THEN
      IF v_old_status <> 'open' THEN RAISE EXCEPTION 'Only open work items can be acknowledged'; END IF;
      v_next := 'acknowledged'; v_event := 'acknowledged';
    WHEN 'start' THEN
      IF v_old_status NOT IN ('open','acknowledged') THEN RAISE EXCEPTION 'Only open or acknowledged work items can be started'; END IF;
      v_next := 'in_progress'; v_event := 'started';
    WHEN 'complete' THEN
      IF v_old_status NOT IN ('acknowledged','in_progress') THEN RAISE EXCEPTION 'Work item must be acknowledged or in progress before completion'; END IF;
      v_next := 'completed'; v_event := 'completed';
    WHEN 'dismiss' THEN
      IF v_old_status IN ('completed','dismissed') THEN RAISE EXCEPTION 'Closed work item cannot be dismissed again'; END IF;
      v_next := 'dismissed'; v_event := 'dismissed';
    WHEN 'reopen' THEN
      IF v_old_status NOT IN ('completed','dismissed') THEN RAISE EXCEPTION 'Only closed work items can be reopened'; END IF;
      v_next := 'open'; v_event := 'reopened';
    ELSE RAISE EXCEPTION 'Unsupported work item action %', p_action;
  END CASE;

  UPDATE rdl.enterprise_work_item
     SET status=v_next,
         acknowledged_at=CASE WHEN v_next='acknowledged' THEN COALESCE(acknowledged_at,now()) WHEN v_next='open' THEN NULL ELSE acknowledged_at END,
         completed_at=CASE WHEN v_next='completed' THEN now() WHEN v_next='open' THEN NULL ELSE completed_at END,
         expected_version=expected_version+1,
         updated_at=now()
   WHERE work_item_id=p_work_item_id
   RETURNING * INTO v_item;

  INSERT INTO rdl.enterprise_work_item_event(work_item_id,event_type,actor_key,from_status,to_status,rationale)
  VALUES(p_work_item_id,v_event,p_actor_key,v_old_status,v_next,p_rationale);

  RETURN NEXT v_item;
END $$;

CREATE OR REPLACE FUNCTION rdl.assign_enterprise_work_item(
  p_work_item_id bigint,
  p_assignee_key text,
  p_actor_key text,
  p_rationale text,
  p_expected_version integer
) RETURNS SETOF rdl.enterprise_work_item
LANGUAGE plpgsql
AS $$
DECLARE v_item rdl.enterprise_work_item%ROWTYPE;
BEGIN
  IF trim(COALESCE(p_assignee_key,''))='' THEN RAISE EXCEPTION 'Assignee is required'; END IF;
  UPDATE rdl.enterprise_work_item
     SET assignee_key=trim(p_assignee_key), expected_version=expected_version+1, updated_at=now()
   WHERE work_item_id=p_work_item_id AND expected_version=p_expected_version
   RETURNING * INTO v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work item not found or version conflict'; END IF;
  INSERT INTO rdl.enterprise_work_item_event(work_item_id,event_type,actor_key,rationale,event_payload)
  VALUES(p_work_item_id,'assigned',p_actor_key,p_rationale,jsonb_build_object('assignee',v_item.assignee_key));
  RETURN NEXT v_item;
END $$;

CREATE OR REPLACE FUNCTION rdl.remind_enterprise_work_item(
  p_work_item_id bigint,
  p_actor_key text,
  p_rationale text,
  p_escalate boolean,
  p_expected_version integer
) RETURNS SETOF rdl.enterprise_work_item
LANGUAGE plpgsql
AS $$
DECLARE v_item rdl.enterprise_work_item%ROWTYPE;
BEGIN
  UPDATE rdl.enterprise_work_item
     SET reminder_count=reminder_count+1,
         last_reminded_at=now(),
         escalation_level=LEAST(5,escalation_level+CASE WHEN p_escalate THEN 1 ELSE 0 END),
         priority=CASE WHEN p_escalate THEN CASE WHEN escalation_level >= 1 THEN 'critical' ELSE 'high' END ELSE priority END,
         expected_version=expected_version+1,
         updated_at=now()
   WHERE work_item_id=p_work_item_id AND expected_version=p_expected_version AND status NOT IN ('completed','dismissed')
   RETURNING * INTO v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open work item not found or version conflict'; END IF;
  INSERT INTO rdl.enterprise_work_item_event(work_item_id,event_type,actor_key,rationale,event_payload)
  VALUES(p_work_item_id,CASE WHEN p_escalate THEN 'escalated' ELSE 'reminder' END,p_actor_key,p_rationale,jsonb_build_object('reminderCount',v_item.reminder_count,'escalationLevel',v_item.escalation_level));
  RETURN NEXT v_item;
END $$;

CREATE OR REPLACE VIEW rdl.enterprise_work_queue_summary AS
SELECT
  w.*,
  floor(extract(epoch FROM (now()-w.created_at))/3600)::integer AS age_hours,
  CASE
    WHEN w.status IN ('completed','dismissed') THEN 'closed'
    WHEN w.due_at IS NULL THEN 'no_sla'
    WHEN w.due_at < now() THEN 'overdue'
    WHEN w.due_at <= now()+interval '24 hours' THEN 'due_soon'
    ELSE 'within_sla'
  END::text AS sla_state
FROM rdl.enterprise_work_item w;

COMMENT ON TABLE rdl.enterprise_work_item IS
'RDL-024 durable operational assignment around an authoritative governed workflow. It does not own governance decisions.';
COMMENT ON TABLE rdl.enterprise_work_item_event IS
'RDL-024 append-only audit trail for assignment, acknowledgement, reminder, escalation and completion of operational work.';
COMMENT ON VIEW rdl.enterprise_work_queue_summary IS
'RDL-024 work queue with derived aging and SLA state. SLA indicators are operational only and never change governed lifecycle state.';
