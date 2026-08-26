#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_017_extension_governance.sql
printf '%s\n' 'PASS RDL-017 enterprise extension authoring and governance'
