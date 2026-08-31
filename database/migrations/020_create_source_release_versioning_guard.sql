-- RDL-030: source release upgrade and versioning validation.
-- Adds fail-closed fingerprint and identifier-continuity gates without
-- conflating release identity with mutable source files.

CREATE TABLE IF NOT EXISTS rdl.source_release_identity_validation (
  validation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL UNIQUE REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  predecessor_release_id bigint REFERENCES rdl.rdl_release(release_id) ON DELETE RESTRICT,
  audit_sha256 text,
  renamed_entity_count integer NOT NULL DEFAULT 0 CHECK (renamed_entity_count >= 0),
  type_conflict_count integer NOT NULL DEFAULT 0 CHECK (type_conflict_count >= 0),
  validated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (audit_sha256 IS NULL OR audit_sha256 ~ '^[0-9A-Fa-f]{64}$')
);

CREATE OR REPLACE FUNCTION rdl.assert_release_package_fingerprint(
  p_source_key text,
  p_release_key text,
  p_content_sha256 text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_sha text;
BEGIN
  SELECT p.content_sha256
    INTO v_existing_sha
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r ON r.release_id = p.release_id
  JOIN rdl.rdl_source s ON s.source_id = r.source_id
  WHERE s.source_key = p_source_key
    AND r.release_key = p_release_key
    AND p.package_kind = 'normalized'
  ORDER BY p.package_id DESC
  LIMIT 1;

  IF v_existing_sha IS NOT NULL AND v_existing_sha IS DISTINCT FROM p_content_sha256 THEN
    RAISE EXCEPTION 'RDL release %/% is immutable: existing fingerprint %, incoming fingerprint %. Use a new release key.',
      p_source_key, p_release_key, v_existing_sha, p_content_sha256
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION rdl.assert_source_release_identity(p_package_key text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_package_id bigint;
  v_source_id bigint;
  v_release_id bigint;
  v_from_release_key text;
  v_from_release_id bigint;
  v_audit_sha text;
  v_type_conflicts integer;
  v_renames integer;
BEGIN
  SELECT p.package_id, r.source_id, r.release_id,
         NULLIF(p.manifest->>'identityAuditFromReleaseKey',''),
         NULLIF(p.manifest->>'identityAuditSha256','')
    INTO v_package_id, v_source_id, v_release_id, v_from_release_key, v_audit_sha
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r ON r.release_id = p.release_id
  WHERE p.package_key = p_package_key;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'Unknown RDL package %', p_package_key USING ERRCODE = '23503';
  END IF;

  -- An exact package fingerprint that already passed this gate is immutable
  -- evidence. Replaying the same historical package must remain idempotent
  -- even after audited successor releases have been added.
  IF EXISTS (SELECT 1 FROM rdl.source_release_identity_validation WHERE package_id=v_package_id) THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
    INTO v_type_conflicts
  FROM rdl.rdl_entity incoming
  JOIN rdl.rdl_package prior_package ON prior_package.package_id <> incoming.package_id
  JOIN rdl.rdl_release prior_release ON prior_release.release_id = prior_package.release_id
  JOIN rdl.rdl_entity prior
    ON prior.package_id = prior_package.package_id
   AND prior.native_identifier = incoming.native_identifier
   AND prior.entity_type_code <> incoming.entity_type_code
  WHERE incoming.package_id = v_package_id
    AND prior_release.source_id = v_source_id
    AND prior_release.release_id <> v_release_id;

  IF v_type_conflicts > 0 THEN
    RAISE EXCEPTION 'RDL identifier reuse gate rejected package %: % identifier(s) change entity type across releases.',
      p_package_key, v_type_conflicts USING ERRCODE = '23514';
  END IF;

  v_renames := 0;
  IF v_from_release_key IS NULL THEN
    SELECT count(*)::integer
      INTO v_renames
    FROM rdl.rdl_entity incoming
    JOIN rdl.rdl_package prior_package ON prior_package.package_id <> incoming.package_id
    JOIN rdl.rdl_release prior_release ON prior_release.release_id = prior_package.release_id
    JOIN rdl.rdl_entity prior
      ON prior.package_id = prior_package.package_id
     AND prior.entity_type_code = incoming.entity_type_code
     AND prior.native_identifier = incoming.native_identifier
    WHERE incoming.package_id = v_package_id
      AND prior_release.source_id = v_source_id
      AND prior_release.release_id <> v_release_id
      AND prior.name IS DISTINCT FROM incoming.name;

    IF v_renames > 0 THEN
      RAISE EXCEPTION 'RDL identifier reuse gate rejected package %: % same-type identifier(s) changed canonical identity without a release identity audit.',
        p_package_key, v_renames USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT release_id INTO v_from_release_id
    FROM rdl.rdl_release
    WHERE source_id = v_source_id AND release_key = v_from_release_key;

    IF v_from_release_id IS NULL THEN
      RAISE EXCEPTION 'Identity audit predecessor release % does not exist for package %', v_from_release_key, p_package_key
        USING ERRCODE = '23503';
    END IF;

    IF v_audit_sha IS NULL OR v_audit_sha !~ '^[0-9A-Fa-f]{64}$' THEN
      RAISE EXCEPTION 'Package % declares predecessor % but has no valid identity audit fingerprint.', p_package_key, v_from_release_key
        USING ERRCODE = '23514';
    END IF;

    SELECT count(*)::integer
      INTO v_renames
    FROM rdl.rdl_entity incoming
    JOIN rdl.rdl_package prior_package ON prior_package.release_id = v_from_release_id
    JOIN rdl.rdl_entity prior
      ON prior.package_id = prior_package.package_id
     AND prior.entity_type_code = incoming.entity_type_code
     AND prior.native_identifier = incoming.native_identifier
    WHERE incoming.package_id = v_package_id
      AND prior.name IS DISTINCT FROM incoming.name;
  END IF;

  INSERT INTO rdl.source_release_identity_validation (
    package_id, predecessor_release_id, audit_sha256,
    renamed_entity_count, type_conflict_count, validated_at
  ) VALUES (
    v_package_id, v_from_release_id, v_audit_sha,
    v_renames, v_type_conflicts, now()
  )
  ON CONFLICT (package_id) DO UPDATE SET
    predecessor_release_id = EXCLUDED.predecessor_release_id,
    audit_sha256 = EXCLUDED.audit_sha256,
    renamed_entity_count = EXCLUDED.renamed_entity_count,
    type_conflict_count = EXCLUDED.type_conflict_count,
    validated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION rdl.compare_source_release_entities(
  p_source_key text,
  p_from_release_key text,
  p_to_release_key text
) RETURNS TABLE (
  change_kind text,
  entity_type_code text,
  native_identifier text,
  from_name text,
  to_name text
)
LANGUAGE sql
STABLE
AS $$
  WITH from_package AS (
    SELECT p.package_id
    FROM rdl.rdl_package p
    JOIN rdl.rdl_release r ON r.release_id = p.release_id
    JOIN rdl.rdl_source s ON s.source_id = r.source_id
    WHERE s.source_key = p_source_key AND r.release_key = p_from_release_key AND p.package_kind='normalized'
    ORDER BY p.package_id DESC LIMIT 1
  ), to_package AS (
    SELECT p.package_id
    FROM rdl.rdl_package p
    JOIN rdl.rdl_release r ON r.release_id = p.release_id
    JOIN rdl.rdl_source s ON s.source_id = r.source_id
    WHERE s.source_key = p_source_key AND r.release_key = p_to_release_key AND p.package_kind='normalized'
    ORDER BY p.package_id DESC LIMIT 1
  ), a AS (
    SELECT e.entity_type_code, e.native_identifier, e.name
    FROM rdl.rdl_entity e JOIN from_package p ON p.package_id=e.package_id
  ), b AS (
    SELECT e.entity_type_code, e.native_identifier, e.name
    FROM rdl.rdl_entity e JOIN to_package p ON p.package_id=e.package_id
  )
  SELECT CASE
           WHEN a.native_identifier IS NULL THEN 'added'
           WHEN b.native_identifier IS NULL THEN 'retired'
           WHEN a.name IS DISTINCT FROM b.name THEN 'modified'
           ELSE 'unchanged'
         END,
         COALESCE(a.entity_type_code,b.entity_type_code),
         COALESCE(a.native_identifier,b.native_identifier),
         a.name,
         b.name
  FROM a FULL OUTER JOIN b USING (entity_type_code,native_identifier)
  ORDER BY 2,3;
$$;

CREATE OR REPLACE FUNCTION rdl.compare_source_release_relationships(
  p_source_key text,
  p_from_release_key text,
  p_to_release_key text
) RETURNS TABLE (
  change_kind text,
  relationship_type_code text,
  source_entity_type_code text,
  source_native_identifier text,
  target_entity_type_code text,
  target_native_identifier text
)
LANGUAGE sql
STABLE
AS $$
  WITH from_package AS (
    SELECT p.package_id FROM rdl.rdl_package p
    JOIN rdl.rdl_release r ON r.release_id=p.release_id
    JOIN rdl.rdl_source s ON s.source_id=r.source_id
    WHERE s.source_key=p_source_key AND r.release_key=p_from_release_key AND p.package_kind='normalized'
    ORDER BY p.package_id DESC LIMIT 1
  ), to_package AS (
    SELECT p.package_id FROM rdl.rdl_package p
    JOIN rdl.rdl_release r ON r.release_id=p.release_id
    JOIN rdl.rdl_source s ON s.source_id=r.source_id
    WHERE s.source_key=p_source_key AND r.release_key=p_to_release_key AND p.package_kind='normalized'
    ORDER BY p.package_id DESC LIMIT 1
  ), a AS (
    SELECT rel.relationship_type_code,
           se.entity_type_code AS source_entity_type_code, se.native_identifier AS source_native_identifier,
           te.entity_type_code AS target_entity_type_code, te.native_identifier AS target_native_identifier
    FROM rdl.rdl_relationship rel
    JOIN from_package p ON p.package_id=rel.package_id
    JOIN rdl.rdl_entity se ON se.entity_id=rel.source_entity_id
    JOIN rdl.rdl_entity te ON te.entity_id=rel.target_entity_id
  ), b AS (
    SELECT rel.relationship_type_code,
           se.entity_type_code AS source_entity_type_code, se.native_identifier AS source_native_identifier,
           te.entity_type_code AS target_entity_type_code, te.native_identifier AS target_native_identifier
    FROM rdl.rdl_relationship rel
    JOIN to_package p ON p.package_id=rel.package_id
    JOIN rdl.rdl_entity se ON se.entity_id=rel.source_entity_id
    JOIN rdl.rdl_entity te ON te.entity_id=rel.target_entity_id
  )
  SELECT CASE WHEN a.relationship_type_code IS NULL THEN 'added'
              WHEN b.relationship_type_code IS NULL THEN 'retired'
              ELSE 'unchanged' END,
         COALESCE(a.relationship_type_code,b.relationship_type_code),
         COALESCE(a.source_entity_type_code,b.source_entity_type_code),
         COALESCE(a.source_native_identifier,b.source_native_identifier),
         COALESCE(a.target_entity_type_code,b.target_entity_type_code),
         COALESCE(a.target_native_identifier,b.target_native_identifier)
  FROM a FULL OUTER JOIN b USING (
    relationship_type_code,
    source_entity_type_code, source_native_identifier,
    target_entity_type_code, target_native_identifier
  )
  ORDER BY 2,3,4,5,6;
$$;
