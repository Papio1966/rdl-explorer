\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  source_id bigint;
  target_id bigint;
  test_mapping_id bigint;
  current_version integer;
  result_status text;
  result_version integer;
  history_count integer;
  blocked boolean := false;
BEGIN
  SELECT a.entity_id, b.entity_id INTO source_id, target_id
  FROM rdl.rdl_entity a
  JOIN rdl.rdl_package ap ON ap.package_id=a.package_id
  JOIN rdl.rdl_release ar ON ar.release_id=ap.release_id
  CROSS JOIN LATERAL (
    SELECT e.entity_id
    FROM rdl.rdl_entity e
    JOIN rdl.rdl_package p ON p.package_id=e.package_id
    JOIN rdl.rdl_release r ON r.release_id=p.release_id
    WHERE r.source_id<>ar.source_id
    ORDER BY e.entity_id
    LIMIT 1
  ) b
  ORDER BY a.entity_id
  LIMIT 1;

  IF source_id IS NULL OR target_id IS NULL THEN RAISE EXCEPTION 'RDL-011 test requires entities from at least two sources'; END IF;

  INSERT INTO rdl.cross_rdl_mapping(source_entity_id,target_entity_id,mapping_type,provenance_method,confidence,status,evidence)
  VALUES(source_id,target_id,'related','manual_curated',0.5000,'candidate','{"test":"rdl-011"}'::jsonb)
  ON CONFLICT (source_entity_id,target_entity_id,mapping_type,provenance_method)
  DO UPDATE SET evidence='{"test":"rdl-011"}'::jsonb
  RETURNING mapping_id,review_version INTO test_mapping_id,current_version;

  SELECT status,review_version INTO result_status,result_version
  FROM rdl.review_cross_rdl_mapping(test_mapping_id,'approve','rdl-011-test','Governance acceptance approval','{"test":true}'::jsonb,current_version,NULL);
  IF result_status<>'approved' OR result_version<>current_version+1 THEN RAISE EXCEPTION 'approve transition/version failed'; END IF;

  SELECT count(*) INTO history_count FROM rdl.cross_rdl_mapping_review_event WHERE mapping_id=test_mapping_id AND action='approve' AND reviewer='rdl-011-test';
  IF history_count<>1 THEN RAISE EXCEPTION 'append-only review event not recorded'; END IF;

  BEGIN
    PERFORM * FROM rdl.review_cross_rdl_mapping(test_mapping_id,'approve','rdl-011-test','Stale duplicate','{}'::jsonb,current_version,NULL);
  EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'optimistic versioning did not reject stale review write'; END IF;

  blocked := false;
  BEGIN
    UPDATE rdl.cross_rdl_mapping SET status='rejected' WHERE mapping_id=test_mapping_id;
  EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'direct review-state update was not blocked'; END IF;

  blocked := false;
  BEGIN
    UPDATE rdl.cross_rdl_mapping_review_event SET rationale='tampered' WHERE mapping_id=test_mapping_id;
  EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'append-only audit history was mutable'; END IF;

  RAISE NOTICE 'PASS governed review transition: candidate -> approved';
  RAISE NOTICE 'PASS append-only audit history and optimistic versioning';
END $$;

ROLLBACK;
