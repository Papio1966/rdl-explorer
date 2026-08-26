BEGIN;
DO $$
DECLARE v_company bigint; v_release bigint; v_next bigint;
BEGIN
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('RDL019-TEST-COMPANY','company','RDL-019 Test Company','draft') RETURNING context_id INTO v_company;
  INSERT INTO rdl.effective_standard_release(context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by)
  VALUES(v_company,'RDL019-TEST','1.0.0',repeat('b',64),'{}','{"packagePins":[]}','{"changes":[]}','publisher@example.test') RETURNING effective_standard_release_id INTO v_release;
  INSERT INTO rdl.effective_standard_release(context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by)
  VALUES(v_company,'RDL019-TEST','1.1.0',repeat('c',64),'{}','{"packagePins":[]}','{"changes":[]}','publisher@example.test') RETURNING effective_standard_release_id INTO v_next;
  INSERT INTO rdl.effective_standard_distribution(effective_standard_release_id,lifecycle_status,compatibility)
  VALUES(v_release,'active','{"contract":"rdl-distribution/v1","minimumConsumerVersion":"1.0"}');
  INSERT INTO rdl.effective_standard_distribution(effective_standard_release_id,lifecycle_status,compatibility)
  VALUES(v_next,'active','{"contract":"rdl-distribution/v1","minimumConsumerVersion":"1.0"}');
  UPDATE rdl.effective_standard_distribution SET lifecycle_status='superseded',superseded_by_release_id=v_next,deprecation_message='Use 1.1.0.' WHERE effective_standard_release_id=v_release;
  IF (SELECT lifecycle_status FROM rdl.distributed_effective_standard_release WHERE release_id=v_release) <> 'superseded' THEN RAISE EXCEPTION 'distribution lifecycle not exposed'; END IF;
  IF (SELECT superseded_by_release_id FROM rdl.distributed_effective_standard_release WHERE release_id=v_release) <> v_next THEN RAISE EXCEPTION 'superseding release not exposed'; END IF;
  BEGIN
    UPDATE rdl.effective_standard_distribution SET superseded_by_release_id=v_release WHERE effective_standard_release_id=v_release;
    RAISE EXCEPTION 'self supersession was not blocked';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS RDL-019 published package distribution and consumption contract';
END $$;
ROLLBACK;
