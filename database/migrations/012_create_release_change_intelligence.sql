-- RDL-021: persisted release-to-release impact analyses and governed release notes.

CREATE TABLE IF NOT EXISTS rdl.release_change_analysis (
  release_change_analysis_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  to_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  analysis_contract text NOT NULL DEFAULT 'rdl-release-impact/v1',
  change_summary jsonb NOT NULL,
  impact_summary jsonb NOT NULL,
  release_notes jsonb NOT NULL,
  analysis_sha256 text NOT NULL CHECK (analysis_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  generated_by text NOT NULL CHECK (length(btrim(generated_by)) > 0),
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_release_id <> to_release_id),
  UNIQUE (from_release_id,to_release_id,analysis_contract),
  UNIQUE (analysis_sha256)
);

CREATE OR REPLACE FUNCTION rdl.prevent_release_change_analysis_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'release change analyses are immutable';
END;
$$;
DROP TRIGGER IF EXISTS trg_release_change_analysis_immutable ON rdl.release_change_analysis;
CREATE TRIGGER trg_release_change_analysis_immutable
BEFORE UPDATE OR DELETE ON rdl.release_change_analysis
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_release_change_analysis_mutation();

CREATE OR REPLACE VIEW rdl.release_change_analysis_summary AS
SELECT a.release_change_analysis_id,a.from_release_id,fr.release_key AS from_release_key,fr.release_version AS from_release_version,
       a.to_release_id,tr.release_key AS to_release_key,tr.release_version AS to_release_version,
       a.analysis_contract,a.change_summary,a.impact_summary,a.analysis_sha256,a.generated_by,a.generated_at
FROM rdl.release_change_analysis a
JOIN rdl.effective_standard_release fr ON fr.effective_standard_release_id=a.from_release_id
JOIN rdl.effective_standard_release tr ON tr.effective_standard_release_id=a.to_release_id;

COMMENT ON TABLE rdl.release_change_analysis IS 'Immutable advisory comparison between two exact published releases. Analysis never migrates or activates a consumer.';
