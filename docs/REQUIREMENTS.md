# RDL Explorer Requirements

## 1. Product requirements

### RDL-PROD-001 — Separate product
RDL Explorer shall be maintained as a product/repository separate from the free CFIHOS Explorer utility.

### RDL-PROD-002 — CFIHOS reference implementation
CFIHOS 2.0 shall remain the initial RDL and regression reference implementation while the generic architecture is introduced.

### RDL-PROD-003 — Preserve proven UX
The inherited CFIHOS browsing, validation, CIS, Assistant, accessibility and navigation capabilities shall continue to operate during bootstrap and migration unless explicitly changed by an approved sprint.

## 2. RDL model requirements

### RDL-MODEL-001 — Source identity
The platform shall represent an RDL source independently from workbook-level Source Standards.

### RDL-MODEL-002 — Releases
The platform shall represent releases/versions of an RDL source explicitly.

### RDL-MODEL-003 — Packages
The platform shall support immutable or version-identified RDL packages suitable for ingestion, publication and downstream consumption.

### RDL-MODEL-004 — Provenance
Every normalized entity and relationship shall retain source and release provenance sufficient to trace it back to authoritative content.

### RDL-MODEL-005 — Identity
The platform shall not assume that a native source identifier is globally unique across RDLs, releases or entity domains.

### RDL-MODEL-006 — Optional entity families
The normalized model shall allow an RDL to omit entity families it does not define rather than forcing every RDL into the exact CFIHOS workbook shape.

## 3. Persistence requirements

### RDL-DATA-001 — PostgreSQL
RDL Explorer shall use PostgreSQL as its normalized operational repository in the target architecture.

### RDL-DATA-002 — Source remains authoritative
Database persistence shall not replace or silently redefine the authoritative source package.

### RDL-DATA-003 — Reproducible ingestion
Ingestion shall retain package/release identity and metadata needed to reproduce and audit the normalized representation.

### RDL-DATA-004 — Migration discipline
Database schema evolution shall use version-controlled migrations.

## 4. Layering and governance requirements

### RDL-GOV-001 — Layer model
The architecture shall support Industry, Company, Asset and Project RDL layers.

### RDL-GOV-002 — Non-destructive extensions
Extensions shall not mutate the authoritative lower-level baseline in place.

### RDL-GOV-003 — Effective context
A project shall eventually be able to reference an immutable effective RDL context composed from exact source/release/layer versions.

### RDL-GOV-004 — Lifecycle stability
Existing assets/projects shall be able to remain pinned to the standard context under which they were governed while later work uses newer releases.

## 5. DataGate integration requirements

### RDL-DG-001 — Loose coupling
DataGate shall not depend on direct SQL access to RDL Explorer internal tables.

### RDL-DG-002 — Package/API contract
RDL Explorer shall expose governed/versioned content through an API and/or immutable package contract suitable for DataGate import.

### RDL-DG-003 — DataGate activation
DataGate shall control when a discovered/pulled package is reviewed and activated as a project baseline.

### RDL-DG-004 — Traceability
The future integration shall support traceability from DataGate findings back to the originating effective requirement and RDL provenance.

## 6. Quality requirements

### RDL-QUAL-001 — Regression
Each sprint shall preserve the deterministic regression and production-build gates unless an approved change updates the expected behavior.

### RDL-QUAL-002 — Browser E2E/accessibility
Browser E2E and serious/critical accessibility checks remain required before merge.

### RDL-QUAL-003 — CFIHOS parity
Before PostgreSQL becomes the default CFIHOS repository, agreed parity tests shall compare database-backed results against the proven CFIHOS Explorer/reference behavior.

## 7. RDL-001 acceptance criteria

RDL-001 is complete when:

1. the application is visibly identified as RDL Explorer;
2. CFIHOS 2.0 remains the sole active RDL and current behavior is preserved;
3. product boundary, target architecture, roadmap and requirements are versioned in the repository;
4. no PostgreSQL runtime dependency or second RDL has been introduced;
5. regression, build and browser CI remain green.

## RDL-002 PostgreSQL foundation requirements

- **RDL-DB-001** — RDL Explorer shall use a logically separate PostgreSQL database named `rdl_explorer`.
- **RDL-DB-002** — The initial logical schema boundaries shall be `rdl`, `ingestion` and `metadata`.
- **RDL-DB-003** — Database changes shall be applied through ordered, auditable migrations recorded in `metadata.schema_migrations`.
- **RDL-DB-004** — Database credentials shall be provided through environment configuration and shall not be committed to source control.
- **RDL-DB-005** — RDL-002 shall provide a repeatable local database health check.
- **RDL-DB-006** — Introducing PostgreSQL shall not change the active CFIHOS snapshot runtime until parity is explicitly demonstrated.
- **RDL-DB-007** — The application shall depend on an RDL repository abstraction rather than coupling user-interface components directly to SQL.
- **RDL-DB-008** — DataGate shall not consume RDL Explorer internal database tables directly.
