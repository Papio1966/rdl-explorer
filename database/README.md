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

## RDL-006 read-mode validation

After CFIHOS ingestion and RDL-005 parity are present, run:

```bash
export RDL_DATABASE_URL="postgresql://localhost:5432/rdl_explorer"
npm run db:test:rdl-006
```

`RDL_READ_MODE` accepts `snapshot`, `postgresql`, or `dual`. The default is `snapshot`. RDL-006 tests the selector directly and does not change the browser runtime.

## CCUS ingestion (RDL-007)

RDL-007 adds the first additional RDL using a profile-driven ingestion adapter. The supplied workbook is stored at `data/rdl/ccus/CCUS_RDL_Extension_CFIHOS_Format.xlsx`.

```bash
export RDL_DATABASE_URL="postgresql://localhost:5432/rdl_explorer"
npm run db:ingest:ccus
npm run db:test:rdl-007
```

The dedicated test deliberately performs a repeat CCUS load to prove idempotence. It also confirms package-level identity isolation, source SHA provenance, relationship isolation, representative CCUS parity, and that existing CFIHOS counts are unchanged.

## RDL-008 — Water / Desalination genericity proof

RDL-008 requires no database migration. It deliberately reuses the existing generic RDL schema.

With `RDL_DATABASE_URL` set, load and verify the third RDL with:

```bash
npm run db:ingest:water-desalination
npm run db:test:rdl-008
```

The acceptance test performs a second ingestion intentionally to verify deterministic/idempotent package state. It also confirms coexistence with CFIHOS and CCUS and checks that Water-specific header/identifier differences are absorbed by the mapping/ingestion layer rather than by new PostgreSQL tables.

## RDL-010 — Cross-RDL intelligence

RDL-010 adds a governed `rdl.cross_rdl_mapping` table for relationships between entities in different RDL packages. These mappings are deliberately separate from `rdl.rdl_relationship`, which remains the source-authoritative within-package relationship model.

Apply and seed deterministic candidate mappings with:

```bash
npm run db:migrate
npm run db:seed:rdl-010
npm run db:test:rdl-010
```

The initial exact-name rule emits only `possible_match` / `candidate` mappings at 0.85 confidence. Exact-name equality is evidence, not equivalence. Stronger mapping types (`equivalent`, `broader`, `narrower`, `related`, `no_match`) require explicit governance or later reviewed workflows.


## RDL-011 — Mapping governance and audit

After RDL-010 mappings exist, apply and verify the governed review model:

```bash
npm run db:migrate
npm run db:test:rdl-011
npm run generate:rdl-governance
```

`rdl.review_cross_rdl_mapping(...)` is the only supported write path for review status, reviewer, rationale, review version and supersession metadata. `rdl.cross_rdl_mapping_review_event` is append-only. The browser review queue is intentionally read-only until an authenticated server write boundary is deployed.

## RDL-016 enterprise hierarchy

Migration `007_create_enterprise_rdl_hierarchy.sql` adds Company, Asset and Project/CIS contexts, exact package pins, governed extension changes and immutable effective-context publication records. Run `npm run db:migrate` and `npm run db:test:rdl-016`. Active project package pins are intentionally immutable; create a new context/version to adopt a newer upstream standard.

### Migration 008 — RDL-017 enterprise extension authoring
Adds extension draft/review lifecycle fields, append-only review events, optimistic governance transitions, conflict detection and extension governance queue view. Run `npm run db:migrate` then `npm run db:test:rdl-017`.

### RDL-018 effective publication

Migration `009_create_effective_standard_publication.sql` adds immutable `rdl.effective_standard_release` records. Each release stores its comparison summary, exact package manifest, machine-consumable payload, publisher identity and SHA-256 composition fingerprint. Run `npm run db:test:rdl-018` after migration to validate immutability and release-summary behavior.

### RDL-019 distribution model

Migration `010_create_published_package_distribution.sql` adds consumer-facing lifecycle and compatibility metadata for immutable effective-standard releases. Run `npm run db:test:rdl-019` after migration. The distribution API must be used by downstream systems; internal RDL tables are not a supported integration contract.

### RDL-020 consumer integration
Migration `011_create_consumer_integration_notification.sql` adds consumer subscriptions, release notification/outbox records, explicit consumer release state and idempotent pull receipts. Run `npm run db:test:rdl-020` after migration.

### RDL-021 release impact

Migration `012_create_release_change_intelligence.sql` adds immutable release-to-release impact analysis records. Run `npm run db:test:rdl-021` after migration.

## RDL-022 migration planning

Migration `013_create_migration_planning_controlled_adoption.sql` adds governed release migration plans, remediation actions and append-only history. Run `npm run db:test:rdl-022` after migration to verify approval/readiness/staging/activation gates.

### RDL-023 control tower projections

Migration `014_create_enterprise_standards_control_tower.sql` adds read-only operational views over existing governed state:

- `rdl.enterprise_standards_control_tower_kpi`
- `rdl.enterprise_standards_governance_queue`
- `rdl.enterprise_standards_release_health`
- `rdl.enterprise_standards_adoption_summary`

The migration deliberately creates no new mutable dashboard tables. `npm run db:test:rdl-023` is data-independent and can run when the database contains zero business records.

### RDL-024 enterprise notifications and work queue

Migration `015_create_enterprise_notifications_work_queue.sql` adds durable operational work items, append-only work-item events, optimistic transition/assignment/reminder functions, and the `rdl.enterprise_work_queue_summary` SLA/aging view. It does not change the authoritative governance lifecycle tables.

Run after migration:

```bash
npm run db:test:rdl-024
```

The acceptance test is self-contained: it creates its fixture inside a transaction and ends with `ROLLBACK`, so it does not require any pre-existing enterprise standards business data.
