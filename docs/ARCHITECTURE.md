# RDL Explorer Target Architecture

## 1. Architectural intent

RDL Explorer evolves the proven CFIHOS Explorer experience into a provenance-aware, multi-RDL engineering-information platform.

RDL-001 established the target architecture. RDL-002 adds the PostgreSQL infrastructure boundary without changing the inherited runtime data path.

## 2. Authority and persistence

The authoritative standard remains the published source package, workbook or governed external API. PostgreSQL is a normalized operational representation, not the authority.

```text
Authoritative RDL Sources
CFIHOS | Hydrogen | CCUS | future RDLs
              |
              v
        Ingestion adapters
              |
       validate + normalize
              |
              v
   PostgreSQL RDL Repository
              |
        service/API layer
              |
              v
         RDL Explorer
```

Each ingestion must preserve enough metadata to identify and reproduce the source: source, release, package identity, checksum/hash where appropriate, ingestion timestamp, validation outcome and provenance.

## 3. Core domain concepts

The generic model will be introduced incrementally around these concepts:

```text
RdlSource
   |
   +-- RdlRelease
          |
          +-- RdlPackage
```

Normalized entities will include classes, properties, document types, controlled values, units, source standards and other reference entities where supported by the originating RDL.

Relationships are first-class records rather than implicit joins hidden inside individual screens.

## 4. Entity identity

A native identifier alone must not be assumed to be globally unique.

Logical identity must include at least:

- RDL source;
- release/package context;
- entity type/domain;
- native source identifier.

For example, the logical identity of a CFIHOS entity is conceptually closer to:

```text
CFIHOS : 2.0 : TagClass : CFIHOS-30000521
```

than simply `CFIHOS-30000521`.

## 5. Provenance

Every normalized entity and relationship must be able to answer:

- Which RDL introduced this?
- Which release/package?
- What was the native identifier?
- Is it authoritative, normalized, derived or explanatory?
- Has it been extended by another governed layer?

The UI must never make AI-generated explanation or normalized presentation indistinguishable from authoritative source content.

## 6. RDL layering

The long-term model supports explicit composition:

```text
L1 Industry RDL
CFIHOS / Hydrogen / CCUS
        |
        v
L2 Company RDL
        |
        v
L3 Asset RDL
        |
        v
L4 Project RDL / CIS
```

Extensions reference and extend their baseline. They do not silently modify the underlying authoritative package.

An effective project context is a governed composition of exact versions and extensions and can be published as an immutable effective RDL package.

## 7. DataGate boundary

RDL Explorer publishes standards and effective requirement packages. DataGate consumes them.

```text
RDL Explorer
     |
     | publish immutable package/API
     v
DataGate staging/import
     |
     | review / activate
     v
Project standard baseline
     |
     v
Validation and findings
```

DataGate must not query RDL Explorer internal database tables directly.

Preferred integration principle: **push notification, pull content**. RDL Explorer may announce availability; DataGate explicitly discovers, pulls, validates and activates the package it needs.

## 8. Database boundary

RDL Explorer and DataGate should have separate logical databases even if they eventually share PostgreSQL infrastructure.

Target separation:

```text
PostgreSQL infrastructure
  |
  +-- rdl_explorer
  |     +-- rdl
  |     +-- ingestion
  |     +-- metadata
  |
  +-- datagate
        +-- its own schemas and lifecycle
```

## 9. Transitional architecture

Until database parity is proven, the inherited CFIHOS workbook-snapshot repository remains available.

During migration, RDL Explorer should support parity testing between:

```text
CFIHOS snapshot repository
          vs
PostgreSQL-backed CFIHOS package
```

The database path becomes authoritative for RDL Explorer only after reproducible parity is demonstrated for agreed reference cases and regression tests.

## 10. RDL-002 PostgreSQL foundation

RDL-002 creates the initial database and migration boundary while deliberately deferring RDL domain tables to RDL-003.

```text
rdl_explorer
  |
  +-- rdl        future normalized RDL domain
  +-- ingestion  import/process operational state
  +-- metadata   migration and platform metadata
```

The repository contains a database bootstrap script, ordered SQL migrations, a migration runner, a local database health check, environment configuration guidance, and application/server interfaces that define the future repository boundary.

