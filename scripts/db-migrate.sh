#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL_VALUE="${RDL_DATABASE_URL:-postgresql://localhost:5432/rdl_explorer}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not available on PATH." >&2
  exit 1
fi

psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/database/bootstrap.sql"

for migration in "$ROOT_DIR"/database/migrations/*.sql; do
  migration_name="$(basename "$migration")"

  # Feed SQL through stdin rather than psql -c. psql variable interpolation
  # (including :'migration_name' safe SQL-literal quoting) is reliably applied
  # to normal input streams, while -c can pass the token through unchanged.
  already_applied="$(
    psql "$DATABASE_URL_VALUE" -X -A -t -v ON_ERROR_STOP=1 \
      -v migration_name="$migration_name" -f - <<'SQL'
SELECT 1
FROM metadata.schema_migrations
WHERE migration_name = :'migration_name';
SQL
  )"

  if [ "$already_applied" = "1" ]; then
    echo "SKIP $migration_name"
    continue
  fi

  echo "APPLY $migration_name"
  psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -1 -f "$migration"

  psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 \
    -v migration_name="$migration_name" -f - <<'SQL'
INSERT INTO metadata.schema_migrations (migration_name)
VALUES (:'migration_name');
SQL
done

echo "RDL Explorer database migrations are up to date."
