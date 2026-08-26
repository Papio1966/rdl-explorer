#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL before running RDL-028 database tests.}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_028_tenant_isolation.sql
echo "PASS RDL-028 tenant organization isolation and enterprise configuration"
