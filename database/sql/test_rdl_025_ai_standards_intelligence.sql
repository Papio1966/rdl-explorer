\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_id bigint;
  v_failed boolean := false;
BEGIN
  IF to_regclass('rdl.ai_advisory_run') IS NULL THEN
    RAISE EXCEPTION 'RDL-025 ai_advisory_run table missing';
  END IF;
  IF to_regclass('rdl.ai_advisory_run_summary') IS NULL THEN
    RAISE EXCEPTION 'RDL-025 ai_advisory_run_summary view missing';
  END IF;

  INSERT INTO rdl.ai_advisory_run(
    advisory_key, actor_key, intent, question, evidence_manifest, answer_text, answer_sha256, model_key
  ) VALUES (
    'rdl-025-test-run', 'test-reviewer', 'provenance', 'Explain provenance for this test.',
    '{"schemaVersion":"rdl-ai-evidence/v1","items":[{"id":"test:1","kind":"test","title":"Test evidence","source":"application"}]}'::jsonb,
    'This is an advisory test answer.', repeat('a',64), 'test-model'
  ) RETURNING ai_advisory_run_id INTO v_id;

  IF NOT EXISTS (SELECT 1 FROM rdl.ai_advisory_run_summary WHERE ai_advisory_run_id=v_id AND evidence_item_count=1) THEN
    RAISE EXCEPTION 'RDL-025 advisory summary projection failed';
  END IF;

  BEGIN
    UPDATE rdl.ai_advisory_run SET answer_text='mutated' WHERE ai_advisory_run_id=v_id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'RDL-025 advisory run must be immutable'; END IF;

  RAISE NOTICE 'PASS RDL-025 AI-assisted standards intelligence';
END $$;

ROLLBACK;
\echo 'PASS RDL-025 AI-assisted standards intelligence'
