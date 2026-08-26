#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL before running db:test:rdl-022}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_022_migration_adoption.sql
printf '%s\n' 'PASS RDL-022 migration planning and controlled adoption'
