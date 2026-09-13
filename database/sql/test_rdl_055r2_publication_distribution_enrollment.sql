\set ON_ERROR_STOP on

DO $$
DECLARE
  v_release_id bigint;
  v_distribution_id_1 bigint;
  v_distribution_id_2 bigint;
  v_count integer;
  v_status text;
  v_contract text;
  v_min_consumer text;
BEGIN
  SELECT r.effective_standard_release_id
    INTO v_release_id
    FROM rdl.effective_standard_release r
   WHERE r.release_key='rdl055-qualification-project-release'
     AND r.release_version='1.0.0'
   ORDER BY r.effective_standard_release_id DESC
   LIMIT 1;

  IF v_release_id IS NULL THEN
    RAISE EXCEPTION 'RDL-055 qualification release is missing';
  END IF;

  SELECT count(*), min(d.lifecycle_status), min(d.compatibility->>'contract'), min(d.compatibility->>'minimumConsumerVersion')
    INTO v_count, v_status, v_contract, v_min_consumer
    FROM rdl.effective_standard_distribution d
   WHERE d.effective_standard_release_id=v_release_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'qualification release distribution enrollment expected 1 row, got %', v_count;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'qualification release distribution must default active, got %', v_status;
  END IF;
  IF v_contract <> 'rdl-distribution/v1' OR v_min_consumer <> '1.0' THEN
    RAISE EXCEPTION 'qualification distribution compatibility default changed: contract=% minimumConsumerVersion=%', v_contract, v_min_consumer;
  END IF;

  v_distribution_id_1 := rdl.ensure_effective_standard_distribution(v_release_id);
  v_distribution_id_2 := rdl.ensure_effective_standard_distribution(v_release_id);
  IF v_distribution_id_1 IS DISTINCT FROM v_distribution_id_2 THEN
    RAISE EXCEPTION 'idempotent enrollment returned different distribution identities: % vs %', v_distribution_id_1, v_distribution_id_2;
  END IF;

  SELECT count(*) INTO v_count
    FROM rdl.effective_standard_distribution d
   WHERE d.effective_standard_release_id=v_release_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'idempotent enrollment duplicated the distribution row';
  END IF;

  BEGIN
    PERFORM rdl.ensure_effective_standard_distribution(-9223372036854775807::bigint);
    RAISE EXCEPTION 'unknown release enrollment did not fail closed';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'unknown release enrollment did not fail closed' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Prove ensure() never rewrites an existing lifecycle state. The transaction is
-- rolled back so the persistent qualification release remains active.
BEGIN;
UPDATE rdl.effective_standard_distribution d
   SET lifecycle_status='deprecated',
       deprecation_message='RDL-055R2 transactional preservation probe',
       updated_at=now()
 WHERE d.effective_standard_release_id=(
   SELECT r.effective_standard_release_id
     FROM rdl.effective_standard_release r
    WHERE r.release_key='rdl055-qualification-project-release'
      AND r.release_version='1.0.0'
    ORDER BY r.effective_standard_release_id DESC
    LIMIT 1
 );

SELECT rdl.ensure_effective_standard_distribution((
  SELECT r.effective_standard_release_id
    FROM rdl.effective_standard_release r
   WHERE r.release_key='rdl055-qualification-project-release'
     AND r.release_version='1.0.0'
   ORDER BY r.effective_standard_release_id DESC
   LIMIT 1
));

DO $$
DECLARE v_status text; v_message text;
BEGIN
  SELECT d.lifecycle_status,d.deprecation_message
    INTO v_status,v_message
    FROM rdl.effective_standard_distribution d
    JOIN rdl.effective_standard_release r USING(effective_standard_release_id)
   WHERE r.release_key='rdl055-qualification-project-release'
     AND r.release_version='1.0.0';
  IF v_status <> 'deprecated' OR v_message <> 'RDL-055R2 transactional preservation probe' THEN
    RAISE EXCEPTION 'idempotent enrollment rewrote existing lifecycle state: status=% message=%', v_status, v_message;
  END IF;
END
$$;
ROLLBACK;

DO $$
DECLARE
  v_trigger_count integer;
  v_trigger_def text;
BEGIN
  SELECT count(*), min(pg_get_triggerdef(t.oid))
    INTO v_trigger_count,v_trigger_def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='rdl'
     AND c.relname='effective_standard_release'
     AND t.tgname='trg_enroll_effective_standard_distribution'
     AND NOT t.tgisinternal;
  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'publication enrollment trigger expected exactly once, got %', v_trigger_count;
  END IF;
  IF v_trigger_def NOT LIKE '%AFTER INSERT ON rdl.effective_standard_release%' THEN
    RAISE EXCEPTION 'publication enrollment trigger is not AFTER INSERT: %', v_trigger_def;
  END IF;
END
$$;

SELECT 'PASS RDL-055R2 publication distribution enrollment database contract' AS result;
