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

## RDL-007 — First additional RDL

- **RDL-MR-001** The platform shall ingest CCUS as an independent RDL source, release, and immutable normalized package without altering the CFIHOS package.
- **RDL-MR-002** Source-specific workbook columns shall be translated by a mapping profile before canonical ingestion logic; the PostgreSQL domain model shall not depend on CCUS workbook headers.
- **RDL-MR-003** Package provenance shall retain the exact CCUS workbook SHA-256 and source locator.
- **RDL-MR-004** Native identifiers shall remain package- and entity-type-aware so identifiers reused between CFIHOS and CCUS do not collide.
- **RDL-MR-005** CCUS entity and relationship ingestion shall be deterministic and idempotent.
- **RDL-MR-006** Authoritative relationships shall remain within their source package; cross-RDL mappings shall require an explicit future mapping model.
- **RDL-MR-007** Existing CFIHOS parity and controlled repository-cutover behaviour shall remain unchanged.
- **RDL-MR-008** RDL-007 shall not introduce browser multi-RDL selection; ingestion/coexistence must be proven before user-facing multi-RDL UX.

## RDL-008 — Water / Desalination genericity proof

- **RDL-GEN-001 — Structurally different source** — Water / Desalination shall be ingested as an independent source/release/package using its supplied workbook vocabulary rather than requiring CFIHOS header names.
- **RDL-GEN-002 — Mapping-layer normalization** — Source-specific sheet/header differences shall be resolved in a versioned mapping profile and generic ingestion layer, not in PostgreSQL tables or repository SQL.
- **RDL-GEN-003 — Identifier-gap handling** — Where the workbook does not provide a source-native identifier for a normalized first-class object, ingestion shall create a deterministic canonical identifier while retaining exact row/profile provenance.
- **RDL-GEN-004 — Generic hierarchy mapping** — Ingestion shall support source hierarchy expressed by parent identifiers as well as parent names without introducing source-specific relationship tables.
- **RDL-GEN-005 — Three-RDL coexistence** — CFIHOS, CCUS and Water / Desalination shall remain independently addressable in the same generic repository.
- **RDL-GEN-006 — Package isolation** — Water / Desalination authoritative relationships shall remain within the Water package; cross-RDL mapping requires a future explicit mapping model.
- **RDL-GEN-007 — Prior baseline protection** — Water ingestion shall not alter established CFIHOS counts, CCUS package provenance or controlled repository-cutover behaviour.
- **RDL-GEN-008 — Idempotence and provenance** — Re-ingesting the same Water workbook shall produce one deterministic package state with exact workbook SHA and current ingestion audit record.
- **RDL-GEN-009 — No multi-RDL browser cutover** — RDL-008 shall prove backend genericity before RDL-009 introduces user-facing multi-RDL navigation and global search.


## RDL-009 — Multi-RDL UX and global search

- **RDL-UX-001 — RDL scope** — Users shall be able to select All RDLs, CFIHOS, CCUS or Water / Desalination as the active global-search scope.
- **RDL-UX-002 — Searchable packages** — Global search shall cover the loaded normalized entity population across the three proven source/release/package trees.
- **RDL-UX-003 — Typed result identity** — Search-result identity shall include source/package, entity type and native/canonical identifier so duplicate identifiers cannot collapse.
- **RDL-UX-004 — Visible provenance** — Every cross-RDL result and generic entity view shall display source and release provenance.
- **RDL-UX-005 — Safe navigation** — Cross-RDL result routes shall encode source, entity type and identifier.
- **RDL-UX-006 — Source status** — Candidate CCUS and Water / Desalination extensions shall remain visually distinguishable from the reviewed CFIHOS baseline.
- **RDL-UX-007 — Database search contract** — A server-side PostgreSQL search repository shall prove source-aware and typed search against the normalized RDL model.
- **RDL-UX-008 — Browser-safe projection** — Until hosted PostgreSQL connectivity is introduced, the browser search index shall be a deterministic generated projection of the same governed source packages and shall contain no database credentials.
- **RDL-UX-009 — Specialist-view continuity** — RDL-009 shall not remove the existing deep CFIHOS browse/detail pages, CIS behaviour or Assistant retrieval.
- **RDL-UX-010 — No semantic equivalence yet** — Global search shall find and navigate entities but shall not infer cross-RDL equivalence, overlap, conflict or gap semantics; those belong to RDL-010.

## RDL-010 — Cross-RDL Intelligence

