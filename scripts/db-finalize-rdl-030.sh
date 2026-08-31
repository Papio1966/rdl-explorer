#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
psql "$RDL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f - <<'SQL'
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id
    JOIN rdl.rdl_package p ON p.release_id=r.release_id
    WHERE s.source_key='ccus' AND r.release_key='ccus-2.0-candidate' AND p.package_status='validated'
  ) OR NOT EXISTS (
    SELECT 1 FROM rdl.rdl_release r JOIN rdl.rdl_source s ON s.source_id=r.source_id
    JOIN rdl.rdl_package p ON p.release_id=r.release_id
    WHERE s.source_key='water-desalination' AND r.release_key='water-desalination-2.0-candidate' AND p.package_status='validated'
  ) THEN
    RAISE EXCEPTION 'RDL-030 v2 packages must validate before historical releases can be superseded.';
  END IF;
END $$;
UPDATE rdl.rdl_release r SET release_status='superseded', notes=COALESCE(notes,'') || E'\nSuperseded by RDL-030 release-safe v2 candidate.'
FROM rdl.rdl_source s WHERE s.source_id=r.source_id AND (
  (s.source_key='ccus' AND r.release_key='ccus-0.1-draft') OR
  (s.source_key='water-desalination' AND r.release_key='water-desalination-0.1-draft')
);
COMMIT;
SQL
echo "PASS RDL-030 historical releases marked superseded without deletion"
