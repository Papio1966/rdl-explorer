-- Bootstrap objects required before numbered migrations can run.
CREATE SCHEMA IF NOT EXISTS metadata;

CREATE TABLE IF NOT EXISTS metadata.schema_migrations (
    migration_name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);