- **RDL-XINT-001** Cross-RDL mappings SHALL be stored separately from source-authoritative within-package relationships.
- **RDL-XINT-002** Every cross-RDL mapping SHALL retain mapping type, provenance method, confidence, lifecycle status and evidence.
- **RDL-XINT-003** Automatic exact-name rules SHALL create only candidate `possible_match` mappings and SHALL NOT assert equivalence.
- **RDL-XINT-004** Cross-RDL mappings SHALL connect entities from different RDL sources/packages only.
- **RDL-XINT-005** The platform SHALL support mapping types `equivalent`, `broader`, `narrower`, `related`, `possible_match` and `no_match`.
- **RDL-XINT-006** The browser SHALL expose deterministic comparison, overlap/gap indicators and candidate mappings without requiring database credentials.
- **RDL-XINT-007** Comparison SHALL retain source, release, entity type and native identifier provenance for both sides.
- **RDL-XINT-008** Structural overlap/gap counts SHALL be labelled as coverage indicators, not semantic completeness claims.
- **RDL-XINT-009** AI-suggested mappings MAY be added later but SHALL remain distinguishable from manual and rule-derived mappings and require governance before approval.
- **RDL-XINT-010** Existing CFIHOS, CCUS and Water / Desalination source content and authoritative relationships SHALL remain unchanged by cross-RDL intelligence generation.


## RDL-011 — Cross-RDL Mapping Governance & Review

- **RDL-GOV-001 — Governed transitions** — Candidate mappings may be approved or rejected only through a governed database review function; approved mappings may be superseded/retired only through the same boundary.
- **RDL-GOV-002 — Reviewer identity** — Every review decision shall record a non-empty reviewer identity.
- **RDL-GOV-003 — Rationale** — Every review decision shall record a non-empty rationale.
- **RDL-GOV-004 — Audit history** — Review events shall be append-only and retain from/to status, reviewer, rationale, evidence, version and timestamp.
- **RDL-GOV-005 — Optimistic concurrency** — Review writes shall support expected-version checks and reject stale decisions.
- **RDL-GOV-006 — Supersession traceability** — A superseded approved mapping shall reference a distinct successor mapping.
- **RDL-GOV-007 — Direct-update protection** — Review-state fields shall not be directly mutable outside the governed review function.
- **RDL-GOV-008 — Server-side writes** — Browser code shall not receive PostgreSQL credentials or directly mutate mapping governance state.
- **RDL-GOV-009 — Honest pilot UX** — Until an authenticated deployable write service exists, the browser review queue shall be read-only and shall not imply that disabled review actions are persisted.
- **RDL-GOV-010 — AI remains candidate-only** — Future AI-suggested mappings shall enter the same candidate review workflow and shall not bypass human/governed approval.

## RDL-012 — Authenticated Governance Service Boundary

- **RDL-AUTH-001 — Server-only identity trust** — Mapping review writes shall derive reviewer identity from a server-verified authentication assertion and shall never trust reviewer identity supplied in the browser request body.
- **RDL-AUTH-002 — Signed assertion** — Reviewer, roles and assertion timestamp shall be integrity-protected using a server-side signing secret shared only with the trusted upstream identity gateway/BFF.
- **RDL-AUTH-003 — Replay window** — Signed governance identity assertions shall have a bounded freshness window and stale assertions shall be rejected.
- **RDL-AUTH-004 — Reviewer authorization** — A review write shall require the `rdl-mapping-reviewer` role.
- **RDL-AUTH-005 — No browser secrets** — The browser shall receive neither the governance signing secret nor PostgreSQL credentials.
- **RDL-AUTH-006 — Governed service path** — Approve, reject and supersede actions shall flow through `GovernanceService` and `CrossRdlGovernanceRepository` to `rdl.review_cross_rdl_mapping(...)`.
- **RDL-AUTH-007 — Optimistic concurrency** — Review requests shall carry the mapping review version and stale versions shall continue to fail at the governed database boundary.
- **RDL-AUTH-008 — Graceful unauthenticated mode** — Without a trusted reviewer session, the browser shall remain read-only and shall not imply that governance decisions can be persisted.
- **RDL-AUTH-009 — Live authenticated queue** — Authenticated reviewers shall be able to load live repository-backed review items rather than relying on the static pilot projection.
- **RDL-AUTH-010 — Gateway header hygiene** — Production deployment shall strip client-supplied governance identity headers before adding the trusted signed identity assertion.

## RDL-013 — Production Server Runtime & PostgreSQL Driver

