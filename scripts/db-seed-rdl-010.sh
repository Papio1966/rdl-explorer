#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
psql --no-psqlrc -X -v ON_ERROR_STOP=1 "$RDL_DATABASE_URL" -f scripts/db-seed-rdl-010.sql
