#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
psql --no-psqlrc -X -v ON_ERROR_STOP=1 "$RDL_DATABASE_URL" -f database/sql/test_rdl_044_external_proposal_contract.sql
printf '%s\n' 'PASS RDL-044 external standards proposal database contract'
