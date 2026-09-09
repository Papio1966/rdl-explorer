\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_existing_type text;
  v_existing_id text;
  v_complete rdl.external_standards_proposal_bundle%ROWTYPE;
  v_again rdl.external_standards_proposal_bundle%ROWTYPE;
  v_incomplete rdl.external_standards_proposal_bundle%ROWTYPE;
  v_review_version integer;
  v_error_seen boolean := false;
BEGIN
  SELECT entity_type_code, native_identifier INTO v_existing_type, v_existing_id
  FROM rdl.rdl_entity
  WHERE package_id = 5 AND entity_type_code = 'equipment_class'
  ORDER BY native_identifier LIMIT 1;
  IF v_existing_id IS NULL THEN RAISE EXCEPTION 'RDL-045 test requires one governed equipment_class'; END IF;

  SELECT * INTO v_complete
  FROM rdl.submit_external_standards_proposal_bundle(
    'datagate-reference', 'rdl045-complete-vacuum-toilet', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'datagate:project-alpha', 'DATAGATE', 'project', 'project', 'DEMO-PROJECT-ALPHA', 5,
    jsonb_build_object(
      'bundleKey', 'datagate-pse:vacuum-toilet',
      'sourcePseId', 'PSE-VACUUM-TOILET',
      'sourcePseContentHash', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'rootEntityTypeCode', 'equipment_class',
      'rootNativeIdentifier', 'DG-PSE-VACUUM-TOILET',
      'components', jsonb_build_array(
        jsonb_build_object('componentKey','class:vacuum-toilet','componentKind','object_delta','action','add','entityTypeCode','equipment_class','nativeIdentifier','DG-PSE-VACUUM-TOILET','payload',jsonb_build_object('name','Vacuum toilet','definition','Project-originated maintainable equipment class.')),
        jsonb_build_object('componentKey','rel:parent','componentKind','relationship_delta','action','relationship_delta','entityTypeCode','relationship','nativeIdentifier','DG-PSE-VACUUM-TOILET-PARENT','payload',jsonb_build_object('relationshipType','entity_parent'))
      ),
      'dependencies', jsonb_build_array(
        jsonb_build_object('dependencyKey','dep:parent-class','sourceComponentKey','class:vacuum-toilet','dependencyType','parent_class','required',true,'targetEntityTypeCode',v_existing_type,'targetNativeIdentifier',v_existing_id),
        jsonb_build_object('dependencyKey','dep:parent-relationship','sourceComponentKey','class:vacuum-toilet','dependencyType','relationship_delta','required',true,'targetComponentKey','rel:parent')
      )
    ),
    jsonb_build_object('evidenceType','project_execution_gap','source','RDL-045 deterministic test'),
    'Complete bundle submitted for deterministic RDL-045 validation.', NULL, NULL
  );
  IF v_complete.completeness_status <> 'complete' OR v_complete.missing_dependency_count <> 0 THEN RAISE EXCEPTION 'complete bundle did not validate as complete'; END IF;

  SELECT * INTO v_again FROM rdl.submit_external_standards_proposal_bundle(
    'datagate-reference', 'rdl045-complete-vacuum-toilet', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'datagate:project-alpha', 'DATAGATE', 'project', 'project', 'DEMO-PROJECT-ALPHA', 5,
    v_complete.bundle_payload, v_complete.source_evidence,
    'Complete bundle submitted for deterministic RDL-045 validation.', NULL, NULL
  );
  IF v_again.proposal_bundle_id <> v_complete.proposal_bundle_id THEN RAISE EXCEPTION 'bundle idempotency did not return existing bundle'; END IF;

  BEGIN
    PERFORM rdl.submit_external_standards_proposal_bundle(
      'datagate-reference', 'rdl045-complete-vacuum-toilet', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'datagate:project-alpha', 'DATAGATE', 'project', 'project', 'DEMO-PROJECT-ALPHA', 5,
      v_complete.bundle_payload, v_complete.source_evidence, 'Changed hash should fail idempotency.', NULL, NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_error_seen := true;
  END;
  IF NOT v_error_seen THEN RAISE EXCEPTION 'idempotency conflict was not rejected'; END IF;

  SELECT * INTO v_incomplete
  FROM rdl.submit_external_standards_proposal_bundle(
    'datagate-reference', 'rdl045-incomplete-vacuum-toilet', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'datagate:project-alpha', 'DATAGATE', 'project', 'project', 'DEMO-PROJECT-ALPHA', 5,
    jsonb_build_object(
      'bundleKey', 'datagate-pse:incomplete-vacuum-toilet',
      'rootEntityTypeCode', 'equipment_class',
      'rootNativeIdentifier', 'DG-PSE-INCOMPLETE-VACUUM-TOILET',
      'components', jsonb_build_array(jsonb_build_object('componentKey','class:incomplete-vacuum-toilet','componentKind','object_delta','action','add','entityTypeCode','equipment_class','nativeIdentifier','DG-PSE-INCOMPLETE-VACUUM-TOILET','payload',jsonb_build_object('name','Incomplete vacuum toilet'))),
      'dependencies', jsonb_build_array(jsonb_build_object('dependencyKey','dep:missing-parent','sourceComponentKey','class:incomplete-vacuum-toilet','dependencyType','parent_class','required',true,'targetEntityTypeCode','equipment_class','targetNativeIdentifier','DG-DOES-NOT-EXIST'))
    ),
    jsonb_build_object('evidenceType','incomplete_candidate'),
    'Incomplete bundle must remain governed but not acceptable.', NULL, NULL
  );
  IF v_incomplete.completeness_status <> 'incomplete_candidate' OR v_incomplete.missing_dependency_count <> 1 THEN RAISE EXCEPTION 'incomplete bundle did not remain incomplete'; END IF;

  v_error_seen := false;
  BEGIN
    SELECT review_version INTO v_review_version FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_incomplete.proposal_bundle_id;
    PERFORM rdl.review_external_standards_proposal_bundle(v_incomplete.proposal_bundle_id, 'accept', 'rdl:reviewer', 'Attempting to accept an incomplete bundle must fail.', v_review_version, '{}'::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_error_seen := true;
  END;
  IF NOT v_error_seen THEN RAISE EXCEPTION 'incomplete bundle acceptance was not rejected'; END IF;

  SELECT review_version INTO v_review_version FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_complete.proposal_bundle_id;
  PERFORM rdl.review_external_standards_proposal_bundle(v_complete.proposal_bundle_id, 'start_review', 'rdl:reviewer', 'Complete bundle is ready for governed review.', v_review_version, '{}'::jsonb, '{}'::jsonb);
  SELECT review_version INTO v_review_version FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_complete.proposal_bundle_id;
  PERFORM rdl.review_external_standards_proposal_bundle(v_complete.proposal_bundle_id, 'accept', 'rdl:reviewer', 'Complete bundle may be accepted as a governed candidate.', v_review_version, '{}'::jsonb, '{}'::jsonb);

  IF (SELECT count(*) FROM rdl.external_standards_proposal_bundle_event WHERE proposal_bundle_id = v_complete.proposal_bundle_id) < 4 THEN RAISE EXCEPTION 'bundle audit events were not recorded'; END IF;
END $$;

SELECT 'PASS RDL-045 external proposal bundle contract' AS result;
ROLLBACK;
