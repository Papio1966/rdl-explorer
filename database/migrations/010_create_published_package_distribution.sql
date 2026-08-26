-- RDL-019: published package distribution metadata and consumer lifecycle.

CREATE TABLE IF NOT EXISTS rdl.effective_standard_distribution (
  distribution_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_standard_release_id bigint NOT NULL UNIQUE
    REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active','deprecated','superseded')),
  superseded_by_release_id bigint
    REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  compatibility jsonb NOT NULL DEFAULT '{"contract":"rdl-distribution/v1","minimumConsumerVersion":"1.0"}'::jsonb,
  deprecation_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (superseded_by_release_id IS NULL OR superseded_by_release_id <> effective_standard_release_id),
  CHECK ((lifecycle_status = 'superseded' AND superseded_by_release_id IS NOT NULL) OR lifecycle_status <> 'superseded')
);

INSERT INTO rdl.effective_standard_distribution(effective_standard_release_id)
SELECT effective_standard_release_id FROM rdl.effective_standard_release
ON CONFLICT (effective_standard_release_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_effective_standard_distribution_status
  ON rdl.effective_standard_distribution(lifecycle_status, effective_standard_release_id);

CREATE OR REPLACE VIEW rdl.distributed_effective_standard_release AS
SELECT r.effective_standard_release_id AS release_id,
       r.context_id,c.context_key,c.context_type,c.name AS context_name,
       r.release_key,r.release_version,r.composition_sha256,r.published_by,r.published_at,
       d.lifecycle_status,d.superseded_by_release_id,d.compatibility,d.deprecation_message
FROM rdl.effective_standard_release r
JOIN rdl.enterprise_context c ON c.context_id=r.context_id
LEFT JOIN rdl.effective_standard_distribution d
  ON d.effective_standard_release_id=r.effective_standard_release_id;

COMMENT ON TABLE rdl.effective_standard_distribution IS
'Consumer-facing lifecycle and compatibility metadata for immutable effective-standard releases. Release package content remains immutable; deprecation and supersession are separate distribution metadata.';
