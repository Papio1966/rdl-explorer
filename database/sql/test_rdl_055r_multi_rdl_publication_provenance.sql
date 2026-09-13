BEGIN;

DO $$
DECLARE
  v_context_id bigint;
  v_package_1 bigint;
  v_package_2 bigint;
  v_package_3 bigint;
  v_constraint_count integer;
  v_index_count integer;
  v_trigger_def text;
  v_failed boolean;
BEGIN
  SELECT count(*) INTO v_constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname='rdl'
    AND t.relname='context_package_pin'
    AND c.contype='u'
    AND pg_get_constraintdef(c.oid) = 'UNIQUE (context_id, layer_type)';
  IF v_constraint_count <> 0 THEN
    RAISE EXCEPTION 'obsolete one-package-per-layer unique constraint remains';
  END IF;

  SELECT count(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname='rdl'
    AND tablename='context_package_pin'
    AND indexname='uq_context_package_pin_context_layer_package';
  IF v_index_count <> 1 THEN
    RAISE EXCEPTION 'context/layer/package uniqueness index is missing';
  END IF;

  SELECT pg_get_triggerdef(t.oid) INTO v_trigger_def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='rdl' AND c.relname='context_package_pin'
    AND t.tgname='trg_context_package_pin_immutable' AND NOT t.tgisinternal;
  IF v_trigger_def IS NULL OR position('INSERT' in v_trigger_def)=0 OR position('UPDATE' in v_trigger_def)=0 OR position('DELETE' in v_trigger_def)=0 THEN
    RAISE EXCEPTION 'active-context pin trigger must cover INSERT, UPDATE and DELETE';
  END IF;

  SELECT p.package_id INTO v_package_1
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r ON r.release_id=p.release_id
  ORDER BY r.source_id,p.package_id LIMIT 1;

  SELECT p.package_id INTO v_package_2
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r ON r.release_id=p.release_id
  WHERE r.source_id <> (
    SELECT r1.source_id FROM rdl.rdl_package p1 JOIN rdl.rdl_release r1 ON r1.release_id=p1.release_id WHERE p1.package_id=v_package_1
  )
  ORDER BY r.source_id,p.package_id LIMIT 1;

  SELECT p.package_id INTO v_package_3
  FROM rdl.rdl_package p
  WHERE p.package_id NOT IN (v_package_1,v_package_2)
  ORDER BY p.package_id LIMIT 1;

  IF v_package_1 IS NULL OR v_package_2 IS NULL OR v_package_3 IS NULL THEN
    RAISE EXCEPTION 'RDL-055R database contract requires at least three existing source packages';
  END IF;

  INSERT INTO rdl.enterprise_context(context_key,context_type,name,status)
  VALUES ('RDL055R-DB-TEST-COMPANY','company','RDL-055R DB test Company','draft')
  RETURNING context_id INTO v_context_id;

  INSERT INTO rdl.context_package_pin(context_id,layer_type,package_id,precedence,pin_reason)
  VALUES
    (v_context_id,'industry',v_package_1,1,'RDL-055R multi-RDL contract package 1'),
    (v_context_id,'industry',v_package_2,2,'RDL-055R multi-RDL contract package 2');

  IF (SELECT count(*) FROM rdl.context_package_pin WHERE context_id=v_context_id AND layer_type='industry') <> 2 THEN
    RAISE EXCEPTION 'multiple exact Industry pins were not retained';
  END IF;

  v_failed := false;
  BEGIN
    INSERT INTO rdl.context_package_pin(context_id,layer_type,package_id,precedence,pin_reason)
    VALUES (v_context_id,'industry',v_package_1,3,'duplicate package should fail');
  EXCEPTION WHEN unique_violation THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'duplicate context/layer/package pin was not rejected';
  END IF;

  UPDATE rdl.enterprise_context SET status='active' WHERE context_id=v_context_id;

  v_failed := false;
  BEGIN
    INSERT INTO rdl.context_package_pin(context_id,layer_type,package_id,precedence,pin_reason)
    VALUES (v_context_id,'industry',v_package_3,3,'active insert should fail');
  EXCEPTION WHEN OTHERS THEN
    IF position('package pins for active contexts are immutable' in SQLERRM)>0 THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'active-context package pin INSERT was not rejected'; END IF;

  v_failed := false;
  BEGIN
    UPDATE rdl.context_package_pin SET pin_reason='active update should fail'
    WHERE context_id=v_context_id AND package_id=v_package_1;
  EXCEPTION WHEN OTHERS THEN
    IF position('package pins for active contexts are immutable' in SQLERRM)>0 THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'active-context package pin UPDATE was not rejected'; END IF;

  v_failed := false;
  BEGIN
    DELETE FROM rdl.context_package_pin WHERE context_id=v_context_id AND package_id=v_package_1;
  EXCEPTION WHEN OTHERS THEN
    IF position('package pins for active contexts are immutable' in SQLERRM)>0 THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'active-context package pin DELETE was not rejected'; END IF;
END;
$$;

ROLLBACK;

SELECT 'PASS RDL-055R multi-RDL pin cardinality and active-context immutability database contract' AS result;
