#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "Ingesting CCUS RDL through CFIHOS-format mapping profile..."
npx tsx scripts/generate-ccus-ingestion-sql.ts | psql "$RDL_DATABASE_URL" -f -
echo "PASS RDL-007 CCUS ingestion"
