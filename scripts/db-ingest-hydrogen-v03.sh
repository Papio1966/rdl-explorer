#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DATABASE_URL_VALUE="${RDL_DATABASE_URL:-postgresql://localhost:5432/rdl_explorer}"

INDEX_BACKUP_DIR="$HOME/Downloads/rdl-explorer-hydrogen-v03-index-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$INDEX_BACKUP_DIR"
INDEX_FILES=(public/rdl-search-index.json public/rdl-relationship-index.json public/rdl-cross-intelligence.json)
for FILE in "${INDEX_FILES[@]}"; do
  if [ -f "$FILE" ]; then cp -p "$FILE" "$INDEX_BACKUP_DIR/$(basename "$FILE")"; fi
done
INDEX_REGEN_SUCCEEDED=0
restore_indexes_on_failure() {
  local EXIT_STATUS=$?
  if [ "$EXIT_STATUS" -ne 0 ] && [ "$INDEX_REGEN_SUCCEEDED" -eq 0 ]; then
    for FILE in "${INDEX_FILES[@]}"; do
      if [ -f "$INDEX_BACKUP_DIR/$(basename "$FILE")" ]; then
        cp -p "$INDEX_BACKUP_DIR/$(basename "$FILE")" "$FILE"
      fi
    done
    echo "Generated index files restored from $INDEX_BACKUP_DIR"
  fi
}
trap restore_indexes_on_failure EXIT
echo "Generated index backup: $INDEX_BACKUP_DIR"

echo "Loading Hydrogen RDL Extension v0.3 as an additional Level 1 candidate release..."
npx tsx scripts/generate-hydrogen-v03-ingestion-sql.ts \
  | psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -f -

echo "Generating the RDL search index including Hydrogen..."
npm run generate:rdl-search-index
echo "Generating the RDL relationship index including Hydrogen..."
npm run generate:rdl-relationship-index
echo "Generating cross-RDL candidate intelligence including Hydrogen..."
npm run generate:rdl-intelligence

psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $hydrogen_v03_final_verification$
DECLARE
  v_release_status text;
  v_package_status text;
  v_sheet_count integer;
  v_source_record_count integer;
BEGIN
  SELECT r.release_status, p.package_status
    INTO v_release_status, v_package_status
  FROM rdl.rdl_source s
  JOIN rdl.rdl_release r ON r.source_id = s.source_id
  JOIN rdl.rdl_package p ON p.release_id = r.release_id
  WHERE s.source_key = 'hydrogen'
    AND r.release_key = 'hydrogen-0.3-candidate'
    AND p.package_key = 'hydrogen-0-3-candidate-5d8e4e9610ec';

  IF v_release_status IS DISTINCT FROM 'candidate'
     OR v_package_status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'Hydrogen candidate release/package status verification failed';
  END IF;

  SELECT count(*)::integer INTO v_sheet_count
  FROM rdl.rdl_source_sheet sh
  JOIN rdl.rdl_package p ON p.package_id = sh.package_id
  WHERE p.package_key = 'hydrogen-0-3-candidate-5d8e4e9610ec';

  SELECT count(*)::integer INTO v_source_record_count
  FROM rdl.rdl_source_record sr
  JOIN rdl.rdl_package p ON p.package_id = sr.package_id
  WHERE p.package_key = 'hydrogen-0-3-candidate-5d8e4e9610ec';

  IF v_sheet_count <> 23 OR v_source_record_count <> 10065 THEN
    RAISE EXCEPTION 'Hydrogen source preservation verification failed: sheets %, rows %', v_sheet_count, v_source_record_count;
  END IF;
END;
$hydrogen_v03_final_verification$;
SQL

psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT
  s.source_key,
  s.name AS source_name,
  r.release_key,
  r.version_label,
  r.release_status,
  p.package_status,
  p.content_sha256,
  (SELECT count(*) FROM rdl.rdl_entity e WHERE e.package_id = p.package_id) AS entity_count,
  (SELECT count(*) FROM rdl.rdl_relationship x WHERE x.package_id = p.package_id) AS relationship_count,
  (SELECT count(*) FROM rdl.rdl_source_sheet sh WHERE sh.package_id = p.package_id) AS source_sheet_count,
  (SELECT count(*) FROM rdl.rdl_source_record sr WHERE sr.package_id = p.package_id) AS source_record_count
FROM rdl.rdl_source s
JOIN rdl.rdl_release r ON r.source_id = s.source_id
JOIN rdl.rdl_package p ON p.release_id = r.release_id
WHERE s.source_key = 'hydrogen'
  AND r.release_key = 'hydrogen-0.3-candidate'
ORDER BY p.package_id;
SQL

INDEX_REGEN_SUCCEEDED=1
echo "PASS Hydrogen v0.3 is registered as an additional candidate L1 library."
