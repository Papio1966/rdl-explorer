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

## RDL-003 Core RDL domain model requirements

- **RDL-CORE-001 — RDL source** — The database shall represent the publisher/governance source of an RDL independently from entity-level source standards.
- **RDL-CORE-002 — Release identity** — Every RDL release shall belong to exactly one RDL source and have a source-local release key/version.
- **RDL-CORE-003 — Package identity** — Normalized entities shall belong to a version-identified RDL package associated with an exact release.
- **RDL-CORE-004 — Source-aware entity identity** — Entity uniqueness shall include package, entity type/domain and native identifier; native identifiers alone shall not be globally unique.
- **RDL-CORE-005 — First-class relationships** — Relationships shall be stored independently from entity payloads and shall identify both source and target entities explicitly.
- **RDL-CORE-006 — Same-package integrity** — A normalized relationship shall not connect entities from different packages implicitly. Cross-package mapping requires a future explicit mapping construct.
- **RDL-CORE-007 — Provenance** — Entities, relationships and ingestion runs shall retain authoritative/derived status and source-location or adapter metadata sufficient for audit and reproduction.
- **RDL-CORE-008 — Extensible vocabulary** — Entity and relationship types shall use registries that can be extended for future RDLs without forcing them into the exact CFIHOS workbook structure.
- **RDL-CORE-009 — Lifecycle state** — The model shall distinguish active, deprecated, superseded and withdrawn content without deleting historical identity.
- **RDL-CORE-010 — No runtime cutover** — RDL-003 shall not switch the Explorer UI from the proven CFIHOS snapshot repository to PostgreSQL.

## RDL-004 CFIHOS ingestion and parity requirements

- **RDL-CFIHOS-001 — Adapter boundary** — CFIHOS shall be ingested through a versioned adapter from the reviewed snapshot; PostgreSQL shall not become the authoritative source.
- **RDL-CFIHOS-002 — Typed class identity** — Tag Class and Equipment Class identities shall remain distinct even when CFIHOS reuses the same native identifier.
- **RDL-CFIHOS-003 — Reproducible package** — The normalized CFIHOS package shall retain the reviewed snapshot SHA-256 and source URI.
- **RDL-CFIHOS-004 — Core entity parity** — Database verification shall compare normalized identity counts derived from the source rows for tag classes, equipment classes, properties, document types, disciplines, units, source standards, controlled values, handover events and JIP33 information requirements.
- **RDL-CFIHOS-005 — Relationship parity** — Database verification shall compare direct CFIHOS class-property, discipline-document, tag-equipment and controlled-list relationships with the reviewed snapshot.
- **RDL-CFIHOS-006 — Lossless contextual mappings** — Source-standard property mappings that are not safely representable as one binary relationship shall be retained as first-class source-mapping entities with explicit links to their referenced entities.
- **RDL-CFIHOS-007 — Ambiguity preservation** — Where the CFIHOS source sheet does not disambiguate Tag versus Equipment class context, ingestion shall retain that ambiguity rather than silently inventing a single domain.
- **RDL-CFIHOS-008 — Auditability** — Each successful load shall record a completed ingestion run with adapter key/version and source hash.
- **RDL-CFIHOS-009 — Idempotence** — Re-running the adapter against the same package shall replace that normalized package content deterministically rather than creating duplicate entities or relationships.
- **RDL-CFIHOS-010 — No runtime cutover** — RDL-004 shall keep the existing CFIHOS snapshot repositories active until a later sprint explicitly approves database-backed runtime cutover.

## RDL-005 — PostgreSQL Repository Read Parity

- **RDL-READ-001** — A server-side repository shall read normalized RDL content from PostgreSQL without exposing database connectivity to browser code.
- **RDL-READ-002** — Every repository query shall be scoped by RDL source and release, preserving source-aware identity.
- **RDL-READ-003** — Entity lookup shall include entity type so identical native identifiers in different domains remain independently addressable.
- **RDL-READ-004** — The repository shall expose hierarchy and representative relationship reads required by CFIHOS Explorer behaviour.
- **RDL-READ-005** — Repository reads shall retain package SHA and entity source-locator provenance.
- **RDL-READ-006** — A deterministic parity test shall compare PostgreSQL reads with the reviewed CFIHOS snapshot for representative identities, counts, attributes and relationships.
- **RDL-READ-007** — The active browser runtime shall remain snapshot-backed until a later explicit cutover sprint.
- **RDL-READ-008** — PostgreSQL access shall remain behind an application/service boundary so later database drivers or hosted infrastructure can replace the local `psql` adapter without changing RDL semantics.

## RDL-006 — Controlled Repository Cutover

- **RDL-CUT-001** — The default server-side RDL read mode shall remain `snapshot` until an explicit cutover decision is made.
- **RDL-CUT-002** — Supported read modes shall be `snapshot`, `postgresql`, and `dual` only; invalid configuration shall fail explicitly.
- **RDL-CUT-003** — Repository selection shall remain behind a server-side boundary and shall not expose PostgreSQL connectivity to browser code.
- **RDL-CUT-004** — Dual-read mode shall execute snapshot and PostgreSQL reads for the selected operation and compare semantic results deterministically.
- **RDL-CUT-005** — Dual-read mismatch shall fail closed and produce an operation-specific diagnostic rather than silently accepting divergent results.
- **RDL-CUT-006** — Dual-read semantic comparison shall preserve typed entity identity, package provenance, names, definitions, lifecycle state, normalized metadata and source locator provenance while ignoring implementation-only database surrogate IDs.
- **RDL-CUT-007** — RDL-006 shall cover representative reads for hierarchy, direct properties, documents, disciplines, controlled values, JIP33, Tag/Equipment mappings, units, source standards and source/property mappings.
- **RDL-CUT-008** — RDL-006 shall not switch the current browser UI, CIS derivation or Assistant retrieval to PostgreSQL.
- **RDL-CUT-009** — The reviewed CFIHOS snapshot shall remain the regression oracle during controlled cutover.
