#!/usr/bin/env bash
set -euo pipefail

: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
export RDL_DATABASE_URL

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

header() {
  echo
  echo "===== $1 ====="
}

fail() {
  echo "FAIL - $1"
  exit 1
}

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
       JOIN rdl.rdl_entity src ON src.entity_id = rel.source_entity_id
       JOIN rdl.rdl_entity tgt ON tgt.entity_id = rel.target_entity_id
       WHERE rel.package_id=$package_id
       ORDER BY rel.relationship_type_code,
                src.entity_type_code,
                src.native_identifier,
                tgt.entity_type_code,
                tgt.native_identifier;"
  } | shasum -a 256 | awk '{print $1}'
}

header "RDL-043 database migration"
npm run db:migrate

PACKAGE_ID="$(sql_scalar "SELECT p.package_id FROM rdl.rdl_package p JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key='cfihos' AND r.release_key='cfihos-2.0' AND p.package_status='validated' ORDER BY p.package_id DESC LIMIT 1;")"
[ -n "$PACKAGE_ID" ] || fail "validated CFIHOS package not found"

V2_COUNT="$(sql_scalar "SELECT count(*) FROM rdl.rdl_projection_accounting_batch WHERE package_id=$PACKAGE_ID AND adapter_key='cfihos-projection-accounting-v2' AND adapter_version='2.0.0';")"

if [ "$V2_COUNT" = "0" ]; then
  header "RDL-043 normalized projection backfill"
  psql "$RDL_DATABASE_URL" \
    -X \
    -v ON_ERROR_STOP=1 \
    -P pager=off \
    -f database/sql/backfill_rdl_043_normalized_projection.sql

  header "RDL-043 normalized projection fingerprint"
  NORMALIZED_PROJECTION_SHA="$(normalized_projection_fingerprint "$PACKAGE_ID")"
  echo "RDL043NormalizedProjectionSha256=$NORMALIZED_PROJECTION_SHA"
  test "${#NORMALIZED_PROJECTION_SHA}" -eq 64 || fail "normalized projection SHA-256 length is not 64"
  printf '%s\n' "$NORMALIZED_PROJECTION_SHA" | grep -E '^[0-9a-f]{64}$' >/dev/null || fail "normalized projection SHA-256 has invalid format"

  header "RDL-043 projection accounting v2 backfill"
  psql "$RDL_DATABASE_URL" \
    -X \
    -v ON_ERROR_STOP=1 \
    -v rdl043_normalized_projection_sha="$NORMALIZED_PROJECTION_SHA" \
    -P pager=off \
    -f database/sql/backfill_rdl_043_projection_accounting_v2.sql
elif [ "$V2_COUNT" = "1" ]; then
  header "RDL-043 v2 already present"
  echo "PASS - existing single RDL-043 v2 accounting batch found; skipping idempotent backfill"
else
  fail "expected zero or one RDL-043 v2 accounting batch, found $V2_COUNT"
fi

header "RDL-043 dedicated validation"
npx tsx scripts/test-rdl-043-projection-completeness.ts
