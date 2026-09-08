-- RDL-041.2: Immutable source-record to normalized-projection accounting.
--
-- Existing source evidence and normalized entities/relationships remain unchanged.
-- The accounting batch captures an exact source/normalized-state pair, while the
-- many-to-many link ledger records primary and contributing lineage. Zero-output
-- source records receive an explicit governed disposition.

CREATE UNIQUE INDEX IF NOT EXISTS rdl_source_record_id_package_uidx
  ON rdl.rdl_source_record(source_record_id, package_id);

CREATE UNIQUE INDEX IF NOT EXISTS rdl_relationship_id_package_uidx
  ON rdl.rdl_relationship(relationship_id, package_id);

CREATE TABLE IF NOT EXISTS rdl.rdl_projection_accounting_batch (
  accounting_batch_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL
    REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  adapter_key text NOT NULL CHECK (btrim(adapter_key) <> ''),
  adapter_version text NOT NULL CHECK (btrim(adapter_version) <> ''),
  source_content_sha256 text NOT NULL
    CHECK (source_content_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  source_layer_sha256 text NOT NULL
    CHECK (source_layer_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  normalized_projection_sha256 text NOT NULL
    CHECK (normalized_projection_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  source_record_count integer NOT NULL CHECK (source_record_count >= 0),
  normalized_entity_count integer NOT NULL CHECK (normalized_entity_count >= 0),
  normalized_relationship_count integer NOT NULL
    CHECK (normalized_relationship_count >= 0),
  projection_link_count integer NOT NULL CHECK (projection_link_count >= 0),
  projected_source_record_count integer NOT NULL
    CHECK (projected_source_record_count >= 0),
  disposition_count integer NOT NULL CHECK (disposition_count >= 0),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(summary) = 'object'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (
    package_id,
    adapter_key,
    adapter_version,
    source_layer_sha256,
    normalized_projection_sha256
  ),
  UNIQUE (accounting_batch_id, package_id),
  CHECK (projected_source_record_count + disposition_count = source_record_count)
);

CREATE TABLE IF NOT EXISTS rdl.rdl_source_projection_link (
  projection_link_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accounting_batch_id bigint NOT NULL,
  package_id bigint NOT NULL,
  source_record_id bigint NOT NULL,
  projection_kind text NOT NULL
    CHECK (projection_kind IN ('entity', 'relationship')),
  entity_id bigint,
  relationship_id bigint,
  lineage_role text NOT NULL
    CHECK (lineage_role IN ('primary', 'contributing')),
  linkage_method text NOT NULL
    CHECK (linkage_method IN ('semantic_identifier', 'semantic_endpoints')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rdl_source_projection_link_batch_package_fkey
    FOREIGN KEY (accounting_batch_id, package_id)
    REFERENCES rdl.rdl_projection_accounting_batch(
      accounting_batch_id,
      package_id
    ) ON DELETE RESTRICT,
  CONSTRAINT rdl_source_projection_link_record_package_fkey
    FOREIGN KEY (source_record_id, package_id)
    REFERENCES rdl.rdl_source_record(source_record_id, package_id)
    ON DELETE RESTRICT,
  CONSTRAINT rdl_source_projection_link_entity_package_fkey
    FOREIGN KEY (entity_id, package_id)
    REFERENCES rdl.rdl_entity(entity_id, package_id)
    ON DELETE RESTRICT,
  CONSTRAINT rdl_source_projection_link_relationship_package_fkey
    FOREIGN KEY (relationship_id, package_id)
    REFERENCES rdl.rdl_relationship(relationship_id, package_id)
    ON DELETE RESTRICT,
  CHECK (
    (projection_kind = 'entity' AND entity_id IS NOT NULL AND relationship_id IS NULL)
    OR
    (projection_kind = 'relationship' AND relationship_id IS NOT NULL AND entity_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS rdl_source_projection_link_entity_uidx
  ON rdl.rdl_source_projection_link(
    accounting_batch_id,
    source_record_id,
    entity_id
  )
  WHERE entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rdl_source_projection_link_relationship_uidx
  ON rdl.rdl_source_projection_link(
    accounting_batch_id,
    source_record_id,
    relationship_id
  )
  WHERE relationship_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rdl_source_projection_link_entity_primary_uidx
  ON rdl.rdl_source_projection_link(accounting_batch_id, entity_id)
  WHERE entity_id IS NOT NULL AND lineage_role = 'primary';

CREATE UNIQUE INDEX IF NOT EXISTS rdl_source_projection_link_relationship_primary_uidx
  ON rdl.rdl_source_projection_link(accounting_batch_id, relationship_id)
  WHERE relationship_id IS NOT NULL AND lineage_role = 'primary';

CREATE INDEX IF NOT EXISTS idx_rdl_source_projection_link_record
  ON rdl.rdl_source_projection_link(
    accounting_batch_id,
    source_record_id,
    projection_kind
  );

CREATE TABLE IF NOT EXISTS rdl.rdl_source_projection_disposition (
  projection_disposition_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  accounting_batch_id bigint NOT NULL,
  package_id bigint NOT NULL,
  source_record_id bigint NOT NULL,
  disposition_status text NOT NULL
    CHECK (disposition_status IN ('unresolved', 'unmapped', 'not_applicable', 'error')),
  reason_code text NOT NULL CHECK (btrim(reason_code) <> ''),
  reason_detail text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rdl_source_projection_disposition_batch_package_fkey
    FOREIGN KEY (accounting_batch_id, package_id)
    REFERENCES rdl.rdl_projection_accounting_batch(
      accounting_batch_id,
      package_id
    ) ON DELETE RESTRICT,
  CONSTRAINT rdl_source_projection_disposition_record_package_fkey
    FOREIGN KEY (source_record_id, package_id)
    REFERENCES rdl.rdl_source_record(source_record_id, package_id)
    ON DELETE RESTRICT,
  UNIQUE (accounting_batch_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_rdl_source_projection_disposition_status
  ON rdl.rdl_source_projection_disposition(
    accounting_batch_id,
    disposition_status,
    reason_code
  );

CREATE OR REPLACE FUNCTION rdl.validate_projection_accounting_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'rdl_source_projection_link' THEN
    IF EXISTS (
      SELECT 1
      FROM rdl.rdl_source_projection_disposition d
      WHERE d.accounting_batch_id = NEW.accounting_batch_id
        AND d.source_record_id = NEW.source_record_id
    ) THEN
      RAISE EXCEPTION
        'Source record % already has a zero-output disposition in accounting batch %',
        NEW.source_record_id,
        NEW.accounting_batch_id
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'rdl_source_projection_disposition' THEN
    IF EXISTS (
      SELECT 1
      FROM rdl.rdl_source_projection_link l
      WHERE l.accounting_batch_id = NEW.accounting_batch_id
        AND l.source_record_id = NEW.source_record_id
    ) THEN
      RAISE EXCEPTION
        'Source record % already has projection links in accounting batch %',
        NEW.source_record_id,
        NEW.accounting_batch_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rdl_source_projection_link_exclusive_i
  ON rdl.rdl_source_projection_link;
CREATE TRIGGER rdl_source_projection_link_exclusive_i
BEFORE INSERT ON rdl.rdl_source_projection_link
FOR EACH ROW EXECUTE FUNCTION rdl.validate_projection_accounting_exclusivity();

DROP TRIGGER IF EXISTS rdl_source_projection_disposition_exclusive_i
  ON rdl.rdl_source_projection_disposition;
CREATE TRIGGER rdl_source_projection_disposition_exclusive_i
BEFORE INSERT ON rdl.rdl_source_projection_disposition
FOR EACH ROW EXECUTE FUNCTION rdl.validate_projection_accounting_exclusivity();

CREATE OR REPLACE FUNCTION rdl.prevent_projection_accounting_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Projection-accounting evidence is immutable; create a new accounting batch instead of % on %.%',
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS rdl_projection_accounting_batch_immutable_ud
  ON rdl.rdl_projection_accounting_batch;
CREATE TRIGGER rdl_projection_accounting_batch_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.rdl_projection_accounting_batch
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_projection_accounting_mutation();

DROP TRIGGER IF EXISTS rdl_source_projection_link_immutable_ud
  ON rdl.rdl_source_projection_link;
CREATE TRIGGER rdl_source_projection_link_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.rdl_source_projection_link
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_projection_accounting_mutation();

DROP TRIGGER IF EXISTS rdl_source_projection_disposition_immutable_ud
  ON rdl.rdl_source_projection_disposition;
CREATE TRIGGER rdl_source_projection_disposition_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.rdl_source_projection_disposition
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_projection_accounting_mutation();

CREATE OR REPLACE VIEW rdl.rdl_source_projection_accounting AS
WITH current_batch AS (
  SELECT DISTINCT ON (b.package_id)
    b.*
  FROM rdl.rdl_projection_accounting_batch b
  ORDER BY b.package_id, b.completed_at DESC, b.accounting_batch_id DESC
),
link_counts AS (
  SELECT
    l.accounting_batch_id,
    l.source_record_id,
    count(*) FILTER (WHERE l.projection_kind = 'entity')::integer AS entity_link_count,
    count(*) FILTER (WHERE l.projection_kind = 'relationship')::integer AS relationship_link_count,
    count(*) FILTER (WHERE l.lineage_role = 'primary')::integer AS primary_link_count,
    count(*) FILTER (WHERE l.lineage_role = 'contributing')::integer AS contributing_link_count
  FROM rdl.rdl_source_projection_link l
  JOIN current_batch b
    ON b.accounting_batch_id = l.accounting_batch_id
  GROUP BY l.accounting_batch_id, l.source_record_id
)
SELECT
  b.accounting_batch_id,
  sr.package_id,
  ss.source_sheet_id,
  ss.sheet_name,
  ss.sheet_order,
  sr.source_record_id,
  sr.source_row_number,
  sr.record_order,
  COALESCE(lc.entity_link_count, 0) AS entity_link_count,
  COALESCE(lc.relationship_link_count, 0) AS relationship_link_count,
  COALESCE(lc.primary_link_count, 0) AS primary_link_count,
  COALESCE(lc.contributing_link_count, 0) AS contributing_link_count,
  COALESCE(lc.entity_link_count, 0)
    + COALESCE(lc.relationship_link_count, 0) AS total_projection_link_count,
  CASE
    WHEN lc.source_record_id IS NOT NULL THEN 'projected'
    WHEN d.projection_disposition_id IS NOT NULL THEN d.disposition_status
    ELSE 'unaccounted'
  END AS projection_status,
  CASE
    WHEN lc.source_record_id IS NOT NULL THEN NULL
    ELSE d.reason_code
  END AS reason_code,
  CASE
    WHEN lc.source_record_id IS NOT NULL THEN NULL
    ELSE d.reason_detail
  END AS reason_detail,
  'not_assessed'::text AS semantic_completeness_status,
  sr.row_sha256,
  sr.raw_row
FROM current_batch b
JOIN rdl.rdl_source_record sr
  ON sr.package_id = b.package_id
JOIN rdl.rdl_source_sheet ss
  ON ss.source_sheet_id = sr.source_sheet_id
 AND ss.package_id = sr.package_id
LEFT JOIN link_counts lc
  ON lc.accounting_batch_id = b.accounting_batch_id
 AND lc.source_record_id = sr.source_record_id
LEFT JOIN rdl.rdl_source_projection_disposition d
  ON d.accounting_batch_id = b.accounting_batch_id
 AND d.source_record_id = sr.source_record_id;

CREATE OR REPLACE VIEW rdl.rdl_source_projection_accounting_summary AS
SELECT
  accounting_batch_id,
  package_id,
  sheet_order,
  sheet_name,
  projection_status,
  reason_code,
  count(*)::integer AS source_record_count,
  sum(entity_link_count)::bigint AS entity_link_count,
  sum(relationship_link_count)::bigint AS relationship_link_count,
  sum(contributing_link_count)::bigint AS contributing_link_count
FROM rdl.rdl_source_projection_accounting
GROUP BY
  accounting_batch_id,
  package_id,
  sheet_order,
  sheet_name,
  projection_status,
  reason_code;

CREATE OR REPLACE VIEW rdl.rdl_normalized_projection_lineage AS
SELECT
  l.accounting_batch_id,
  l.package_id,
  l.projection_kind,
  l.entity_id,
  l.relationship_id,
  l.lineage_role,
  l.linkage_method,
  ss.sheet_name,
  ss.sheet_order,
  sr.source_record_id,
  sr.source_row_number,
  sr.record_order,
  sr.row_sha256,
  l.evidence
FROM rdl.rdl_source_projection_link l
JOIN rdl.rdl_source_record sr
  ON sr.source_record_id = l.source_record_id
 AND sr.package_id = l.package_id
JOIN rdl.rdl_source_sheet ss
  ON ss.source_sheet_id = sr.source_sheet_id
 AND ss.package_id = sr.package_id;

COMMENT ON TABLE rdl.rdl_projection_accounting_batch IS
  'RDL-041.2 immutable accounting snapshot for one exact source-layer and normalized-projection state.';

COMMENT ON TABLE rdl.rdl_source_projection_link IS
  'RDL-041.2 authoritative many-to-many lineage from source records to normalized entities or relationships.';

COMMENT ON TABLE rdl.rdl_source_projection_disposition IS
  'RDL-041.2 explicit zero-output classification. Projected status is derived from links and is not stored here.';

COMMENT ON COLUMN rdl.rdl_source_projection_link.lineage_role IS
  'primary identifies the first authoritative source row for an object; contributing preserves additional source rows consolidated into the same object.';

COMMENT ON VIEW rdl.rdl_source_projection_accounting IS
  'Current package-level row accounting. Projection status is row-level only; semantic completeness remains explicitly not assessed.';

COMMENT ON VIEW rdl.rdl_normalized_projection_lineage IS
  'Reverse lineage from each normalized entity/relationship to all primary and contributing source records.';
