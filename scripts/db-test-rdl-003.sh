#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${RDL_DATABASE_URL:-postgresql://localhost:5432/rdl_explorer}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not available on PATH." >&2
  exit 1
fi

psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/database/sql/test_rdl_003_core_model.sql"
