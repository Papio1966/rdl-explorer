-- RDL Explorer local database bootstrap.
-- Run this once from DBeaver while connected to another database such as postgres
-- or with psql before running the migration script.
--
-- This script intentionally creates only the database. Schemas and migration
-- history are managed by database/bootstrap.sql and database/migrations/*.sql.

CREATE DATABASE rdl_explorer;
