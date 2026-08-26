\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_run text := 'rdl-026-test-run';
  v_case bigint;
  v_result bigint;
  v_failed boolean := false;
BEGIN
  IF to_regclass('rdl.ai_feedback') IS NULL OR to_regclass('rdl.ai_evaluation_result') IS NULL THEN
    RAISE EXCEPTION 'RDL-026 trust tables missing';
  END IF;
  IF to_regclass('rdl.ai_trust_metrics') IS NULL THEN
    RAISE EXCEPTION 'RDL-026 trust metrics view missing';
  END IF;

  INSERT INTO rdl.ai_advisory_run(advisory_key,actor_key,intent,question,evidence_manifest,answer_text,answer_sha256,model_key,prompt_version)
  VALUES(v_run,'rdl026-tester','general','RDL-026 test question','{"schemaVersion":"rdl-ai-evidence/v1","items":[{"id":"test:026","kind":"test","title":"Trust evidence","detail":"fixture","source":"application","authority":"direct"}]}'::jsonb,'Advisory test answer.',repeat('b',64),'test-model','rdl-ai-standards-v1');

  INSERT INTO rdl.ai_feedback(feedback_key,advisory_key,actor_key,classification,comment,evidence_concern)
  VALUES('rdl-026-feedback',v_run,'rdl026-tester','helpful','Useful grounded answer.',false);

  INSERT INTO rdl.ai_evaluation_case(case_key,case_version,intent,question,expected_evidence,acceptance_criteria,created_by)
  VALUES('provenance-basic',1,'provenance','Explain provenance.', '["test:026"]'::jsonb, '{"minimumGroundedness":0.9}'::jsonb,'rdl026-tester')
  RETURNING ai_evaluation_case_id INTO v_case;

  INSERT INTO rdl.ai_evaluation_result(result_key,ai_evaluation_case_id,model_key,prompt_version,groundedness_score,evidence_coverage_score,unsupported_claim_count,verdict,result_detail,result_sha256,evaluated_by)
  VALUES('rdl-026-result',v_case,'test-model','rdl-ai-standards-v1',1,1,0,'pass','{"method":"deterministic-fixture"}'::jsonb,repeat('c',64),'rdl026-tester')
  RETURNING ai_evaluation_result_id INTO v_result;

  IF NOT EXISTS (SELECT 1 FROM rdl.ai_trust_metrics WHERE feedback_count=1 AND helpful_count=1 AND evaluation_count=1 AND pass_count=1) THEN
    RAISE EXCEPTION 'RDL-026 trust metric aggregation failed';
  END IF;

  BEGIN
    UPDATE rdl.ai_feedback SET comment='mutated' WHERE feedback_key='rdl-026-feedback';
  EXCEPTION WHEN OTHERS THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'RDL-026 feedback must be append-only'; END IF;

  RAISE NOTICE 'PASS RDL-026 AI evaluation, feedback and trust controls';
END $$;

ROLLBACK;
\echo 'PASS RDL-026 AI evaluation, feedback and trust controls'
