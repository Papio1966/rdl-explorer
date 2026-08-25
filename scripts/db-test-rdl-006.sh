#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL before running RDL-006 cutover tests}"
npx tsx scripts/db-test-rdl-006-dual-read.ts
