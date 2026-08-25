#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# A second load is intentional: RDL-008 must prove deterministic/idempotent ingestion.
npm run db:ingest:water-desalination >/dev/null
npx tsx scripts/db-test-rdl-008-genericity.ts
