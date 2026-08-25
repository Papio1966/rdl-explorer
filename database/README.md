# RDL Explorer PostgreSQL foundation

RDL-002 introduces the database boundary without moving CFIHOS runtime reads into PostgreSQL.

## Database

Local/default database name: `rdl_explorer`.

Logical schemas:

- `rdl` — normalized RDL domain data (tables are introduced from RDL-003 onward);
- `ingestion` — ingestion/import operational state;
- `metadata` — platform metadata, including migration history.

The authoritative RDL source remains the governed source package/workbook/API. PostgreSQL is an operational normalized repository.

## Local setup with DBeaver

1. Connect to your local PostgreSQL server in DBeaver and enable **Show all databases** in the PostgreSQL connection settings.
2. Open Query Tool against the `postgres` database.
3. Run `database/admin/create_database.sql` once.
4. Set `RDL_DATABASE_URL` in your shell or environment. The example is in `.env.example`.
5. Run `npm run db:migrate`.
6. Run `npm run db:health`.

Example local shell configuration:

```bash
export RDL_DATABASE_URL="postgresql://localhost:5432/rdl_explorer"
```

No credentials belong in Git.

## Migration contract

- `database/bootstrap.sql` creates only the `metadata.schema_migrations` mechanism required by the runner.
- Numbered files under `database/migrations/` are applied in lexical order.
- A migration filename is recorded only after the migration succeeds.
- Applied migrations are never edited in place after merge; create a new migration instead.
- RDL-002 contains schema-boundary infrastructure only. RDL domain tables begin in RDL-003.

## Runtime boundary

The current Explorer continues to use the committed CFIHOS snapshot. The PostgreSQL path is additive in RDL-002 and must not change current user-visible behavior.

## RDL-003 core domain model

After RDL-002 is present, apply the next migration with:

```bash
export RDL_DATABASE_URL="postgresql://localhost:5432/rdl_explorer"
npm run db:migrate
```

RDL-003 creates generic RDL source/release/package, entity, relationship and ingestion-provenance structures. It does **not** load CFIHOS data and does not change the active browser runtime.

Verify the model with a transaction-scoped fixture that rolls itself back:

```bash
npm run db:test:rdl-003
```

The test proves that the same native identifier can coexist across entity domains and RDL sources, that logical identities remain distinct, that typed relationships persist, and that ingestion provenance is recorded.

## RDL-004 — Load the reviewed CFIHOS snapshot

After migrations are current, ingest the reviewed snapshot into the normalized RDL model:

```bash
export RDL_DATABASE_URL="postgresql://localhost:5432/rdl_explorer"
npm run db:migrate
npm run db:ingest:cfihos
npm run db:test:rdl-004
```

The adapter reads `public/cfihos-workbook.json`, creates/updates the CFIHOS source, release and normalized package, replaces the normalized contents of that exact package deterministically, and records an `ingestion.ingestion_run` audit record.

The package retains the snapshot SHA-256 and source URL. PostgreSQL remains an operational normalized representation; the published CFIHOS source package remains authoritative.

RDL-004 does not switch the browser UI to PostgreSQL. The existing CFIHOS snapshot remains the active runtime and the parity reference.

## RDL-005 repository read parity

RDL-005 adds a server-side read implementation over the normalized PostgreSQL model. It deliberately does not connect the browser directly to PostgreSQL and does not switch the active CFIHOS UI repositories.

Run the read-parity gate after RDL-004 ingestion:

```bash
export RDL_DATABASE_URL="postgresql://localhost:5432/rdl_explorer"
npm run db:test:rdl-005
```

The local adapter uses the installed `psql` executable and emits JSON to the server-side repository. This avoids introducing a browser/database dependency while the repository contract is still being proven. A later deployment may replace the adapter with a pooled PostgreSQL driver behind the same repository/service boundary.
