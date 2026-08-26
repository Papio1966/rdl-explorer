\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  v_package bigint;
  v_company bigint;
  v_asset bigint;
  v_project bigint;
  v_count integer;
BEGIN
  SELECT package_id INTO v_package FROM rdl.rdl_package WHERE package_key LIKE 'cfihos-2.0-%' ORDER BY package_id DESC LIMIT 1;
  IF v_package IS NULL THEN RAISE EXCEPTION 'CFIHOS normalized package is required for RDL-016 test'; END IF;

  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('rdl016-test-company','company','RDL-016 Test Company','draft') RETURNING context_id INTO v_company;
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,parent_context_id,status)
  VALUES ('rdl016-test-asset','asset','RDL-016 Test Asset',v_company,'draft') RETURNING context_id INTO v_asset;
  INSERT INTO rdl.enterprise_context(context_key,context_type,name,parent_context_id,status)
  VALUES ('rdl016-test-project','project','RDL-016 Test Project',v_asset,'draft') RETURNING context_id INTO v_project;

  INSERT INTO rdl.context_package_pin(context_id,layer_type,package_id,precedence,pin_reason)
  VALUES (v_project,'industry',v_package,100,'Pin exact reviewed industry baseline');

  SELECT count(*) INTO v_count FROM rdl.context_lineage(v_project);
  IF v_count <> 3 THEN RAISE EXCEPTION 'expected company -> asset -> project lineage, got % rows',v_count; END IF;

  INSERT INTO rdl.context_extension_change(context_id,change_kind,entity_type_code,native_identifier,proposed_name,status,rationale,provenance)
  VALUES (v_project,'add','equipment_class','PROJECT-VACUUM-TOILET','Vacuum toilet','approved','Project-specific maintenance classification requirement','{"source":"project engineering review"}');

  UPDATE rdl.enterprise_context SET status='active',activated_at=now() WHERE context_id=v_project;

  BEGIN
    UPDATE rdl.context_package_pin SET precedence=110 WHERE context_id=v_project AND layer_type='industry';
    RAISE EXCEPTION 'active project package pin mutation was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='active project package pin mutation was not blocked' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
    VALUES ('rdl016-invalid-asset','asset','Invalid asset','draft');
    RAISE EXCEPTION 'asset without company parent was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='asset without company parent was not blocked' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS RDL-016 enterprise RDL hierarchy and extension governance';
END $$;
ROLLBACK;
