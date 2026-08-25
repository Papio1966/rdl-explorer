#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
npx tsx scripts/db-test-rdl-010-cross-intelligence.ts
