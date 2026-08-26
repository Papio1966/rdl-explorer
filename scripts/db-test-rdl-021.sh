#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_021_release_impact.sql
echo "PASS RDL-021 release change intelligence and impact analysis"
