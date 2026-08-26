#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${RDL_DATABASE_URL:-postgresql://localhost:5432/rdl_explorer}"
psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/database/sql/test_rdl_016_enterprise_hierarchy.sql"
echo "PASS RDL-016 enterprise RDL hierarchy and extension governance"
