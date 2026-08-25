#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:=postgresql://localhost:5432/rdl_explorer}"
export RDL_DATABASE_URL
npx tsx scripts/db-test-rdl-005-read-parity.ts
