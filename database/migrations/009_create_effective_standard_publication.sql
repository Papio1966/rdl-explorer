-- RDL-018: effective standard comparison and immutable publication artifacts.

CREATE TABLE IF NOT EXISTS rdl.effective_standard_release (
  effective_standard_release_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  context_id bigint NOT NULL REFERENCES rdl.enterprise_context(context_id) ON DELETE RESTRICT,
  release_key text NOT NULL,
  release_version text NOT NULL,
  composition_sha256 text NOT NULL CHECK (composition_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  comparison_summary jsonb NOT NULL,
  package_manifest jsonb NOT NULL,
  package_payload jsonb NOT NULL,
  published_by text NOT NULL CHECK (length(btrim(published_by)) > 0),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(context_id, release_key, release_version),
  UNIQUE(context_id, composition_sha256)
);

CREATE INDEX IF NOT EXISTS idx_effective_standard_release_context
  ON rdl.effective_standard_release(context_id, published_at DESC);

CREATE OR REPLACE FUNCTION rdl.prevent_effective_standard_release_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'effective standard releases are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_effective_standard_release_immutable ON rdl.effective_standard_release;
CREATE TRIGGER trg_effective_standard_release_immutable
BEFORE UPDATE OR DELETE ON rdl.effective_standard_release
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_effective_standard_release_mutation();

CREATE OR REPLACE VIEW rdl.effective_standard_release_summary AS
SELECT r.effective_standard_release_id,r.context_id,c.context_key,c.context_type,c.name AS context_name,
       r.release_key,r.release_version,r.composition_sha256,r.comparison_summary,r.published_by,r.published_at
FROM rdl.effective_standard_release r
JOIN rdl.enterprise_context c ON c.context_id=r.context_id;

COMMENT ON TABLE rdl.effective_standard_release IS 'Immutable machine-consumable effective enterprise standard publication produced from exact context lineage, package pins and governed extensions.';
