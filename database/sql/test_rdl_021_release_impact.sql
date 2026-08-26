BEGIN;
DO $$
DECLARE v_context bigint; v_from bigint; v_to bigint; v_analysis bigint; v_count integer;
BEGIN
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('RDL021-TEST-COMPANY','company','RDL-021 Test Company','draft') RETURNING context_id INTO v_context;

  INSERT INTO rdl.effective_standard_release(context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by)
  VALUES(v_context,'RDL021-TEST','1.0.0',repeat('1',64),'{}','{}','{"changes":[{"entityType":"property","nativeIdentifier":"P-1","effectiveName":"Pressure"}]}','tester')
  RETURNING effective_standard_release_id INTO v_from;
  INSERT INTO rdl.effective_standard_release(context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by)
  VALUES(v_context,'RDL021-TEST','1.1.0',repeat('2',64),'{}','{}','{"changes":[{"entityType":"property","nativeIdentifier":"P-1","effectiveName":"Operating pressure"},{"entityType":"document_type","nativeIdentifier":"D-1","effectiveName":"Data sheet"}]}','tester')
  RETURNING effective_standard_release_id INTO v_to;

  INSERT INTO rdl.release_change_analysis(from_release_id,to_release_id,change_summary,impact_summary,release_notes,analysis_sha256,generated_by)
  VALUES(v_from,v_to,'{"modified":1,"added":1,"removed":0,"breaking":1}','{"pinnedConsumers":0,"activatedConsumers":0}','{"title":"RDL-021 test delta"}',repeat('a',64),'tester')
  RETURNING release_change_analysis_id INTO v_analysis;

  SELECT count(*) INTO v_count FROM rdl.release_change_analysis WHERE release_change_analysis_id=v_analysis AND analysis_contract='rdl-release-impact/v1';
  IF v_count <> 1 THEN RAISE EXCEPTION 'release impact analysis was not persisted'; END IF;

  BEGIN
    UPDATE rdl.release_change_analysis SET generated_by='mutator' WHERE release_change_analysis_id=v_analysis;
    RAISE EXCEPTION 'immutable release analysis mutation was not blocked';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'immutable release analysis mutation was not blocked' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS RDL-021 release change intelligence and impact analysis';
END $$;
ROLLBACK;
