#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL_VALUE="${RDL_DATABASE_URL:-postgresql://localhost:5432/rdl_explorer}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not available on PATH." >&2
  echo "Install/configure PostgreSQL client tools before running the database health check." >&2
  exit 1
fi

echo "RDL Explorer database health check"
echo "Connection: ${DATABASE_URL_VALUE%%\?*}"

psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database() AS database_name,
       current_user AS database_user,
       current_setting('server_version') AS postgres_version;

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('rdl', 'ingestion', 'metadata')
ORDER BY schema_name;

SELECT migration_name, applied_at
FROM metadata.schema_migrations
ORDER BY migration_name;
SQL