The current CFIHOS snapshot remains the active repository. No UI route, Assistant behavior or CIS behavior is switched to PostgreSQL in RDL-002.

## 11. RDL-003 core relational model

RDL-003 materializes the generic RDL identity model in PostgreSQL without loading CFIHOS content yet.

```text
rdl.rdl_source
      |
      +-- rdl.rdl_release
              |
              +-- rdl.rdl_package
                      |
                      +-- rdl.rdl_entity
                      |       |
                      |       +-- typed by rdl.entity_type
                      |
                      +-- rdl.rdl_relationship
                              |
                              +-- typed by rdl.relationship_type

rdl.rdl_package
      |
      +-- ingestion.ingestion_run
```

### Identity rule

The normalized identity is deliberately composite in meaning:

```text
source : release : entity-type : native-identifier
```

`rdl.entity_identity` exposes that resolved identity together with package context. The database uniqueness rule is package + entity type + native identifier. This allows the same native identifier to coexist in different entity domains, releases or RDL sources without collision.

### Package boundary

Relationships in RDL-003 are constrained to entities belonging to the same package. This prevents accidental cross-RDL joins from becoming indistinguishable from authoritative source relationships. Future cross-RDL equivalence/mapping will use a separate explicit mapping model.

### Provenance boundary

`rdl.rdl_entity` and `rdl.rdl_relationship` retain authoritative/derived status plus source-locator JSON. `ingestion.ingestion_run` records the adapter, source URI/hash, validation summary and outcome. This is the foundation for reproducible ingestion in RDL-004 and later.

### Runtime boundary

The browser continues to use the inherited CFIHOS snapshot repositories. RDL-003 creates only the normalized persistence model and application vocabulary. No UI route is switched to PostgreSQL until CFIHOS parity is demonstrated.

## RDL-004 — CFIHOS ingestion and parity architecture

RDL-004 adds the first real adapter into the normalized model without changing the browser runtime:

```text
Reviewed CFIHOS 2.0 snapshot
        |
        v
cfihos-snapshot-v1 adapter
        |
        +--> source SHA / source URI / source locators
        |
        v
CFIHOS RDL Source -> Release 2.0 -> immutable normalized package
        |
        +--> rdl_entity
        +--> rdl_relationship
        +--> source_mapping entities for contextual/ternary mappings
        |
        v
Deterministic parity verification
        ^
        |
Existing CFIHOS snapshot remains runtime reference
```

The adapter deliberately preserves `tag_class` and `equipment_class` as different typed identities. This is required because CFIHOS can reuse the same native code in both domains.

Some CFIHOS sheets encode contextual mappings that cannot be represented losslessly by one binary relationship. RDL-004 therefore represents the `tag equip class prop src std` rows as first-class `source_mapping` entities linked to property, source standard and any resolvable Tag/Equipment identities. This avoids collapsing multiple mappings that share the same property and source standard.

Where a source sheet itself says only "tag or equipment class", the normalized model records the ambiguity rather than pretending that the source supplied a domain it did not provide.

RDL-004 is a parallel persistence path only. The UI continues to use the reviewed snapshot repositories. Runtime cutover remains deferred until database-backed queries are proven equivalent at behavior level.

## RDL-005 — PostgreSQL repository read parity

RDL-005 introduces a server-side PostgreSQL read path while keeping the browser on the existing CFIHOS snapshot repositories:

```text
Browser UI -> existing CFIHOS snapshot repositories (active runtime)

Server-side parity path:
rdl_explorer PostgreSQL -> PsqlJsonClient -> PostgresRdlRepository -> RdlReadService
```

The repository reads normalized source/release/package identity, typed entities, hierarchy, direct properties, document relationships, controlled values, JIP33 requirements, tag/equipment mappings, unit dimension families, source-standard provenance, and first-class source mappings. The read path is source/release scoped and therefore does not assume that a CFIHOS native identifier is globally unique.

No UI repository cutover is part of RDL-005. The PostgreSQL implementation must first demonstrate deterministic semantic parity against the reviewed CFIHOS snapshot. `psql` remains an implementation detail of the local server-side adapter; browser code never receives database credentials and never connects directly to PostgreSQL.

## RDL-006 controlled repository cutover

RDL-006 introduces a server-side repository selector with three explicit modes:

