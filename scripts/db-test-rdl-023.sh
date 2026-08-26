#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL before running db:test:rdl-023}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_023_control_tower.sql
printf '%s\n' 'PASS RDL-023 enterprise standards dashboard and control tower'
