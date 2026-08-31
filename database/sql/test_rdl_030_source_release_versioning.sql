\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE v integer; v_text text;
BEGIN
  SELECT count(*) INTO v FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id
  WHERE (s.source_key='ccus' AND r.release_key IN ('ccus-0.1-draft','ccus-2.0-candidate'))
     OR (s.source_key='water-desalination' AND r.release_key IN ('water-desalination-0.1-draft','water-desalination-2.0-candidate'));
  IF v <> 4 THEN RAISE EXCEPTION 'Expected four historical/current domain releases, got %', v; END IF;

  SELECT count(*) INTO v FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id
  WHERE ((s.source_key='ccus' AND r.release_key='ccus-0.1-draft') OR (s.source_key='water-desalination' AND r.release_key='water-desalination-0.1-draft')) AND r.release_status='superseded';
  IF v <> 2 THEN RAISE EXCEPTION 'Historical domain releases were not retained as superseded'; END IF;

  SELECT count(*) INTO v FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id
  WHERE ((s.source_key='ccus' AND r.release_key='ccus-2.0-candidate') OR (s.source_key='water-desalination' AND r.release_key='water-desalination-2.0-candidate')) AND r.release_status='candidate';
  IF v <> 2 THEN RAISE EXCEPTION 'v2 releases must remain candidate'; END IF;

  SELECT p.content_sha256 INTO v_text FROM rdl.rdl_package p JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key='ccus' AND r.release_key='ccus-0.1-draft' ORDER BY p.package_id DESC LIMIT 1;
  IF v_text <> '821618649c9fb7f7ef40ad5a9963432231ca82a5e46f5a563a1d0adae54ad82e' THEN RAISE EXCEPTION 'Historical CCUS fingerprint changed: %', v_text; END IF;
  SELECT p.content_sha256 INTO v_text FROM rdl.rdl_package p JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key='water-desalination' AND r.release_key='water-desalination-0.1-draft' ORDER BY p.package_id DESC LIMIT 1;
  IF v_text <> '6cd178d58f92b003974128cb48a0c332eca950ae0a7b2f78ec2f2f106ac5c22a' THEN RAISE EXCEPTION 'Historical Water fingerprint changed: %', v_text; END IF;

  SELECT count(*) INTO v FROM rdl.source_release_identity_validation iv JOIN rdl.rdl_package p ON p.package_id=iv.package_id JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id
  WHERE r.release_key IN ('ccus-2.0-candidate','water-desalination-2.0-candidate') AND iv.audit_sha256='35c1cb97008075f8075f27ab3cc46bc438f5d35aa19775538ae0d08a29419bd1' AND iv.type_conflict_count=0;
  IF v <> 2 THEN RAISE EXCEPTION 'Both v2 releases must carry successful identity-audit evidence'; END IF;

  SELECT count(*) INTO v FROM rdl.compare_source_release_entities('ccus','ccus-0.1-draft','ccus-2.0-candidate') WHERE change_kind='added' AND entity_type_code='equipment_class';
  IF v <> 16 THEN RAISE EXCEPTION 'CCUS equipment delta expected 16 added, got %', v; END IF;
  SELECT count(*) INTO v FROM rdl.compare_source_release_entities('ccus','ccus-0.1-draft','ccus-2.0-candidate') WHERE change_kind='added' AND entity_type_code='property';
  IF v <> 41 THEN RAISE EXCEPTION 'CCUS property delta expected 41 added, got %', v; END IF;
  SELECT count(*) INTO v FROM rdl.compare_source_release_entities('water-desalination','water-desalination-0.1-draft','water-desalination-2.0-candidate') WHERE change_kind='added' AND entity_type_code='tag_class';
  IF v <> 1 THEN RAISE EXCEPTION 'Water tag delta expected 1 added, got %', v; END IF;
  SELECT count(*) INTO v FROM rdl.compare_source_release_entities('water-desalination','water-desalination-0.1-draft','water-desalination-2.0-candidate') WHERE change_kind='added' AND entity_type_code='property';
  IF v <> 14 THEN RAISE EXCEPTION 'Water property delta expected 14 added, got %', v; END IF;

  SELECT count(*) INTO v FROM rdl.compare_source_release_relationships('ccus','ccus-0.1-draft','ccus-2.0-candidate') WHERE change_kind='added' AND relationship_type_code='class_property';
  IF v <> 303 THEN RAISE EXCEPTION 'CCUS class-property delta expected 303 added, got %', v; END IF;
  SELECT count(*) INTO v FROM rdl.compare_source_release_relationships('water-desalination','water-desalination-0.1-draft','water-desalination-2.0-candidate') WHERE change_kind='added' AND relationship_type_code='class_property';
  IF v <> 83 THEN RAISE EXCEPTION 'Water class-property delta expected 83 added, got %', v; END IF;

  BEGIN
    PERFORM rdl.assert_release_package_fingerprint('ccus','ccus-0.1-draft',repeat('0',64));
    RAISE EXCEPTION 'Fingerprint replacement negative test unexpectedly passed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Same-type identifier reassignment without audited continuity must fail.