- **RDL-RUNTIME-001** — Production API code shall use a managed Node PostgreSQL connection pool rather than spawning the `psql` CLI for each request.
- **RDL-RUNTIME-002** — PostgreSQL connection details and pool configuration shall remain server-only and shall never be exposed to browser code.
- **RDL-RUNTIME-003** — The runtime shall expose separate liveness and database-backed readiness checks.
- **RDL-RUNTIME-004** — The database client shall provide deterministic close/shutdown behavior and pool telemetry suitable for operational diagnostics.
- **RDL-RUNTIME-005** — Repository failures shall be surfaced through a structured server-side database error boundary without leaking credentials or raw connection strings to clients.
- **RDL-RUNTIME-006** — The runtime shall support explicit transaction boundaries for future multi-step governed operations.
- **RDL-RUNTIME-007** — Existing RDL repository contracts and RDL-012 governance API semantics shall remain unchanged when the database adapter changes.
- **RDL-RUNTIME-008** — Local CLI `psql` tooling may remain for migrations and historical parity tests, but production request handling shall not depend on spawning `psql`.
- **RDL-RUNTIME-009** — TLS behavior, pool size, idle timeout and connection timeout shall be deployment-configurable through server environment variables with safe local defaults.
- **RDL-RUNTIME-010** — A database-backed integration test shall verify connectivity to the existing `rdl_explorer` schema without mutating governed data.

## RDL-014 — Production Deployment & Runtime Hardening

- **RDL-OPS-001 — Correlation identity** — Hardened API responses shall expose a safe `X-Request-ID`; a valid trusted incoming request ID may be preserved and unsafe/missing values shall be replaced with a generated identifier.
- **RDL-OPS-002 — Structured logging** — Production API operations shall emit structured request events containing correlation, route, method, duration and status without logging secrets, credentials or signed governance material.
- **RDL-OPS-003 — Fail-closed production configuration** — Production readiness/governance operations shall reject missing localhost-default database configuration and insufficient governance signing secrets.
- **RDL-OPS-004 — Defensive governance rate limit** — Authenticated governance endpoints shall apply a configurable per-runtime reviewer rate limit and return HTTP 429 with `Retry-After` when exceeded.
- **RDL-OPS-005 — Distributed control boundary** — Documentation shall state that the in-memory limiter is not a substitute for distributed gateway/WAF rate limiting in horizontally scaled/serverless production.
- **RDL-OPS-006 — Liveness/readiness separation** — Liveness shall remain independent of PostgreSQL while readiness shall validate production runtime configuration and database connectivity.
- **RDL-OPS-007 — Graceful pool closure** — Long-lived Node runtime deployments shall have an explicit shutdown hook capable of draining the PostgreSQL pool.
- **RDL-OPS-008 — Secret boundary** — Database URLs, governance signing secrets and provider API keys shall remain server-side and shall not be returned in operational responses or structured logs.

## RDL-015 — Deployment Automation & Observability

- **RDL-DEPLOY-001 — Immutable release metadata** — A deployed runtime shall expose non-secret release, commit, version and environment metadata through a dedicated version endpoint when supplied by the deployment pipeline.
- **RDL-DEPLOY-002 — Platform-neutral package** — CI shall create a deployment archive containing the built browser application, API/server runtime sources, locked package metadata and a platform-neutral runtime manifest.
- **RDL-DEPLOY-003 — Deployment smoke contract** — A post-deployment smoke test shall verify liveness, readiness, version metadata, correlation IDs and fail-closed unauthenticated governance behavior.
- **RDL-DEPLOY-004 — Operational metrics** — The runtime shall collect request count, error count, status distribution and latency aggregates without recording governance payloads or secrets.
- **RDL-DEPLOY-005 — Distributed observability boundary** — Process-local metrics shall be labelled as diagnostic only; horizontally scaled/serverless production shall aggregate telemetry through the hosting platform or an external observability backend.
- **RDL-DEPLOY-006 — Environment promotion** — Deployment documentation shall define Development, Preview/UAT and Production promotion with a preference for promoting the same immutable accepted artifact rather than rebuilding source between environments.
- **RDL-DEPLOY-007 — Rollback runbook** — Operations documentation shall define rollback to the previous known-good release and require smoke verification after rollback.
- **RDL-DEPLOY-008 — CI deployment gate** — Pull-request/main CI shall execute the RDL-015 contract and produce the deployment artifact only after build validation succeeds.
- **RDL-DEPLOY-009 — No domain-semantic change** — Deployment automation and observability shall not alter RDL identity, governance transitions, reviewer authorization or browser/database security boundaries.
- **RDL-DEPLOY-010 — Build metadata secrecy** — Version/metrics endpoints shall expose operational metadata only and shall never return database credentials, signing secrets or identity assertions.

