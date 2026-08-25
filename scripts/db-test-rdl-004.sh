#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?Set RDL_DATABASE_URL}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npx tsx scripts/db-test-rdl-004-parity.ts
