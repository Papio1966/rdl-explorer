BEGIN;

DO $$
DECLARE
  v_id bigint;
  v_version integer;
  v_status text;
  v_sla text;
  v_events integer;
BEGIN
  INSERT INTO rdl.enterprise_work_item(work_key,source_type,source_record_key,scope_key,title,summary,drill_through_path,assignee_key,created_by,priority,due_at)
  VALUES('rdl024-test-'||txid_current(),'migration_plan','test-plan','TEST','Review migration readiness','Self-contained RDL-024 fixture','/migration','reviewer@example.test','test-runner','high',now()+interval '2 hours')
  RETURNING work_item_id,expected_version INTO v_id,v_version;

  INSERT INTO rdl.enterprise_work_item_event(work_item_id,event_type,actor_key,rationale)
  VALUES(v_id,'created','test-runner','RDL-024 acceptance fixture');

  SELECT expected_version INTO v_version FROM rdl.assign_enterprise_work_item(v_id,'owner@example.test','coordinator@example.test','Assign accountable owner',v_version);
  SELECT expected_version,status INTO v_version,v_status FROM rdl.transition_enterprise_work_item(v_id,'acknowledge','owner@example.test','Accepted for review',v_version);
  IF v_status <> 'acknowledged' THEN RAISE EXCEPTION 'Expected acknowledged, got %',v_status; END IF;

  SELECT expected_version,status INTO v_version,v_status FROM rdl.transition_enterprise_work_item(v_id,'start','owner@example.test','Work started',v_version);
  IF v_status <> 'in_progress' THEN RAISE EXCEPTION 'Expected in_progress, got %',v_status; END IF;

  SELECT expected_version INTO v_version FROM rdl.remind_enterprise_work_item(v_id,'coordinator@example.test','SLA reminder',false,v_version);
  SELECT expected_version,priority INTO v_version,v_status FROM rdl.remind_enterprise_work_item(v_id,'coordinator@example.test','Escalate attention',true,v_version);
  IF v_status NOT IN ('high','critical') THEN RAISE EXCEPTION 'Escalation did not preserve/increase priority'; END IF;

  SELECT expected_version,status INTO v_version,v_status FROM rdl.transition_enterprise_work_item(v_id,'complete','owner@example.test','Review completed',v_version);
  IF v_status <> 'completed' THEN RAISE EXCEPTION 'Expected completed, got %',v_status; END IF;

  SELECT sla_state INTO v_sla FROM rdl.enterprise_work_queue_summary WHERE work_item_id=v_id;
  IF v_sla <> 'closed' THEN RAISE EXCEPTION 'Completed work item must report closed SLA state'; END IF;

  SELECT count(*) INTO v_events FROM rdl.enterprise_work_item_event WHERE work_item_id=v_id;
  IF v_events < 6 THEN RAISE EXCEPTION 'Expected append-only work item history'; END IF;

  RAISE NOTICE 'PASS RDL-024 enterprise notifications and work queue';
END $$;

ROLLBACK;