## RDL-016 — Enterprise RDL Hierarchy & Extension Governance

- **RDL-HIER-001 — Explicit four-layer model** — The enterprise model shall distinguish Industry RDL, Company RDL, Asset RDL and Project/CIS RDL contexts rather than flattening them into one mutable standard.
- **RDL-HIER-002 — Parent chain** — Company contexts shall be roots; Asset contexts shall have a Company parent; Project contexts shall have an Asset parent.
- **RDL-HIER-003 — Upstream immutability** — Company, Asset and Project extensions shall reference exact upstream packages and shall not mutate source-authoritative Industry RDL content.
- **RDL-HIER-004 — Exact package pinning** — A governed context shall retain exact package identifiers and precedence for every composed layer.
- **RDL-HIER-005 — Frozen active projects** — Package pins for an active Project/CIS context shall be immutable; upstream standard changes shall require a new context/version rather than automatic migration.
- **RDL-HIER-006 — Explicit extension changes** — Adds, overrides and retirements shall be first-class governed records retaining layer, entity identity, rationale and provenance.
- **RDL-HIER-007 — Effective publication** — A published effective context shall record an immutable package reference, composition manifest and SHA-256 for downstream reproducibility.
- **RDL-HIER-008 — Promotion without rewrite** — A Project extension may later be promoted to Asset, Company or upstream governance, but promotion shall create a new governed version and shall not rewrite the frozen project baseline.
- **RDL-HIER-009 — Provenance in UX** — The hierarchy UX shall explain the origin and governance status of every layer and shall label demonstration enterprise layers honestly.
- **RDL-HIER-010 — DataGate boundary** — Effective packages shall be suitable for later publication to DataGate without direct database coupling; RDL Explorer remains the standards publisher and DataGate remains the consumer.

### RDL-017 Enterprise extension authoring and governance
- **RDL-EXT-001** Company, Asset and Project/CIS extensions SHALL be authored as explicit records and SHALL NOT mutate upstream RDL packages.
- **RDL-EXT-002** Extension lifecycle SHALL support draft/in-review/approved/rejected/retired states with append-only review events.
- **RDL-EXT-003** Governance decisions SHALL capture trusted reviewer identity, rationale, timestamp and optimistic review version.
- **RDL-EXT-004** Approval SHALL fail when unresolved same-identity extension conflicts exist in the applicable context lineage.
- **RDL-EXT-005** Users SHALL be able to preview inherited and proposed effective state before publication.
- **RDL-EXT-006** Live extension writes SHALL require the signed `rdl-extension-reviewer` role; unauthenticated browser use SHALL remain read-only.
- **RDL-EXT-007** Promotion SHALL create a new governed extension at the target layer and SHALL NOT rewrite a frozen Project/CIS baseline.

## RDL-018 — Effective Standard Comparison & Publication

- **RDL-PUB-001** — The platform shall compare a governed enterprise context with its inherited baseline before publication.
- **RDL-PUB-002** — Comparison shall distinguish added, overridden and retired extension effects and retain source-layer provenance.
- **RDL-PUB-003** — Publication shall fail closed while unresolved draft, candidate or in-review extensions exist in the context lineage.
- **RDL-PUB-004** — A published effective standard shall contain exact context lineage, package pins and governed extension identifiers.
- **RDL-PUB-005** — Published effective-standard artifacts shall be immutable.
- **RDL-PUB-006** — Each publication shall have a release key, release version and SHA-256 composition fingerprint.
- **RDL-PUB-007** — The platform shall provide a machine-consumable JSON publication artifact with explicit schema version.
- **RDL-PUB-008** — Publication authority shall be derived only from the trusted signed governance identity boundary.
- **RDL-PUB-009** — Browser publication UX shall remain read-only when the publication API is unavailable, unauthorized, malformed or replaced by an SPA fallback response.
- **RDL-PUB-010** — Publication provenance shall be sufficient to reproduce and verify the effective standard without modifying upstream RDL packages or frozen project baselines.

## RDL-019 — Published package distribution requirements

