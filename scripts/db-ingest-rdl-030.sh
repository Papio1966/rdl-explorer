#!/usr/bin/env bash
set -euo pipefail
: "${RDL_DATABASE_URL:?RDL_DATABASE_URL is required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

release_exists() {
  local source_key="$1" release_key="$2"
  psql "$RDL_DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
    -v source_key="$source_key" -v release_key="$release_key" -f - <<'SQL'
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM rdl.rdl_release r
  JOIN rdl.rdl_source s ON s.source_id=r.source_id
  WHERE s.source_key=:'source_key' AND r.release_key=:'release_key'
) THEN 1 ELSE 0 END;
SQL
}

# Preserve historical packages exactly. Only seed a historical release when it
# is absent; never refresh an old release after a successor has been ingested.
if [ "$(release_exists ccus ccus-0.1-draft)" != "1" ]; then npm run db:ingest:ccus; else echo "KEEP CCUS 0.1 historical release"; fi
if [ "$(release_exists water-desalination water-desalination-0.1-draft)" != "1" ]; then npm run db:ingest:water-desalination; else echo "KEEP Water / Desalination 0.1 historical release"; fi

npm run db:ingest:ccus:v2
npm run db:ingest:water-desalination:v2
npm run db:finalize:rdl-030

echo "PASS RDL-030 four-release source set is present"