- `snapshot` — the reviewed CFIHOS snapshot is the authoritative read path and remains the default.
- `postgresql` — normalized PostgreSQL is the selected read path.
- `dual` — the snapshot and PostgreSQL paths execute in parallel; semantic results are compared and the snapshot result is returned only when parity is confirmed.

The selector is intentionally server-side. Browser code does not receive database credentials or direct PostgreSQL access. Dual-read comparison ignores implementation-only database entity IDs while comparing package identity, typed/native identity, names, definitions, lifecycle state, normalized metadata and source locators. A mismatch fails closed rather than silently choosing a candidate result.

RDL-006 does not switch the current browser pages, CIS derivation or Assistant retrieval to PostgreSQL. It establishes the controlled cutover mechanism that a later sprint can wire into selected application endpoints.

## RDL-007 — Mapping-profile ingestion and multi-RDL coexistence

RDL-007 adds CCUS as the first non-CFIHOS RDL source. The authoritative input remains the supplied workbook; PostgreSQL stores a normalized operational representation with the workbook SHA-256 retained on the package.

The ingestion pattern is intentionally profile-driven:

`source workbook -> RDL workbook mapping profile -> canonical ingestion generator -> generic rdl_entity / rdl_relationship model`

The mapping profile owns source-specific sheet/header aliases. The SQL generator owns generic source/release/package, entity, relationship, provenance, and audit behaviour. This avoids embedding CCUS column names in the database model or repository layer and establishes the extension point for structurally different RDLs in later sprints.

CFIHOS and CCUS coexist as independent `rdl_source` / `rdl_release` / `rdl_package` trees. A native identifier may appear in both packages without collision. Authoritative relationships remain package-local; cross-RDL equivalence will be a separate explicit concept rather than an implicit join on native identifiers.

## RDL-008 — Water / Desalination format-generic ingestion

RDL-008 uses the supplied Water / Desalination workbook to prove that the RDL ingestion boundary is not tied to CFIHOS column names or source-native identifiers.

The source has the familiar workbook subject areas but materially different headers and identity conventions. Examples include `equipment class code`, `property code`, `unit code`, discipline codes without separate object IDs, picklist values without native value IDs, and source-property mappings without native mapping IDs.

The normalized path is therefore:

`Water / Desalination workbook -> water-desalination-normalized-v1 profile -> generic workbook ingestion generator -> existing rdl_entity / rdl_relationship model`

The mapping profile translates source sheet/header vocabulary. Where the source omits a native identifier for a first-class normalized object, the generic generator creates a deterministic canonical identifier derived from source-key plus stable source fields. The source locator still retains workbook sheet, row and mapping-profile provenance. This is intentionally different from inventing source-native IDs.

Code-based hierarchy is also handled generically: a profile may supply an explicit parent identifier instead of the CFIHOS-style parent-name lookup. No Water-specific PostgreSQL table, relationship type or repository implementation is introduced.

RDL-008 keeps authoritative relationships package-local and proves independent coexistence of CFIHOS, CCUS and Water / Desalination. Browser multi-RDL UX remains deferred to RDL-009.


## RDL-009 — Multi-RDL user experience and global search

RDL-009 exposes CFIHOS, CCUS and Water / Desalination through a source-aware user experience without weakening package identity. The browser receives a deterministic, generated search projection containing only public/pilot RDL entity fields and provenance metadata; it never receives PostgreSQL credentials. The projection is reproducible from the governed source workbooks and reviewed CFIHOS snapshot via `npm run generate:rdl-search-index`.

```text
Governed source packages
      |
      +--> normalized PostgreSQL RDL model
      |       |
      |       +--> RdlGlobalSearchRepository (server-side validation/read contract)
      |
      +--> deterministic browser search projection
              |
              v
        Global RDL Search UI
              |
       source + type + identifier
              |
              v
      package-aware entity route
```

The browser projection is a transition mechanism, not a second system of record. It exists because the current pilot deployment has no hosted PostgreSQL driver/API boundary. Once that infrastructure is introduced, the same UI contract can be served by the normalized repository search service without changing package-aware identity semantics.