- **RDL-DIST-001 — Stable consumer contract** — Published effective standards shall be exposed through a versioned distribution contract independent from internal database tables.
- **RDL-DIST-002 — Release catalogue** — Consumers shall be able to discover exact immutable release identifiers, versions, lifecycle status and compatibility metadata.
- **RDL-DIST-003 — Release pinning** — Consumers shall pin an explicit release; the platform shall not silently redirect a pinned consumer to “latest”.
- **RDL-DIST-004 — Manifest and entities** — A consumer shall be able to retrieve the package manifest and effective entities for an exact release.
- **RDL-DIST-005 — Integrity** — Distributed packages shall expose SHA-256-based integrity metadata and cache-safe ETag values.
- **RDL-DIST-006 — Lifecycle metadata** — Deprecation and supersession shall be represented separately from immutable release content; supersession shall identify an explicit replacement release.
- **RDL-DIST-007 — Consumer authorization** — Live distribution APIs shall fail closed without a trusted `rdl-package-consumer` identity.
- **RDL-DIST-008 — No direct SQL coupling** — DataGate and other consumers shall use the distribution contract rather than RDL Explorer database tables.

## RDL-020 — Consumer integration and change notification requirements

- **RDL-INT-001 — Notify then pull** — Publishing an immutable release shall create a consumer notification without transferring mutable authoring state.
- **RDL-INT-002 — Subscription scope** — Consumers shall subscribe to all or selected enterprise contexts through a versioned consumer-integration contract.
- **RDL-INT-003 — Explicit acknowledgement** — Consumers shall be able to acknowledge release discovery independently from package activation.
- **RDL-INT-004 — Idempotent pull/stage** — Consumer staging shall use a stable request key so retries do not duplicate pull receipts or silently select another release.
- **RDL-INT-005 — Integrity before activation** — Staging shall record the package SHA-256 associated with the exact release.
- **RDL-INT-006 — No auto-activation** — A release shall be staged before activation; publication or notification shall never auto-activate a consumer.
- **RDL-INT-007 — Lifecycle notifications** — Published, deprecated and superseded lifecycle events shall be represented explicitly and idempotently.
- **RDL-INT-008 — DataGate boundary** — DataGate shall consume through the notification/distribution contracts with no direct SQL coupling.

## RDL-021 — Release change intelligence and impact analysis requirements

- **RDL-IMPACT-001 — Exact release comparison** — Impact analysis shall compare two explicit immutable published release identifiers and shall never substitute “latest”.
- **RDL-IMPACT-002 — Semantic delta** — Analysis shall classify effective entities as added, removed, modified or unchanged.
- **RDL-IMPACT-003 — Compatibility signal** — Removed or materially modified governed entities shall be identifiable as potentially breaking; classification is advisory rather than automatic migration authority.
- **RDL-IMPACT-004 — Provenance** — Delta items shall retain entity identity, source layer and governed rationale where available.
- **RDL-IMPACT-005 — Consumer impact** — Analysis shall report discovered, staged, activated and rejected consumers pinned to the source release.
- **RDL-IMPACT-006 — Frozen consumers** — Analysis shall never auto-migrate or auto-activate a project or consumer.
- **RDL-IMPACT-007 — Release notes** — The platform shall derive machine-readable release notes from the exact computed delta.
- **RDL-IMPACT-008 — Immutable analysis** — Persisted release analyses shall be immutable and fingerprinted with SHA-256.
- **RDL-IMPACT-009 — Fail-closed browser** — Live impact APIs shall require a trusted package-consumer identity; malformed or SPA fallback responses shall leave the browser in read-only demonstration mode.
- **RDL-IMPACT-010 — Machine contract** — Release analysis shall expose the versioned `rdl-release-impact/v1` contract for downstream decision support.

## RDL-022 — Migration planning and controlled adoption requirements

- **RDL-MIG-001** — A migration plan shall identify an exact source release, target release, project/consumer subject, owner and rationale.
- **RDL-MIG-002** — Impacted entities shall be translated into explicit remediation checklist actions with owner, due date, status and evidence.
- **RDL-MIG-003** — Migration lifecycle shall be governed as draft → in review → approved → staged → activated, with rejected/cancelled terminal alternatives.
- **RDL-MIG-004** — Staging shall be blocked until approval is recorded, readiness is `ready`, and all actions are completed or explicitly waived.
- **RDL-MIG-005** — Activation shall be impossible before staging and shall require a trusted migration approver.
- **RDL-MIG-006** — Migration transitions shall use optimistic version checks and append-only audit history.
- **RDL-MIG-007** — Browser behavior shall fail closed on unavailable, unauthorized, malformed or non-JSON session responses.
- **RDL-MIG-008** — Impact analysis remains advisory; RDL Explorer shall never auto-migrate a pinned project or auto-activate a downstream consumer.
