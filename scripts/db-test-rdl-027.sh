#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_027_enterprise_identity.sql