Existing Tag Class, Equipment Class, Document, Discipline, Dictionary, Source Standard and Unit pages remain the deep CFIHOS specialist experience in RDL-009. Multi-RDL search routes provide safe generic detail/provenance for all loaded RDLs. Cross-RDL semantic equivalence and comparison remain RDL-010 scope.

## RDL-010 cross-RDL intelligence boundary

RDL-010 introduces a deliberate separation between source truth and derived intelligence:

```text
rdl.rdl_relationship
  = authoritative relationship inside one RDL package

rdl.cross_rdl_mapping
  = curated / rule-derived / future AI-suggested relationship across RDL packages
```

Each cross-RDL mapping carries a typed relationship, provenance method, confidence, status and evidence. The first deterministic generator uses exact normalized names only to propose `possible_match` candidates. It never promotes exact-name equality to semantic equivalence automatically.

For the pilot browser, `public/rdl-cross-intelligence.json` is a reproducible projection generated from the package-aware global-search projection. The enterprise server path uses the PostgreSQL mapping model through `CrossRdlIntelligenceRepository`.


## RDL-011 cross-RDL mapping governance boundary

RDL-011 turns cross-RDL candidate mappings into governable enterprise records without moving authority into the browser. The write path is deliberately server/database-side:

```text
Candidate mapping
   |
   v
Governance repository/service boundary
   | reviewer + rationale + expected review version
   v
rdl.review_cross_rdl_mapping(...)
   |
   +--> mapping state transition
   +--> reviewed_by / reviewed_at / rationale / version
   +--> append-only rdl.cross_rdl_mapping_review_event
```

Allowed governed transitions are candidate -> approved, candidate -> rejected, and approved -> retired through supersession. Optimistic concurrency prevents stale reviewers from overwriting a newer decision. Direct updates to review-state fields are blocked by a trigger unless executed inside the governed function.

The pilot browser exposes a deterministic read-only review projection. Approve/reject/supersede controls are intentionally disabled until an authenticated deployable API/service boundary is available; this avoids pretending that browser-local state is enterprise governance. Future AI suggestions enter as candidates and use the same review path.

## RDL-012 authenticated governance service boundary

RDL-012 introduces an authenticated HTTP service boundary between the browser review workflow and the RDL-011 governed database function.

```text
Enterprise identity provider / trusted gateway
        |
        | signed reviewer + roles + timestamp
        v
/api/governance/session
/api/governance/queue
/api/governance/review
        |
        v
GovernanceIdentity verification
        |
        +-- signature freshness
        +-- HMAC integrity
        +-- rdl-mapping-reviewer role
        |
        v
GovernanceService
        |
        v
CrossRdlGovernanceRepository
        |
        v
rdl.review_cross_rdl_mapping(...)
        |
        +-- optimistic review version
        +-- reviewer / rationale
        +-- append-only review event
```

The browser never receives `RDL_GOVERNANCE_AUTH_SECRET` or PostgreSQL credentials. Reviewer identity is not accepted from the review request body. It is derived only from a short-lived signed identity assertion supplied by a trusted upstream authentication gateway or BFF. A deployment using this pattern MUST strip client-supplied `x-rdl-reviewer`, `x-rdl-roles`, `x-rdl-auth-timestamp` and `x-rdl-auth-signature` headers before injecting its own signed values.

When no trusted assertion is present, the Mapping Governance page remains read-only and continues to use the deterministic projection. When a valid reviewer assertion is present, the page can use the live queue and submit approve/reject/supersede decisions through the same-origin API. The service passes the authenticated reviewer identity to the RDL-011 governance function and never trusts a browser-provided reviewer name.

The current PostgreSQL repository adapter uses the existing server-only `psql` JSON client. The authentication/service contract is intentionally independent of that adapter so a managed Node PostgreSQL driver can replace it for hosted production without changing browser semantics or governance rules.

## RDL-013 production PostgreSQL runtime

RDL-013 replaces the governance API's per-request `psql` process execution with a long-lived Node PostgreSQL pool. The application service and repository contracts do not change:

`Browser -> same-origin API -> GovernanceService -> CrossRdlGovernanceRepository -> PgJsonClient -> PostgreSQL`

The pool is a server-runtime singleton. It owns connection reuse, connection timeouts, idle cleanup and optional TLS. Browser code receives neither `RDL_DATABASE_URL` nor any pool/TLS secret. The legacy `PsqlJsonClient` remains only as a compatibility tool for earlier local parity scripts; it is no longer used by production governance API request handling.

