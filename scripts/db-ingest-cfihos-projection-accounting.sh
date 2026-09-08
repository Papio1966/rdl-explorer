#!/usr/bin/env bash
set -euo pipefail

: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL, for example postgresql://localhost:5432/rdl_explorer}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sql_scalar() {
  psql "$RDL_DATABASE_URL" \
    -X \
    -A \
    -t \
    -v ON_ERROR_STOP=1 \
    -P pager=off \
    -c "$1" \
    | tr -d '\r' \
    | sed -n '/[^[:space:]]/p' \
    | tail -1
}

source_layer_fingerprint() {
  local package_id="$1"

  {
    echo "TABLE|rdl.rdl_source_sheet"
    psql "$RDL_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -P pager=off -c \
      "SELECT to_jsonb(q)::text FROM (SELECT * FROM rdl.rdl_source_sheet WHERE package_id=$package_id ORDER BY sheet_order, source_sheet_id) q;"

    echo "TABLE|rdl.rdl_source_record"
    psql "$RDL_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -P pager=off -c \
      "SELECT to_jsonb(q)::text FROM (SELECT * FROM rdl.rdl_source_record WHERE package_id=$package_id ORDER BY source_sheet_id, record_order, source_record_id) q;"

    echo "TABLE|ingestion.ingestion_run|cfihos-lossless-source-v1"
    psql "$RDL_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -P pager=off -c \
      "SELECT to_jsonb(q)::text FROM (SELECT * FROM ingestion.ingestion_run WHERE package_id=$package_id AND adapter_key='cfihos-lossless-source-v1' ORDER BY ingestion_run_id) q;"
  } | shasum -a 256 | awk '{print $1}'
}

normalized_projection_fingerprint() {
  local package_id="$1"

  {
    echo "TABLE|rdl.rdl_entity|semantic"
    psql "$RDL_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -P pager=off -c \
      "SELECT jsonb_build_object(
         'entityType', e.entity_type_code,
         'nativeIdentifier', e.native_identifier,
         'name', e.name,
         'definition', e.definition,
         'lifecycleStatus', e.lifecycle_status,
         'isAuthoritative', e.is_authoritative,
         'metadata', e.normalized_metadata,
         'sourceLocator', e.source_locator
       )::text
       FROM rdl.rdl_entity e
       WHERE e.package_id=$package_id
       ORDER BY e.entity_type_code, e.native_identifier;"

    echo "TABLE|rdl.rdl_relationship|semantic"
    psql "$RDL_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -P pager=off -c \
      "SELECT jsonb_build_object(
         'relationshipType', rel.relationship_type_code,
         'sourceType', src.entity_type_code,
         'sourceIdentifier', src.native_identifier,
         'targetType', tgt.entity_type_code,
         'targetIdentifier', tgt.native_identifier,
         'relationshipStatus', rel.relationship_status,
         'isAuthoritative', rel.is_authoritative,
         'attributes', rel.attributes,
         'sourceLocator', rel.source_locator
       )::text
       FROM rdl.rdl_relationship rel
       JOIN rdl.rdl_entity src
         ON src.entity_id=rel.source_entity_id
        AND src.package_id=rel.package_id
       JOIN rdl.rdl_entity tgt
         ON tgt.entity_id=rel.target_entity_id
        AND tgt.package_id=rel.package_id
       WHERE rel.package_id=$package_id
       ORDER BY
         rel.relationship_type_code,
         src.entity_type_code,
         src.native_identifier,
         tgt.entity_type_code,
         tgt.native_identifier;"
  } | shasum -a 256 | awk '{print $1}'
}

cd "$ROOT"

test -f public/cfihos-workbook.json
test -f database/sql/backfill_rdl_0412_cfihos_projection_accounting.sql

SOURCE_CONTENT_SHA256="$(
  node -e '
    const fs = require("fs");
    const snapshot = JSON.parse(fs.readFileSync("public/cfihos-workbook.json", "utf8"));
    const sha = String(snapshot?.source?.sha256 ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) process.exit(1);
    process.stdout.write(sha);
  '
)"

PACKAGE_KEY="cfihos-2.0-${SOURCE_CONTENT_SHA256:0:12}"
PACKAGE_ID="$(sql_scalar "SELECT package_id FROM rdl.rdl_package WHERE package_key='${PACKAGE_KEY}' AND content_sha256='${SOURCE_CONTENT_SHA256}';")"

test -n "$PACKAGE_ID"

SOURCE_LAYER_SHA256="$(source_layer_fingerprint "$PACKAGE_ID")"
NORMALIZED_PROJECTION_SHA256="$(normalized_projection_fingerprint "$PACKAGE_ID")"

test "${#SOURCE_LAYER_SHA256}" -eq 64
test "${#NORMALIZED_PROJECTION_SHA256}" -eq 64

psql "$RDL_DATABASE_URL" \
  -X \
  -v ON_ERROR_STOP=1 \
  -v package_key="$PACKAGE_KEY" \
  -v source_content_sha256="$SOURCE_CONTENT_SHA256" \
  -v source_layer_sha256="$SOURCE_LAYER_SHA256" \
  -v normalized_projection_sha256="$NORMALIZED_PROJECTION_SHA256" \
  -f database/sql/backfill_rdl_0412_cfihos_projection_accounting.sql

echo "PASS RDL-041.2 CFIHOS source-projection accounting"
echo "PackageKey=$PACKAGE_KEY"
echo "SourceLayerSha256=$SOURCE_LAYER_SHA256"
echo "NormalizedProjectionSha256=$NORMALIZED_PROJECTION_SHA256"
