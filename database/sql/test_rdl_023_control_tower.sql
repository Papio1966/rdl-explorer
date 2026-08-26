\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_kpi record;
  v_bad_queue integer;
BEGIN
  IF to_regclass('rdl.enterprise_standards_control_tower_kpi') IS NULL THEN
    RAISE EXCEPTION 'RDL-023 control tower KPI view is missing';
  END IF;
  IF to_regclass('rdl.enterprise_standards_governance_queue') IS NULL THEN
    RAISE EXCEPTION 'RDL-023 governance queue view is missing';
  END IF;
  IF to_regclass('rdl.enterprise_standards_release_health') IS NULL THEN
    RAISE EXCEPTION 'RDL-023 release health view is missing';
  END IF;
  IF to_regclass('rdl.enterprise_standards_adoption_summary') IS NULL THEN
    RAISE EXCEPTION 'RDL-023 adoption summary view is missing';
  END IF;

  SELECT * INTO v_kpi FROM rdl.enterprise_standards_control_tower_kpi;
  IF v_kpi.active_context_count < 0
     OR v_kpi.pending_extension_review_count < 0
     OR v_kpi.published_release_count < 0
     OR v_kpi.enabled_consumer_count < 0
     OR v_kpi.open_migration_plan_count < 0
     OR v_kpi.overdue_migration_action_count < 0 THEN
    RAISE EXCEPTION 'RDL-023 KPI counts must be non-negative';
  END IF;

  SELECT count(*) INTO v_bad_queue
  FROM rdl.enterprise_standards_governance_queue
  WHERE queue_type NOT IN ('extension_review','migration_plan','consumer_notification')
     OR drill_through_path NOT IN ('/extensions','/migration','/integration');
  IF v_bad_queue <> 0 THEN
    RAISE EXCEPTION 'RDL-023 queue must preserve governed workflow drill-through boundaries';
  END IF;

  PERFORM count(*) FROM rdl.enterprise_standards_release_health;
  PERFORM count(*) FROM rdl.enterprise_standards_adoption_summary;

  RAISE NOTICE 'PASS RDL-023 enterprise standards dashboard and control tower';
END $$;

ROLLBACK;
