#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run db:migrate
npm run db:ingest:rdl-030
psql "$RDL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f database/sql/test_rdl_030_source_release_versioning.sql
echo "PASS RDL-030 database acceptance"
