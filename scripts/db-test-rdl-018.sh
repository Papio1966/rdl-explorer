#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL first}"
psql --no-psqlrc -X -v ON_ERROR_STOP=1 "$RDL_DATABASE_URL" -f database/sql/test_rdl_018_effective_publication.sql
printf '%s\n' 'PASS RDL-018 effective standard comparison and publication'
