#!/usr/bin/env bash
set -euo pipefail

: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL, for example postgresql://localhost:5432/rdl_explorer}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -t rdl-cfihos-source-records.XXXXXX.sql)"

cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT

cd "$ROOT"

./node_modules/.bin/tsx \
  scripts/generate-cfihos-source-record-sql.ts \
  > "$TMP"

psql "$RDL_DATABASE_URL" \
  -X \
  -v ON_ERROR_STOP=1 \
  -f "$TMP"

echo "PASS RDL-041.1 lossless CFIHOS source-record ingestion"
