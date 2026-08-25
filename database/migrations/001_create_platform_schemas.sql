-- RDL-002: establish logical schema boundaries only.
-- Domain tables are intentionally deferred to RDL-003.
CREATE SCHEMA IF NOT EXISTS rdl;
CREATE SCHEMA IF NOT EXISTS ingestion;
CREATE SCHEMA IF NOT EXISTS metadata;
