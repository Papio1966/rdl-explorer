BEGIN;

DO $$
DECLARE
  v_parent_package_id bigint;
  v_complete rdl.external_standards_proposal_bundle%ROWTYPE;
  v_incomplete rdl.external_standards_proposal_bundle%ROWTYPE;
  v_review_version integer;
  v_error_seen boolean := false;
  v_complete_payload jsonb;
  v_incomplete_payload jsonb;
BEGIN
  SELECT package_id INTO v_parent_package_id
  FROM rdl.rdl_package
  WHERE package_key LIKE 'cfihos-2.0%'
  ORDER BY package_id DESC
  LIMIT 1;
  IF v_parent_package_id IS NULL THEN RAISE EXCEPTION 'parent package was not found'; END IF;

  v_complete_payload := jsonb_build_object(
    'bundleKey', 'rdl046:complete-review-readback',
    'rootEntityTypeCode', 'equipment_class',
    'rootNativeIdentifier', 'RDL046-COMPLETE-REVIEW',
    'components', jsonb_build_array(
      jsonb_build_object('componentKey','class:rdl046-complete','componentKind','object_delta','action','add','entityTypeCode','equipment_class','nativeIdentifier','RDL046-COMPLETE-REVIEW','payload',jsonb_build_object('name','RDL-046 Complete Review Class')),
      jsonb_build_object('componentKey','property:rdl046-complete','componentKind','object_delta','action','add','entityTypeCode','property','nativeIdentifier','RDL046-PROPERTY','payload',jsonb_build_object('name','RDL-046 Review Property'))
    ),
    'dependencies', jsonb_build_array(
      jsonb_build_object('dependencyKey','dep:class-property','sourceComponentKey','class:rdl046-complete','dependencyType','class_property','required',true,'targetComponentKey','property:rdl046-complete')
    )
  );

  v_incomplete_payload := jsonb_build_object(
    'bundleKey', 'rdl046:incomplete-review-readback',
    'rootEntityTypeCode', 'equipment_class',
    'rootNativeIdentifier', 'RDL046-INCOMPLETE-REVIEW',
    'components', jsonb_build_array(
      jsonb_build_object('componentKey','class:rdl046-incomplete','componentKind','object_delta','action','add','entityTypeCode','equipment_class','nativeIdentifier','RDL046-INCOMPLETE-REVIEW','payload',jsonb_build_object('name','RDL-046 Incomplete Review Class'))
    ),
    'dependencies', jsonb_build_array(
      jsonb_build_object('dependencyKey','dep:missing-property','sourceComponentKey','class:rdl046-incomplete','dependencyType','class_property','required',true,'targetEntityTypeCode','property','targetNativeIdentifier','RDL046-MISSING-PROPERTY')
    )
  );

  SELECT * INTO v_complete FROM rdl.submit_external_standards_proposal_bundle(
    'datagate', 'rdl046-complete-review-readback', repeat('6',64), 'datagate:svc', 'DATAGATE',
    'project', 'project', 'project:rdl046', v_parent_package_id,
    v_complete_payload, jsonb_build_object('source','RDL-046 readback test'), 'Complete bundle readback test.', NULL, NULL
  );

  SELECT * INTO v_incomplete FROM rdl.submit_external_standards_proposal_bundle(
    'datagate', 'rdl046-incomplete-review-readback', repeat('7',64), 'datagate:svc', 'DATAGATE',
    'project', 'project', 'project:rdl046', v_parent_package_id,
    v_incomplete_payload, jsonb_build_object('source','RDL-046 readback test'), 'Incomplete bundle readback test.', NULL, NULL
  );

  IF NOT EXISTS (SELECT 1 FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_complete.proposal_bundle_id AND completeness_status = 'complete' AND missing_dependency_count = 0) THEN
    RAISE EXCEPTION 'complete bundle was not readable from queue';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_incomplete.proposal_bundle_id AND completeness_status = 'incomplete_candidate' AND missing_dependency_count = 1) THEN
    RAISE EXCEPTION 'incomplete bundle was not readable as fail-closed candidate';
  END IF;
  IF (SELECT count(*) FROM rdl.external_standards_proposal_bundle_component WHERE proposal_bundle_id = v_complete.proposal_bundle_id) <> 2 THEN
    RAISE EXCEPTION 'complete bundle components were not readable';
  END IF;
  IF (SELECT count(*) FROM rdl.external_standards_proposal_bundle_dependency WHERE proposal_bundle_id = v_complete.proposal_bundle_id AND satisfied_by = 'bundle_component') <> 1 THEN
    RAISE EXCEPTION 'complete bundle dependency closure was not readable';
  END IF;
  IF (SELECT count(*) FROM rdl.external_standards_proposal_bundle_event WHERE proposal_bundle_id = v_complete.proposal_bundle_id) < 2 THEN
    RAISE EXCEPTION 'submit/validate bundle events were not readable';
  END IF;

  SELECT review_version INTO v_review_version FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_incomplete.proposal_bundle_id;
  BEGIN
    PERFORM rdl.review_external_standards_proposal_bundle(v_incomplete.proposal_bundle_id, 'accept', 'rdl:reviewer', 'Incomplete bundles must fail closed.', v_review_version, '{}'::jsonb, '{}'::jsonb);
  EXCEPTION WHEN others THEN
    v_error_seen := true;
  END;
  IF NOT v_error_seen THEN RAISE EXCEPTION 'incomplete bundle acceptance did not fail closed'; END IF;

  SELECT review_version INTO v_review_version FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_complete.proposal_bundle_id;
  PERFORM rdl.review_external_standards_proposal_bundle(v_complete.proposal_bundle_id, 'start_review', 'rdl:reviewer', 'Start governed RDL-046 review.', v_review_version, '{}'::jsonb, '{}'::jsonb);
  SELECT review_version INTO v_review_version FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_complete.proposal_bundle_id;
  PERFORM rdl.review_external_standards_proposal_bundle(v_complete.proposal_bundle_id, 'accept', 'rdl:reviewer', 'Accept complete bundle as candidate only; publication remains separate.', v_review_version, '{}'::jsonb, '{}'::jsonb);

  IF NOT EXISTS (SELECT 1 FROM rdl.external_standards_proposal_bundle_queue WHERE proposal_bundle_id = v_complete.proposal_bundle_id AND proposal_status = 'accepted') THEN
    RAISE EXCEPTION 'accepted bundle status was not readable';
  END IF;
END $$;

ROLLBACK;

SELECT 'PASS RDL-046 proposal bundle review/readback database contract' AS result;
