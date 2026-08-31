#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "Ingesting CCUS 2.0 Candidate as a new immutable release..."
npx tsx scripts/generate-ccus-v2-ingestion-sql.ts | psql "$RDL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f -
echo "PASS RDL-030 CCUS 2.0 candidate ingestion"