Liveness (`/api/health`) proves that the server process can answer requests without depending on PostgreSQL. Readiness (`/api/readiness`) verifies PostgreSQL connectivity and reports non-sensitive pool counters. This separation allows an orchestrator to distinguish an alive process from one that is not ready to serve database-backed traffic.

`PgJsonClient.transaction(...)` establishes the runtime transaction boundary for later multi-step enterprise operations. Structured `DatabaseRuntimeError` instances preserve a database error code server-side while API handlers continue to return controlled messages rather than raw connection details.

## RDL-014 production deployment and runtime hardening

RDL-014 adds an operational layer around the RDL-012/013 governance service without changing its domain semantics:

```text
Trusted gateway / BFF
        |
        v
Request context (X-Request-ID)
        |
        +--> structured operational log
        |
        v
Governance authentication
        |
        +--> defensive reviewer rate limiter
        |
        v
GovernanceService -> CrossRdlGovernanceRepository -> PgJsonClient -> PostgreSQL
```

Production configuration is validated fail-closed. Local development can continue to use the explicit localhost database fallback, but a production deployment must provide a non-local `RDL_DATABASE_URL` and a governance signing secret of sufficient length. Readiness checks this operational contract before reporting ready.

The governance rate limiter is intentionally a defence-in-depth control inside one runtime instance. It does not claim distributed enforcement across serverless isolates. A production identity gateway/WAF/API platform remains responsible for globally coordinated abuse protection and for stripping client-supplied governance identity headers before injecting trusted signed values.

Every hardened API request has a correlation ID and emits structured JSON operational events. Logging is designed around non-sensitive identifiers and status metadata; secrets and signed identity material remain outside the log contract. Long-lived Node deployments can install the shared shutdown handler to drain the PostgreSQL pool on termination signals, while serverless deployments continue to reuse the singleton pool for the lifetime of a warm isolate.

## RDL-015 deployment automation and observability

RDL-015 adds a release/operations layer without changing RDL or governance semantics:

```text
Source commit
   |
   v
CI gates -> browser build -> deployment archive
                         |
                         +--> runtime manifest
                         +--> release metadata
                         v
                   Preview / UAT
                         |
                   smoke + approval
                         v
                     Production
                         |
            +------------+------------+
            |            |            |
          health       version      metrics
            |                         |
         readiness                    +--> hosting/telemetry aggregation
```

`/api/version` exposes non-secret release metadata so operators can prove which source/build is running. `/api/metrics` exposes process-local request/error/latency aggregates for diagnostics. Because serverless or horizontally scaled deployments have multiple runtime instances, these in-memory aggregates are explicitly not treated as a global monitoring system; production aggregation belongs in the hosting or observability platform.

The deployment archive is platform-neutral at the RDL Explorer contract level. It contains the built static application, API/server runtime sources, locked package metadata and `deployment/runtime-manifest.json`. Platform adapters such as the current Vercel configuration may consume the same contract without moving identity, governance or PostgreSQL boundaries into browser code.

The post-deployment smoke test verifies liveness, database-backed readiness, version metadata, correlation IDs and fail-closed unauthenticated governance access. Rollback restores the previous known-good immutable release and reruns the same smoke contract.

## RDL-016 — Enterprise hierarchy and effective-context composition

RDL-016 materializes the enterprise layering principle already present in the target architecture.

```text
L1 Industry package (immutable authority)
        |
        v
L2 Company context + governed extensions
        |
        v
L3 Asset context + governed extensions
        |
        v
L4 Project / CIS context + governed extensions
        |
        +-- exact package pins
        +-- approved adds / overrides / retirements
        v
Immutable effective package publication
        |
        v
DataGate / downstream consumers
```

`rdl.enterprise_context` represents the Company → Asset → Project parent chain. `rdl.context_package_pin` records exact package versions and precedence. `rdl.context_extension_change` stores explicit governed additions, overrides and retirements without changing the upstream package. `rdl.effective_context_publication` records an immutable effective-package reference plus composition manifest and SHA-256.

An active project context is frozen: its package pins cannot be updated or deleted. If Company, Asset or Industry standards evolve, an active project does not auto-migrate. A new project/context version must be composed and governed explicitly.

