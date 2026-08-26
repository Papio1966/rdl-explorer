\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE v_failed boolean := false;
BEGIN
  IF to_regclass('rdl.enterprise_identity_user') IS NULL OR to_regclass('rdl.enterprise_identity_audit_event') IS NULL THEN
    RAISE EXCEPTION 'RDL-027 identity tables missing';
  END IF;

  INSERT INTO rdl.enterprise_identity_user(subject_key,email,display_name,last_authenticated_at)
  VALUES('rdl027:test-user','test@example.invalid','RDL-027 Tester',now());
  INSERT INTO rdl.enterprise_role_assignment(subject_key,role_key,assigned_by)
  VALUES('rdl027:test-user','rdl-ai-standards-analyst','rdl027:admin');
  INSERT INTO rdl.enterprise_group_role_mapping(group_key,role_key,created_by)
  VALUES('rdl027:test-group','rdl-work-queue-coordinator','rdl027:admin');
  INSERT INTO rdl.enterprise_identity_audit_event(event_type,actor_subject_key,target_subject_key,target_role_key,rationale)
  VALUES('role_assigned','rdl027:admin','rdl027:test-user','rdl-ai-standards-analyst','self-contained acceptance fixture');

  IF NOT EXISTS (SELECT 1 FROM rdl.enterprise_identity_directory WHERE subject_key='rdl027:test-user' AND 'rdl-ai-standards-analyst'=ANY(direct_roles)) THEN
    RAISE EXCEPTION 'RDL-027 role directory projection failed';
  END IF;

  BEGIN UPDATE rdl.enterprise_identity_audit_event SET rationale='mutated' WHERE target_subject_key='rdl027:test-user';
  EXCEPTION WHEN OTHERS THEN v_failed := true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'RDL-027 identity audit must be append-only'; END IF;

  RAISE NOTICE 'PASS RDL-027 enterprise SSO user identity and role administration';
END $$;
ROLLBACK;
\echo 'PASS RDL-027 enterprise SSO user identity and role administration'
