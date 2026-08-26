BEGIN;
DO $$
DECLARE
  v_from bigint;
  v_to bigint;
  v_context bigint;
  v_plan bigint;
  v_version integer;
  v_status text;
  v_fixture_suffix text;
  v_fixture_sha text;
BEGIN
  -- RDL-022 acceptance test is deliberately self-contained. The developer database
  -- may legitimately contain zero, one, or many published effective-standard releases.
  -- Any missing prerequisite context/releases are created inside this transaction and
  -- disappear at ROLLBACK.
  v_fixture_suffix := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');

  SELECT effective_standard_release_id, context_id
  INTO v_from, v_context
  FROM rdl.effective_standard_release
  ORDER BY effective_standard_release_id
  LIMIT 1;

  IF v_from IS NULL THEN
    -- Reuse any enterprise context if one exists; otherwise create a transaction-local
    -- Company context. effective_standard_release only requires a valid context_id.
    SELECT context_id
    INTO v_context
    FROM rdl.enterprise_context
    ORDER BY context_id
    LIMIT 1;

    IF v_context IS NULL THEN
      INSERT INTO rdl.enterprise_context(
        context_key,
        context_type,
        name,
        owner_reference,
        status
      )
      VALUES(
        'rdl022-fixture-company-' || v_fixture_suffix,
        'company',
        'RDL-022 acceptance fixture company',
        'rdl-022-acceptance-test',
        'draft'
      )
      RETURNING context_id INTO v_context;
    END IF;

    v_fixture_sha := md5('rdl022-from-' || v_fixture_suffix) || md5(v_fixture_suffix || '-from');

    INSERT INTO rdl.effective_standard_release(
      context_id,
      release_key,
      release_version,
      composition_sha256,
      comparison_summary,
      package_manifest,
      package_payload,
      published_by
    )
    VALUES(
      v_context,
      'rdl022-fixture-from-' || v_fixture_suffix,
      '0.0.1-rdl022-fixture-' || v_fixture_suffix,
      v_fixture_sha,
      jsonb_build_object('fixture', true, 'purpose', 'RDL-022 source release'),
      jsonb_build_object('fixture', true, 'kind', 'source'),
      jsonb_build_object('fixture', true, 'entities', jsonb_build_array()),
      'rdl-022-acceptance-test'
    )
    RETURNING effective_standard_release_id INTO v_from;
  END IF;

  SELECT effective_standard_release_id
  INTO v_to
  FROM rdl.effective_standard_release
  WHERE effective_standard_release_id <> v_from
  ORDER BY effective_standard_release_id
  LIMIT 1;

  IF v_to IS NULL THEN
    SELECT context_id INTO v_context
    FROM rdl.effective_standard_release
    WHERE effective_standard_release_id = v_from;

    v_fixture_sha := md5('rdl022-to-' || v_fixture_suffix) || md5(v_fixture_suffix || '-to');

    INSERT INTO rdl.effective_standard_release(
      context_id,
      release_key,
      release_version,
      composition_sha256,
      comparison_summary,
      package_manifest,
      package_payload,
      published_by
    )
    VALUES(
      v_context,
      'rdl022-fixture-to-' || v_fixture_suffix,
      '0.0.2-rdl022-fixture-' || v_fixture_suffix,
      v_fixture_sha,
      jsonb_build_object('fixture', true, 'purpose', 'RDL-022 target release'),
      jsonb_build_object('fixture', true, 'kind', 'target', 'source_release_id', v_from),
      jsonb_build_object('fixture', true, 'entities', jsonb_build_array(), 'source_release_id', v_from),
      'rdl-022-acceptance-test'
    )
    RETURNING effective_standard_release_id INTO v_to;
  END IF;

  INSERT INTO rdl.release_migration_plan(subject_type,subject_key,from_release_id,to_release_id,title,rationale,owner_key,created_by)
  VALUES('consumer','rdl022-test-consumer',v_from,v_to,'RDL-022 controlled adoption test','Validate approval and staging gates.','owner@example.test','author@example.test')
  RETURNING migration_plan_id,expected_version INTO v_plan,v_version;

  INSERT INTO rdl.release_migration_history(migration_plan_id,event_type,actor,rationale)
  VALUES(v_plan,'created','author@example.test','Acceptance test plan created.');

  INSERT INTO rdl.release_migration_action(migration_plan_id,action_key,entity_type,native_identifier,change_kind,breaking,action_text,owner_key)
  VALUES(v_plan,'review-breaking-property','property','TEST-PROP','modified',true,'Review downstream mapping impact.','owner@example.test');

  BEGIN
    PERFORM rdl.transition_release_migration_plan(v_plan,'stage','owner@example.test','Must fail before approval.',v_version);
    RAISE EXCEPTION 'staging before approval was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%approved before staging%' THEN RAISE; END IF;
  END;

  SELECT expected_version INTO v_version FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  PERFORM rdl.transition_release_migration_plan(v_plan,'submit','author@example.test','Ready for review.',v_version);
  SELECT expected_version INTO v_version FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  PERFORM rdl.transition_release_migration_plan(v_plan,'approve','approver@example.test','Impact and remediation approach accepted.',v_version);

  SELECT expected_version INTO v_version FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  BEGIN
    PERFORM rdl.transition_release_migration_plan(v_plan,'stage','owner@example.test','Must fail until checklist and readiness are complete.',v_version);
    RAISE EXCEPTION 'staging without readiness/actions was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%must be ready%' THEN RAISE; END IF;
  END;

  UPDATE rdl.release_migration_action
  SET action_status='completed',completed_at=now(),evidence_text='Mapping regression checked.',updated_at=now()
  WHERE migration_plan_id=v_plan;

  SELECT expected_version INTO v_version FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  PERFORM rdl.set_release_migration_readiness(v_plan,'ready','owner@example.test','Checklist complete.',v_version);
  SELECT expected_version INTO v_version FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  PERFORM rdl.transition_release_migration_plan(v_plan,'stage','owner@example.test','Controlled staging complete.',v_version);
  SELECT expected_version INTO v_version FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  PERFORM rdl.transition_release_migration_plan(v_plan,'activate','approver@example.test','Explicit adoption approved.',v_version);

  SELECT lifecycle_status INTO v_status FROM rdl.release_migration_plan WHERE migration_plan_id=v_plan;
  IF v_status<>'activated' THEN RAISE EXCEPTION 'expected activated plan, got %',v_status; END IF;
  IF (SELECT count(*) FROM rdl.release_migration_history WHERE migration_plan_id=v_plan)<5 THEN RAISE EXCEPTION 'migration audit history is incomplete'; END IF;
  RAISE NOTICE 'PASS RDL-022 migration planning and controlled adoption';
END $$;
ROLLBACK;
