#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
export RDL_DATABASE_URL
psql --no-psqlrc -X -v ON_ERROR_STOP=1 "$RDL_DATABASE_URL" -f database/sql/test_rdl_045_external_proposal_bundle_contract.sql
printf '%s\n' 'PASS RDL-045 external proposal bundle contract'
