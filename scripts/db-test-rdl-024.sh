#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL must be set}"
psql "$RDL_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_024_work_queue.sql
echo "PASS RDL-024 enterprise notifications and work queue"
