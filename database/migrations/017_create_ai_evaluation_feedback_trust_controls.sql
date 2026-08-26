-- RDL-026: AI evaluation, feedback and trust controls.
-- Trust controls measure advisory AI quality without promoting models or making governance decisions.

ALTER TABLE rdl.ai_advisory_run
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT 'rdl-ai-standards-v1';

CREATE OR REPLACE VIEW rdl.ai_advisory_run_summary AS
SELECT ai_advisory_run_id, advisory_key, actor_key, intent, evidence_contract,
       jsonb_array_length(COALESCE(evidence_manifest->'items','[]'::jsonb))::integer AS evidence_item_count,
       model_key, answer_sha256, created_at, prompt_version
FROM rdl.ai_advisory_run;

CREATE TABLE IF NOT EXISTS rdl.ai_feedback (
  ai_feedback_id bigserial PRIMARY KEY,
  feedback_key text NOT NULL UNIQUE,
  advisory_key text NOT NULL REFERENCES rdl.ai_advisory_run(advisory_key),
  actor_key text NOT NULL CHECK (length(btrim(actor_key)) > 0),
  classification text NOT NULL CHECK (classification IN ('helpful','incorrect','incomplete')),
  comment text,
  evidence_concern boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_feedback_advisory_idx ON rdl.ai_feedback(advisory_key, created_at DESC);

CREATE TABLE IF NOT EXISTS rdl.ai_evaluation_case (
  ai_evaluation_case_id bigserial PRIMARY KEY,
  case_key text NOT NULL,
  case_version integer NOT NULL CHECK (case_version > 0),
  intent text NOT NULL,
  question text NOT NULL CHECK (length(btrim(question)) > 0),
  expected_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_key, case_version)
);

CREATE TABLE IF NOT EXISTS rdl.ai_evaluation_result (
  ai_evaluation_result_id bigserial PRIMARY KEY,
  result_key text NOT NULL UNIQUE,
  ai_evaluation_case_id bigint NOT NULL REFERENCES rdl.ai_evaluation_case(ai_evaluation_case_id),
  model_key text NOT NULL,
  prompt_version text NOT NULL,
  groundedness_score numeric(5,4) NOT NULL CHECK (groundedness_score BETWEEN 0 AND 1),
  evidence_coverage_score numeric(5,4) NOT NULL CHECK (evidence_coverage_score BETWEEN 0 AND 1),
  unsupported_claim_count integer NOT NULL CHECK (unsupported_claim_count >= 0),
  verdict text NOT NULL CHECK (verdict IN ('pass','review','fail')),
  result_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_sha256 text NOT NULL CHECK (result_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  evaluated_by text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION rdl.prevent_ai_trust_record_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AI trust records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_feedback_immutable ON rdl.ai_feedback;
CREATE TRIGGER trg_ai_feedback_immutable BEFORE UPDATE OR DELETE ON rdl.ai_feedback
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_ai_trust_record_mutation();

DROP TRIGGER IF EXISTS trg_ai_evaluation_result_immutable ON rdl.ai_evaluation_result;
CREATE TRIGGER trg_ai_evaluation_result_immutable BEFORE UPDATE OR DELETE ON rdl.ai_evaluation_result
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_ai_trust_record_mutation();

CREATE OR REPLACE VIEW rdl.ai_trust_metrics AS
WITH feedback AS (
  SELECT
    count(*)::integer AS feedback_count,
    count(*) FILTER (WHERE classification='helpful')::integer AS helpful_count,
    count(*) FILTER (WHERE classification='incorrect')::integer AS incorrect_count,
    count(*) FILTER (WHERE classification='incomplete')::integer AS incomplete_count,
    count(*) FILTER (WHERE evidence_concern)::integer AS evidence_concern_count
  FROM rdl.ai_feedback
), eval AS (
  SELECT
    count(*)::integer AS evaluation_count,
    COALESCE(avg(groundedness_score),0)::numeric(5,4) AS avg_groundedness_score,
    COALESCE(avg(evidence_coverage_score),0)::numeric(5,4) AS avg_evidence_coverage_score,
    COALESCE(sum(unsupported_claim_count),0)::integer AS unsupported_claim_count,
    count(*) FILTER (WHERE verdict='pass')::integer AS pass_count,
    count(*) FILTER (WHERE verdict='review')::integer AS review_count,
    count(*) FILTER (WHERE verdict='fail')::integer AS fail_count
  FROM rdl.ai_evaluation_result
)
SELECT f.*, e.*,
  CASE WHEN f.feedback_count=0 THEN 0::numeric(5,4)
       ELSE round(f.helpful_count::numeric/f.feedback_count,4) END AS helpful_rate
FROM feedback f CROSS JOIN eval e;

CREATE OR REPLACE VIEW rdl.ai_advisory_trust_summary AS
SELECT a.advisory_key,a.actor_key,a.intent,a.model_key,a.prompt_version,a.evidence_item_count,a.answer_sha256,a.created_at,
       count(f.ai_feedback_id)::integer AS feedback_count,
       count(f.ai_feedback_id) FILTER (WHERE f.classification='helpful')::integer AS helpful_count,
       count(f.ai_feedback_id) FILTER (WHERE f.classification='incorrect')::integer AS incorrect_count,
       count(f.ai_feedback_id) FILTER (WHERE f.classification='incomplete')::integer AS incomplete_count
FROM rdl.ai_advisory_run_summary a
LEFT JOIN rdl.ai_feedback f ON f.advisory_key=a.advisory_key
GROUP BY a.advisory_key,a.actor_key,a.intent,a.model_key,a.prompt_version,a.evidence_item_count,a.answer_sha256,a.created_at;

COMMENT ON TABLE rdl.ai_feedback IS 'RDL-026 append-only user feedback on advisory AI answers.';
COMMENT ON TABLE rdl.ai_evaluation_case IS 'RDL-026 versioned evaluation dataset cases for repeatable AI trust regression.';
COMMENT ON TABLE rdl.ai_evaluation_result IS 'RDL-026 immutable evaluation results; no automatic model promotion is permitted.';
COMMENT ON VIEW rdl.ai_trust_metrics IS 'RDL-026 aggregate AI quality and trust metrics for operational monitoring.';
