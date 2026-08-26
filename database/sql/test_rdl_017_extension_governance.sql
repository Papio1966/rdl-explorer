BEGIN;
DO $$
DECLARE
  v_company bigint;
  v_extension bigint;
  v_status text;
  v_version integer;
  v_events integer;
BEGIN
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('RDL017-TEST-COMPANY','company','RDL-017 Test Company','draft')
  RETURNING context_id INTO v_company;

  INSERT INTO rdl.context_extension_change(context_id,change_kind,entity_type_code,native_identifier,proposed_name,status,rationale,proposed_by)
  SELECT v_company,'add',entity_type_code,'RDL017-VACUUM-TOILET','Vacuum toilet','draft','Dedicated maintainable equipment class required for the project.','author@example.test'
  FROM rdl.entity_type ORDER BY entity_type_code LIMIT 1
  RETURNING extension_change_id INTO v_extension;

  SELECT status,review_version INTO v_status,v_version FROM rdl.context_extension_change WHERE extension_change_id=v_extension;
  IF v_status<>'draft' OR v_version<>0 THEN RAISE EXCEPTION 'new extension must be draft v0'; END IF;

  PERFORM rdl.review_context_extension(v_extension,'submit','author@example.test','Submit extension for engineering standards review.','{}'::jsonb,0);
  SELECT status,review_version INTO v_status,v_version FROM rdl.context_extension_change WHERE extension_change_id=v_extension;
  IF v_status<>'in_review' OR v_version<>1 THEN RAISE EXCEPTION 'submit transition failed'; END IF;

  PERFORM rdl.review_context_extension(v_extension,'approve','reviewer@example.test','Approved because the maintenance strategy requires separate classification.','{}'::jsonb,1);
  SELECT status,review_version INTO v_status,v_version FROM rdl.context_extension_change WHERE extension_change_id=v_extension;
  IF v_status<>'approved' OR v_version<>2 THEN RAISE EXCEPTION 'approve transition failed'; END IF;

  SELECT count(*) INTO v_events FROM rdl.context_extension_review_event WHERE extension_change_id=v_extension;
  IF v_events<>2 THEN RAISE EXCEPTION 'expected two append-only review events'; END IF;

  BEGIN
    PERFORM rdl.review_context_extension(v_extension,'retire','reviewer@example.test','Retire after standard supersession by an approved replacement.','{}'::jsonb,1);
    RAISE EXCEPTION 'expected optimistic version conflict';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%version conflict%' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM rdl.extension_conflicts(v_company,(SELECT entity_type_code FROM rdl.context_extension_change WHERE extension_change_id=v_extension),'RDL017-VACUUM-TOILET',v_extension))<>0 THEN
    RAISE EXCEPTION 'self excluded extension must not conflict with itself';
  END IF;

  RAISE NOTICE 'PASS RDL-017 enterprise extension authoring and governance';
END $$;
ROLLBACK;
