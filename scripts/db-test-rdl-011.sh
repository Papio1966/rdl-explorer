#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql "$RDL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/database/sql/test_rdl_011_governance.sql"
npx tsx scripts/db-test-rdl-011-governance.ts
echo "PASS RDL-011 cross-RDL mapping governance repository"
