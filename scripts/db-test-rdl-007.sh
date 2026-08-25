#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# A second load is intentional: RDL-007 must prove deterministic/idempotent ingestion.
npm run db:ingest:ccus >/dev/null
npx tsx scripts/db-test-rdl-007-multi-rdl.ts
