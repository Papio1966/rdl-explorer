-- RDL-025: AI-assisted standards intelligence.
-- Advisory AI outputs are evidence-backed and immutable once recorded.
-- This layer never changes governed standards, approvals, publications, migrations or consumer activation state.

CREATE TABLE IF NOT EXISTS rdl.ai_advisory_run (
  ai_advisory_run_id bigserial PRIMARY KEY,
  advisory_key text NOT NULL UNIQUE,
  actor_key text NOT NULL CHECK (length(btrim(actor_key)) > 0),
  intent text NOT NULL CHECK (intent IN ('explain_entity','release_change','impact_summary','mapping_suggestion','extension_review','migration_plan','work_queue','provenance','general')),
  question text NOT NULL CHECK (length(btrim(question)) > 0),
  evidence_contract text NOT NULL DEFAULT 'rdl-ai-evidence/v1',
  evidence_manifest jsonb NOT NULL,
  answer_text text NOT NULL CHECK (length(btrim(answer_text)) > 0),
  answer_sha256 text NOT NULL CHECK (answer_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  model_key text NOT NULL CHECK (length(btrim(model_key)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (answer_sha256, actor_key, question)
);

CREATE INDEX IF NOT EXISTS ai_advisory_run_actor_idx
  ON rdl.ai_advisory_run(actor_key, created_at DESC);

CREATE OR REPLACE FUNCTION rdl.prevent_ai_advisory_run_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AI advisory runs are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_advisory_run_immutable ON rdl.ai_advisory_run;
CREATE TRIGGER trg_ai_advisory_run_immutable
BEFORE UPDATE OR DELETE ON rdl.ai_advisory_run
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_ai_advisory_run_mutation();

CREATE OR REPLACE VIEW rdl.ai_advisory_run_summary AS
SELECT ai_advisory_run_id, advisory_key, actor_key, intent, evidence_contract,
       jsonb_array_length(COALESCE(evidence_manifest->'items','[]'::jsonb))::integer AS evidence_item_count,
       model_key, answer_sha256, created_at
FROM rdl.ai_advisory_run;

COMMENT ON TABLE rdl.ai_advisory_run IS
'RDL-025 immutable audit record of evidence-backed advisory AI synthesis. It owns no governance decision.';
COMMENT ON VIEW rdl.ai_advisory_run_summary IS
'RDL-025 lightweight audit projection for advisory AI usage without exposing full question or answer text.';
