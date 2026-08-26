BEGIN;
DO $$
DECLARE
  v_company bigint;
  v_release bigint;
  v_entity_type text;
BEGIN
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('RDL018-TEST-COMPANY','company','RDL-018 Test Company','draft')
  RETURNING context_id INTO v_company;

  SELECT entity_type_code INTO v_entity_type FROM rdl.entity_type ORDER BY entity_type_code LIMIT 1;
  IF v_entity_type IS NULL THEN RAISE EXCEPTION 'entity type seed required'; END IF;

  INSERT INTO rdl.context_extension_change(context_id,change_kind,entity_type_code,native_identifier,proposed_name,status,rationale,proposed_by,approved_by,approved_at)
  VALUES (v_company,'add',v_entity_type,'RDL018-NEW-CLASS','RDL-018 New Class','approved','Approved extension for publication comparison test.','author@example.test','reviewer@example.test',now());

  INSERT INTO rdl.effective_standard_release(
    context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by
  ) VALUES (
    v_company,'RDL018-TEST','1.0.0',repeat('a',64),
    '{"inherited":0,"added":1,"overridden":0,"retired":0}'::jsonb,
    '{"contextKey":"RDL018-TEST-COMPANY","releaseVersion":"1.0.0"}'::jsonb,
    '{"entities":[{"changeKind":"add","nativeIdentifier":"RDL018-NEW-CLASS"}]}'::jsonb,
    'publisher@example.test'
  ) RETURNING effective_standard_release_id INTO v_release;

  BEGIN
    UPDATE rdl.effective_standard_release SET release_version='1.0.1' WHERE effective_standard_release_id=v_release;
    RAISE EXCEPTION 'published effective standard release mutation was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%immutable%' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM rdl.effective_standard_release_summary WHERE effective_standard_release_id=v_release)<>1 THEN
    RAISE EXCEPTION 'release summary view did not expose published release';
  END IF;

  RAISE NOTICE 'PASS RDL-018 effective standard comparison and publication';
END $$;
ROLLBACK;