INSERT INTO rdl.rdl_source(source_key,name,status) VALUES('rdl030-negative','RDL-030 negative fixture','active');
INSERT INTO rdl.rdl_release(source_id,release_key,version_label,release_status) SELECT source_id,'old','old','candidate' FROM rdl.rdl_source WHERE source_key='rdl030-negative';
INSERT INTO rdl.rdl_release(source_id,release_key,version_label,release_status) SELECT source_id,'new','new','candidate' FROM rdl.rdl_source WHERE source_key='rdl030-negative';
INSERT INTO rdl.rdl_package(release_id,package_key,package_kind,package_status,content_sha256) SELECT release_id,'rdl030-neg-old','normalized','validated',repeat('1',64) FROM rdl.rdl_release WHERE release_key='old' AND source_id=(SELECT source_id FROM rdl.rdl_source WHERE source_key='rdl030-negative');
INSERT INTO rdl.rdl_package(release_id,package_key,package_kind,package_status,content_sha256) SELECT release_id,'rdl030-neg-new','normalized','validated',repeat('2',64) FROM rdl.rdl_release WHERE release_key='new' AND source_id=(SELECT source_id FROM rdl.rdl_source WHERE source_key='rdl030-negative');
INSERT INTO rdl.rdl_entity(package_id,entity_type_code,native_identifier,name) VALUES((SELECT package_id FROM rdl.rdl_package WHERE package_key='rdl030-neg-old'),'source_standard','NEG-1','Standard A');
INSERT INTO rdl.rdl_entity(package_id,entity_type_code,native_identifier,name) VALUES((SELECT package_id FROM rdl.rdl_package WHERE package_key='rdl030-neg-new'),'source_standard','NEG-1','Completely Different Standard');
DO $$ BEGIN
  BEGIN
    PERFORM rdl.assert_source_release_identity('rdl030-neg-new');
    RAISE EXCEPTION 'Identifier-reuse negative fixture unexpectedly passed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- No relationship can leak across package boundaries because the core composite FKs remain in force.
DO $$ DECLARE v integer; BEGIN
  SELECT count(*) INTO v FROM rdl.rdl_relationship rel JOIN rdl.rdl_entity s ON s.entity_id=rel.source_entity_id JOIN rdl.rdl_entity t ON t.entity_id=rel.target_entity_id WHERE rel.package_id<>s.package_id OR rel.package_id<>t.package_id;
  IF v <> 0 THEN RAISE EXCEPTION 'Cross-package relationship leakage detected'; END IF;
END $$;

ROLLBACK;
\echo 'PASS RDL-030 real Water/CCUS source release versioning, immutable fingerprints, identity gate and release comparison'
