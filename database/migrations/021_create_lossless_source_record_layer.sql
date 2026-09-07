-- RDL-041.1: Lossless package-scoped source sheet and source record storage.
--
-- This layer preserves the reviewed source artifact independently from the
-- normalized rdl_entity / rdl_relationship projections. A source row is kept
-- even when it cannot be projected or its references cannot be resolved.

CREATE TABLE IF NOT EXISTS rdl.rdl_source_sheet (
  source_sheet_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL
    REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  sheet_name text NOT NULL
    CHECK (btrim(sheet_name) <> ''),
  sheet_order integer NOT NULL
    CHECK (sheet_order >= 0),
  first_data_row_number integer NOT NULL DEFAULT 2
    CHECK (first_data_row_number >= 1),
  headers jsonb NOT NULL
    CHECK (jsonb_typeof(headers) = 'array'),
  source_row_count integer NOT NULL
    CHECK (source_row_count >= 0),
  sheet_sha256 text NOT NULL
    CHECK (sheet_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, sheet_name),
  UNIQUE (package_id, sheet_order),
  UNIQUE (source_sheet_id, package_id)
);

CREATE TABLE IF NOT EXISTS rdl.rdl_source_record (
  source_record_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL
    REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  source_sheet_id bigint NOT NULL,
  source_row_number integer NOT NULL
    CHECK (source_row_number >= 1),
  record_order integer NOT NULL
    CHECK (record_order >= 0),
  raw_row jsonb NOT NULL
    CHECK (jsonb_typeof(raw_row) = 'object'),
  row_sha256 text NOT NULL
    CHECK (row_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rdl_source_record_sheet_package_fkey
    FOREIGN KEY (source_sheet_id, package_id)
    REFERENCES rdl.rdl_source_sheet(source_sheet_id, package_id)
    ON DELETE RESTRICT,
  UNIQUE (source_sheet_id, source_row_number),
  UNIQUE (source_sheet_id, record_order)
);

CREATE INDEX IF NOT EXISTS idx_rdl_source_record_package_sheet_order
  ON rdl.rdl_source_record(package_id, source_sheet_id, record_order);

CREATE INDEX IF NOT EXISTS idx_rdl_source_record_package_hash
  ON rdl.rdl_source_record(package_id, row_sha256);

CREATE OR REPLACE VIEW rdl.rdl_source_sheet_summary AS
SELECT
  ss.source_sheet_id,
  ss.package_id,
  ss.sheet_name,
  ss.sheet_order,
  ss.first_data_row_number,
  ss.headers,
  ss.source_row_count,
  count(sr.source_record_id)::integer AS stored_row_count,
  ss.sheet_sha256,
  (count(sr.source_record_id) = ss.source_row_count) AS row_count_matches,
  ss.created_at
FROM rdl.rdl_source_sheet ss
LEFT JOIN rdl.rdl_source_record sr
  ON sr.source_sheet_id = ss.source_sheet_id
 AND sr.package_id = ss.package_id
GROUP BY
  ss.source_sheet_id,
  ss.package_id,
  ss.sheet_name,
  ss.sheet_order,
  ss.first_data_row_number,
  ss.headers,
  ss.source_row_count,
  ss.sheet_sha256,
  ss.created_at;

CREATE OR REPLACE FUNCTION rdl.prevent_lossless_source_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Lossless source evidence is immutable; create a new governed package instead of % on %.%',
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS rdl_source_sheet_immutable_ud
  ON rdl.rdl_source_sheet;
CREATE TRIGGER rdl_source_sheet_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.rdl_source_sheet
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_lossless_source_mutation();

DROP TRIGGER IF EXISTS rdl_source_record_immutable_ud
  ON rdl.rdl_source_record;
CREATE TRIGGER rdl_source_record_immutable_ud
BEFORE UPDATE OR DELETE ON rdl.rdl_source_record
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_lossless_source_mutation();

COMMENT ON TABLE rdl.rdl_source_sheet IS
  'RDL-041 immutable package-scoped worksheet contract: exact sheet identity, order, headers, row count and semantic hash.';

COMMENT ON TABLE rdl.rdl_source_record IS
  'RDL-041 immutable lossless parsed source row. Rows remain present even when normalized projection is unresolved or not applicable.';

COMMENT ON COLUMN rdl.rdl_source_record.record_order IS
  'Zero-based order within the parsed worksheet row array; source_row_number preserves the original worksheet row number.';

COMMENT ON COLUMN rdl.rdl_source_record.raw_row IS
  'Exact parsed row object from the governed source snapshot, before normalized RDL projection.';

COMMENT ON VIEW rdl.rdl_source_sheet_summary IS
  'RDL-041 read model for package/sheet order, headers and source-record row-count completeness.';
