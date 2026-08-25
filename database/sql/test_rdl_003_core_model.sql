\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  source_a bigint;
  source_b bigint;
  release_a bigint;
  release_b bigint;
  package_a bigint;
  package_b bigint;
  tag_a bigint;
  equipment_a bigint;
  property_a bigint;
  same_native_other_source bigint;
BEGIN
  INSERT INTO rdl.rdl_source (source_key, name)
  VALUES ('RDL003_TEST_A', 'RDL-003 Test Source A')
  RETURNING source_id INTO source_a;

  INSERT INTO rdl.rdl_source (source_key, name)
  VALUES ('RDL003_TEST_B', 'RDL-003 Test Source B')
  RETURNING source_id INTO source_b;

  INSERT INTO rdl.rdl_release (source_id, release_key, version_label, release_status)
  VALUES (source_a, '1.0', '1.0', 'published')
  RETURNING release_id INTO release_a;

  INSERT INTO rdl.rdl_release (source_id, release_key, version_label, release_status)
  VALUES (source_b, '1.0', '1.0', 'published')
  RETURNING release_id INTO release_b;

  INSERT INTO rdl.rdl_package (release_id, package_key, package_kind, package_status)
  VALUES (release_a, 'RDL003_TEST_A_1_0', 'normalized', 'validated')
  RETURNING package_id INTO package_a;

  INSERT INTO rdl.rdl_package (release_id, package_key, package_kind, package_status)
  VALUES (release_b, 'RDL003_TEST_B_1_0', 'normalized', 'validated')
  RETURNING package_id INTO package_b;

  -- Same native identifier can coexist across entity domains in one package.
  INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name)
  VALUES (package_a, 'tag_class', 'NATIVE-001', 'Test Tag Class')
  RETURNING entity_id INTO tag_a;

  INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name)
  VALUES (package_a, 'equipment_class', 'NATIVE-001', 'Test Equipment Class')
  RETURNING entity_id INTO equipment_a;

  INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name)
  VALUES (package_a, 'property', 'PROP-001', 'Test Property')
  RETURNING entity_id INTO property_a;

  -- Same native identifier can also coexist in another RDL source/package.
  INSERT INTO rdl.rdl_entity (package_id, entity_type_code, native_identifier, name)
  VALUES (package_b, 'tag_class', 'NATIVE-001', 'Other Source Tag Class')
  RETURNING entity_id INTO same_native_other_source;

  INSERT INTO rdl.rdl_relationship (
    package_id, relationship_type_code, source_entity_id, target_entity_id, attributes
  ) VALUES (
    package_a, 'class_property', tag_a, property_a, '{"assignment":"direct"}'::jsonb
  );

  INSERT INTO ingestion.ingestion_run (
    package_id, adapter_key, adapter_version, status, validation_summary
  ) VALUES (
    package_a, 'rdl003-test-adapter', '1', 'completed', '{"valid":true}'::jsonb
  );

  IF (SELECT count(*) FROM rdl.entity_identity WHERE package_key = 'RDL003_TEST_A_1_0') <> 3 THEN
    RAISE EXCEPTION 'RDL-003 identity view did not expose expected entities';
  END IF;

  IF (SELECT count(DISTINCT logical_identity) FROM rdl.entity_identity WHERE native_identifier = 'NATIVE-001') <> 3 THEN
    RAISE EXCEPTION 'RDL-003 logical identity does not distinguish source/entity domain';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rdl.rdl_relationship
    WHERE package_id = package_a
      AND relationship_type_code = 'class_property'
      AND source_entity_id = tag_a
      AND target_entity_id = property_a
  ) THEN
    RAISE EXCEPTION 'RDL-003 relationship was not persisted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM ingestion.ingestion_run
    WHERE package_id = package_a
      AND adapter_key = 'rdl003-test-adapter'
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'RDL-003 ingestion provenance was not persisted';
  END IF;
END $$;

ROLLBACK;
\echo 'PASS RDL-003 core domain model'
