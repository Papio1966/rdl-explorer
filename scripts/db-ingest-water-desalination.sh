#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "Ingesting Water / Desalination RDL through generic workbook mapping profile..."
npx tsx scripts/generate-water-desalination-ingestion-sql.ts | psql "$RDL_DATABASE_URL" -f -
echo "PASS RDL-008 Water / Desalination ingestion"