Project-originated extensions may later be promoted to Asset, Company or upstream standards governance. Promotion creates a new governed layer/version; it never rewrites the package against which the project was executed.

## RDL-017 — Enterprise extension authoring and governance
RDL-017 turns the RDL-016 hierarchy into a governed authoring workflow. Company, Asset and Project/CIS extensions are created as explicit draft records, submitted for review, conflict-checked against the selected context lineage, and approved/rejected through an authenticated server-side boundary. Upstream RDL packages are never edited. Review history is append-only and transitions use optimistic `review_version` checks. Effective preview shows inherited, proposed and conflict state before publication. An approved extension is only publishable when conflict-free; publication of the composed effective package remains the immutable RDL-016 boundary.
RDL-017 also exposes governed upward promotion (`Project → Asset`, `Asset → Company`) by cloning an approved change into a new draft at the parent layer with explicit provenance. Effective-context publication is server-side: it rejects unresolved draft/in-review changes, derives the composition manifest and SHA-256, and writes the immutable `effective_context_publication` record against an explicitly prepared effective package.

## RDL-018 — Effective standard comparison and publication

RDL-018 completes the governed path from enterprise extension authoring to immutable effective-standard publication. The publication service composes the selected enterprise context lineage, exact package pins and approved/retired extension records into a versioned `rdl-effective-standard-package/v1` artifact. Publication is fail-closed when unresolved draft/candidate/in-review extensions remain. The canonical manifest and payload are hashed with SHA-256 and persisted in `rdl.effective_standard_release`; published rows are immutable. The browser never treats an HTML SPA fallback or malformed session payload as authenticated publication authority.

The publication API is deliberately server-side and uses the same signed `rdl-extension-reviewer` trust boundary as extension governance. `/api/publications/compare` provides parent-versus-effective impact, `/api/publications/publish` creates an immutable release, and `/api/publications/package` returns the machine-consumable JSON package with its composition hash. DataGate integration remains outside this sprint; the package contract is the future integration boundary.

## RDL-019 — Published package distribution boundary

RDL-019 separates immutable publication from downstream distribution. `rdl.effective_standard_release` remains immutable. Consumer lifecycle metadata is stored separately in `rdl.effective_standard_distribution`, allowing a release to be marked active, deprecated or superseded without rewriting its package bytes or composition fingerprint.

The read-only distribution API is authenticated through the trusted gateway/BFF using the dedicated `rdl-package-consumer` role. It exposes a catalogue, manifest, filtered effective entities and an immutable `rdl-distribution-package/v1` JSON package. Browser clients reject non-JSON/SPA fallback responses and remain in an explicitly labelled demonstration mode when no valid consumer session exists.

Consumers must pin an exact release ID/version. “Latest” is discovery metadata only and must never silently migrate a consumer. A superseding release is an explicit new immutable release. This is the intended future DataGate integration boundary: discover → review → pin → retrieve → verify → activate, with no direct SQL coupling.

## RDL-020 — Consumer integration and change notification

RDL-020 adds the integration lifecycle above the RDL-019 immutable distribution API:

```text
RDL Explorer publish
      |
      v
transactional release notification
      |
      v
consumer acknowledgement
      |
      v
pull exact release -> verify SHA-256
      |
      v
stage (idempotent request key)
      |
      v
explicit consumer activation
```

`rdl.consumer_subscription` scopes release discovery. `rdl.release_notification` is an idempotent transactional notification/outbox record. `rdl.consumer_pull_receipt` records retry-safe pull/staging identity, while `rdl.consumer_release_state` prevents activation from skipping staging. Notification and publication never modify the consumer's active standard.

The same contract is the DataGate reference boundary: RDL Explorer announces; DataGate pulls, verifies, stages and activates under DataGate governance. There is no cross-product database access.

## RDL-021 — Release change intelligence

RDL-021 sits above immutable publication/distribution. It compares two exact `effective_standard_release` records, derives a deterministic semantic delta from their machine-consumable package payloads, assesses consumer states pinned to the source release, and emits `rdl-release-impact/v1`. Persisted analyses are immutable and SHA-256 fingerprinted. The impact engine is advisory: downstream staging, activation and project migration remain explicit consumer governance decisions.
