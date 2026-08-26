BEGIN;
DO $$
DECLARE v_company bigint; v_release bigint; v_subscription bigint; v_notification bigint; v_count integer;
BEGIN
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('RDL020-TEST-COMPANY','company','RDL-020 Test Company','draft') RETURNING context_id INTO v_company;

  INSERT INTO rdl.consumer_subscription(consumer_key,context_key,notification_mode)
  VALUES ('datagate-reference','RDL020-TEST-COMPANY','pull') RETURNING subscription_id INTO v_subscription;

  INSERT INTO rdl.effective_standard_release(context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by)
  VALUES(v_company,'RDL020-TEST','1.0.0',repeat('d',64),'{}','{"packagePins":[]}','{"changes":[]}','publisher@example.test')
  RETURNING effective_standard_release_id INTO v_release;

  SELECT count(*) INTO v_count FROM rdl.release_notification WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release AND event_type='release.published';
  IF v_count <> 1 THEN RAISE EXCEPTION 'publication notification not created exactly once'; END IF;

  SELECT notification_id INTO v_notification FROM rdl.release_notification WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release;
  UPDATE rdl.release_notification SET acknowledged_at=now(),acknowledged_by='consumer@example.test' WHERE notification_id=v_notification;

  BEGIN
    UPDATE rdl.consumer_release_state SET lifecycle_status='activated',activated_at=now() WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release;
    RAISE EXCEPTION 'activation without staging was not blocked';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'activation without staging was not blocked' THEN RAISE; END IF;
  END;

  UPDATE rdl.consumer_release_state
  SET lifecycle_status='staged',package_sha256=repeat('d',64),staged_at=now()
  WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release;

  INSERT INTO rdl.consumer_pull_receipt(subscription_id,effective_standard_release_id,request_key,package_sha256)
  VALUES(v_subscription,v_release,'pull-001',repeat('d',64));
  INSERT INTO rdl.consumer_pull_receipt(subscription_id,effective_standard_release_id,request_key,package_sha256)
  VALUES(v_subscription,v_release,'pull-001',repeat('d',64)) ON CONFLICT (subscription_id,request_key) DO NOTHING;
  SELECT count(*) INTO v_count FROM rdl.consumer_pull_receipt WHERE subscription_id=v_subscription AND request_key='pull-001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'idempotent pull receipt failed'; END IF;

  UPDATE rdl.consumer_release_state SET lifecycle_status='activated',activated_at=now()
  WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release;
  IF (SELECT lifecycle_status FROM rdl.consumer_release_state WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release) <> 'activated' THEN
    RAISE EXCEPTION 'explicit activation failed';
  END IF;

  PERFORM rdl.enqueue_release_notifications(v_release,'release.published','review_required','{}');
  SELECT count(*) INTO v_count FROM rdl.release_notification WHERE subscription_id=v_subscription AND effective_standard_release_id=v_release AND event_type='release.published';
  IF v_count <> 1 THEN RAISE EXCEPTION 'notification idempotency failed'; END IF;

  RAISE NOTICE 'PASS RDL-020 consumer integration contract and change notification';
END $$;
ROLLBACK;
