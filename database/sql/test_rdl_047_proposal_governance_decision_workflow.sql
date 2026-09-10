BEGIN;
DO $$
DECLARE
  review_function text;
  bundle_table_count integer;
  bundle_event_table_count integer;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO review_function
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'rdl'
     AND p.proname = 'review_external_standards_proposal_bundle'
   ORDER BY p.oid DESC
   LIMIT 1;

  IF review_function IS NULL THEN
    RAISE EXCEPTION 'review_external_standards_proposal_bundle function is missing';
  END IF;
  IF review_function NOT ILIKE '%expected%' OR review_function NOT ILIKE '%version%' THEN
    RAISE EXCEPTION 'review_external_standards_proposal_bundle does not expose optimistic expectedVersion protection';
  END IF;
  IF review_function NOT ILIKE '%rationale%' THEN
    RAISE EXCEPTION 'review_external_standards_proposal_bundle does not preserve rationale';
  END IF;
  IF review_function NOT ILIKE '%actor%' THEN
    RAISE EXCEPTION 'review_external_standards_proposal_bundle does not preserve actor identity';
  END IF;
  -- The canonical RDL-045/RDL-046 database function is deliberately generic.
  -- RDL-047 enforces the separate link_publication decision at the policy/service/API/static-contract boundary,
  -- while the existing review function preserves review event/action payloads without needing a literal link_publication branch.

  SELECT count(*)::integer
    INTO bundle_table_count
    FROM information_schema.tables
   WHERE table_schema = 'rdl'
     AND table_name LIKE '%proposal%bundle%';
  IF bundle_table_count < 4 THEN
    RAISE EXCEPTION 'Expected proposal bundle core tables are missing: %', bundle_table_count;
  END IF;

  SELECT count(*)::integer
    INTO bundle_event_table_count
    FROM information_schema.tables
   WHERE table_schema = 'rdl'
     AND table_name LIKE '%proposal%bundle%event%';
  IF bundle_event_table_count < 1 THEN
    RAISE EXCEPTION 'Proposal bundle decision event/audit table is missing';
  END IF;
END $$;
ROLLBACK;
SELECT 'PASS RDL-047 proposal governance decision workflow database contract' AS result;
