\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_parent bigint;
  v_first rdl.external_standards_proposal%ROWTYPE;
  v_second rdl.external_standards_proposal%ROWTYPE;
  v_reviewed rdl.external_standards_proposal%ROWTYPE;
  v_conflict_blocked boolean := false;
  v_event_mutation_blocked boolean := false;
BEGIN
  SELECT package_id INTO v_parent
  FROM rdl.rdl_package
  WHERE package_key LIKE 'cfihos-2.0-%'
  ORDER BY package_id DESC
  LIMIT 1;

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'RDL-044 fixture requires validated CFIHOS package';
  END IF;

  SELECT * INTO v_first
  FROM rdl.submit_external_standards_proposal(
    'datagate-test',
    'REQ-001',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'datagate:test-proposer',
    'datagate',
    'project',
    'asset',
    'asset:demo-north-sea',
    v_parent,
    'add',
    'equipment_class',
    'DG-DEMO-VACUUM-TOILET',
    '{"entity":{"name":"Vacuum toilet"},"relationships":[]}'::jsonb,
    '{"source":"DataGate project candidate","submissionId":"sub-001"}'::jsonb,
    'Project delivery identified a maintainable equipment class candidate.',
    'asset',
    'asset:demo-north-sea'
  );

  SELECT * INTO v_second
  FROM rdl.submit_external_standards_proposal(
    'datagate-test',
    'REQ-001',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'datagate:test-proposer',
    'datagate',
    'project',
    'asset',
    'asset:demo-north-sea',
    v_parent,
    'add',
    'equipment_class',
    'DG-DEMO-VACUUM-TOILET',
    '{"entity":{"name":"Vacuum toilet"},"relationships":[]}'::jsonb,
    '{"source":"DataGate project candidate","submissionId":"sub-001"}'::jsonb,
    'Project delivery identified a maintainable equipment class candidate.',
    'asset',
    'asset:demo-north-sea'
  );

  IF v_first.external_proposal_id <> v_second.external_proposal_id THEN
    RAISE EXCEPTION 'idempotent proposal submission returned a different row';
  END IF;

  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'datagate-test','REQ-001','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'datagate:test-proposer','datagate','project','asset','asset:demo-north-sea',v_parent,
      'add','equipment_class','DG-DEMO-VACUUM-TOILET','{}'::jsonb,'{}'::jsonb,
      'Changed payload should fail idempotency.',NULL,NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_conflict_blocked := true;
  END;

  IF NOT v_conflict_blocked THEN
    RAISE EXCEPTION 'idempotency conflict was not rejected';
  END IF;

  SELECT * INTO v_reviewed
  FROM rdl.review_external_standards_proposal(
    v_first.external_proposal_id,
    'start_review',
    'standards.reviewer@example.test',
    'Proposal is ready for governed standards review.',
    v_first.review_version,
    '{"review":"accepted into review queue"}'::jsonb,
    '{}'::jsonb
  );

  IF v_reviewed.proposal_status <> 'in_review' OR v_reviewed.review_version <> 1 THEN
    RAISE EXCEPTION 'start_review transition did not update status/version';
  END IF;

  SELECT * INTO v_reviewed
  FROM rdl.review_external_standards_proposal(
    v_first.external_proposal_id,
    'reject',
    'standards.reviewer@example.test',
    'Rejecting this fixture proposal after audit validation.',
    v_reviewed.review_version,
    '{"reason":"fixture complete"}'::jsonb,
    '{}'::jsonb
  );

  IF v_reviewed.proposal_status <> 'rejected' OR v_reviewed.review_version <> 2 THEN
    RAISE EXCEPTION 'reject transition did not update status/version';
  END IF;

  BEGIN
    UPDATE rdl.external_standards_proposal_event SET rationale = rationale WHERE external_proposal_id = v_first.external_proposal_id;
  EXCEPTION WHEN OTHERS THEN
    v_event_mutation_blocked := true;
  END;

  IF NOT v_event_mutation_blocked THEN
    RAISE EXCEPTION 'append-only external proposal event mutation was not rejected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rdl.context_extension_change
    WHERE provenance->>'externalProposalId' = v_first.external_proposal_id::text
  ) THEN
    RAISE EXCEPTION 'external proposal intake must not silently create context extension changes';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS RDL-044 external standards proposal database contract' AS result;
