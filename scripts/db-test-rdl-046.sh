#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
psql --no-psqlrc -X -v ON_ERROR_STOP=1 "$RDL_DATABASE_URL" -f database/sql/test_rdl_046_proposal_bundle_review_readback.sql
printf '%s\n' 'PASS RDL-046 proposal bundle review/readback database contract'
