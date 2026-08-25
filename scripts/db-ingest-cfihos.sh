#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL, for example postgresql://localhost:5432/rdl_explorer}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -t rdl-cfihos-ingest.XXXXXX.sql)"
trap 'rm -f "$TMP"' EXIT
cd "$ROOT"
npx tsx scripts/generate-cfihos-ingestion-sql.ts > "$TMP"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$TMP"
echo "PASS RDL-004 CFIHOS ingestion"
