# RDL Explorer Roadmap

## RDL-001 — Product Bootstrap

**Status: complete.** Establish RDL Explorer as a separate product from CFIHOS Explorer while preserving inherited functionality and the reviewed CFIHOS 2.0 baseline.

## RDL-002 — PostgreSQL Foundation

**Status: complete.** Establish the dedicated `rdl_explorer` PostgreSQL database, `rdl`/`ingestion`/`metadata` schemas, migration framework, database health tooling and server/database boundaries while leaving the snapshot runtime unchanged.

## RDL-003 — Core RDL Domain Model

**Status: complete.** Establish source/release/package identity, provenance-aware typed entities, generic relationships and ingestion provenance.

## RDL-004 — CFIHOS PostgreSQL Ingestion & Parity

**Status: complete.** Ingest the reviewed CFIHOS 2.0 snapshot into the generic PostgreSQL model and prove structural parity, typed identity and package provenance. The snapshot remains the regression oracle.

## RDL-005 — PostgreSQL Repository Read Parity

**Status: complete.** Establish server-side normalized PostgreSQL reads and prove semantic parity for representative CFIHOS identities, hierarchy, properties, documents, controlled values, JIP33, tag/equipment mappings, units and provenance.

## RDL-006 — Dual-Read / Controlled Repository Cutover

**Status: complete.** Introduce explicit `snapshot`, `postgresql` and `dual` server-side read modes. `snapshot` remains the safe default. `dual` executes both paths, compares semantic results deterministically and fails closed on divergence. Browser pages, CIS derivation and Assistant retrieval remain on the current runtime in this sprint.

## RDL-007 — First Additional RDL

**Status: complete.** Ingest the CCUS RDL Extension as the first non-CFIHOS source. Establish a reusable mapping-profile ingestion pattern, prove CFIHOS/CCUS package coexistence, preserve exact workbook SHA provenance, verify deterministic/idempotent reloads, and keep the browser multi-RDL UX out of scope until backend genericity is proven.

## RDL-008 — Water / Desalination Genericity Proof

**Status: complete.** Ingest the structurally different Water / Desalination RDL through a versioned mapping profile. Prove deterministic identifier derivation for source objects without native IDs, code-based hierarchy mapping, three-RDL coexistence, package isolation, prior baseline protection and idempotent provenance without adding Water-specific database tables.

## RDL-009 — Multi-RDL UX & Global Search

**Status: complete.** Expose the three proven RDL packages through an RDL scope selector, catalogue, source-aware global search, package-aware generic entity routes and provenance badges. Retain the established deep CFIHOS specialist pages while multi-RDL relationship UX remains a later concern.

## RDL-010 — Cross-RDL Intelligence

**Status: complete.** Add a governed cross-RDL mapping model, deterministic candidate mappings, source-pair comparison, structural overlap/gap indicators and provenance/confidence-aware UX. Authoritative within-package relationships remain separate. AI-suggested mappings are intentionally deferred until deterministic governance is established.

## RDL-011 — Cross-RDL Mapping Governance & Review

**Status: complete.** Add governed approve/reject/supersede transitions, optimistic review-version checks, reviewer/rationale capture, append-only audit history, a server-side governance repository and a read-only pilot review queue. Browser writes remain out of scope until a deployable authenticated service boundary exists.

## RDL-012 — Authenticated Governance Service Boundary

**Status: complete.** Add a trusted signed reviewer identity boundary, reviewer-role authorization, same-origin governance session/queue/review APIs, live repository-backed review actions and graceful read-only fallback when no enterprise identity assertion is present. Browser code never receives database credentials or the server signing secret.

## RDL-013 — Production Server Runtime & PostgreSQL Driver

**Status: complete.** Replace production governance API `psql` process spawning with a managed Node PostgreSQL pool, structured database/runtime errors, explicit transaction support, configurable TLS/pool settings, and separate liveness/readiness endpoints. Preserve all RDL-012 browser and governance API semantics.

## RDL-014 — Production Deployment & Runtime Hardening

**Status: complete.** Harden the RDL-013 production PostgreSQL/API runtime with request correlation IDs, structured operational logging, strict production configuration validation, defensive governance rate limiting, liveness/readiness operational contracts, graceful pool shutdown support and production deployment guidance. No RDL domain model or browser governance semantics change in this sprint.


## RDL-015 — Deployment Automation & Observability

**Status: complete.** Package the hardened runtime into a CI-produced deployable artifact, expose release/build metadata, add process-local diagnostic metrics, define environment promotion and rollback contracts, and provide automated post-deployment smoke testing without changing RDL or governance semantics.

## RDL-016 — Enterprise RDL Hierarchy & Extension Governance

**Status: implementation sprint.** Materialize Industry → Company → Asset → Project/CIS layering with explicit parent contexts, exact package pinning, governed add/override/retire extension records, frozen active-project baselines, immutable effective-package publications and provenance-aware hierarchy UX.

## Later enterprise roadmap

After the core multi-RDL platform is proven:

- Company RDL governance;
- Asset RDL governance;
- Project RDL / CIS composition;
- immutable effective packages;
- enterprise identity and access;
- Publisher capabilities;
- APIs/OEM integration;
- DataGate package handoff and requirement-to-validation traceability.

### RDL-017 — Enterprise Extension Authoring & Governance — Complete
Adds enterprise extension drafting, authenticated submit/review decisions, conflict detection, effective preview, append-only audit history, optimistic concurrency and read-only demonstration UX.

## RDL-018 — Effective Standard Comparison & Publication ✅

Delivered parent-versus-effective comparison, change-impact filtering, immutable versioned effective-standard releases, SHA-256 package verification, machine-consumable JSON package download, release provenance, fail-closed publication authorization and browser/accessibility regression coverage. This establishes the publishable standards contract that can later be consumed by DataGate without direct database coupling.

## RDL-019 — Published Package Distribution & Consumption API ✅

Provides a stable, versioned consumption boundary for immutable effective-standard releases. Adds a release catalogue, manifest, effective-entity retrieval, downloadable `rdl-distribution-package/v1` package, SHA-256/ETag integrity metadata, explicit consumer compatibility, release pinning, and separate deprecation/supersession metadata. Consumer access uses a dedicated trusted `rdl-package-consumer` role and never requires direct SQL access.

## RDL-020 — Consumer Integration Contract & Change Notification ✅

Defines the consumer subscription, transactional release-notification/outbox, acknowledgement, idempotent pull/staging and explicit activation lifecycle. The preferred integration pattern is push notification, pull immutable content. Adds a DataGate reference contract without direct SQL coupling or automatic downstream activation.

## RDL-021 — Release Change Intelligence & Impact Analysis ✅

Adds exact published-release comparison, semantic added/removed/modified/unchanged deltas, advisory breaking-change classification, downstream pinned-consumer impact, governed release notes, immutable SHA-256 analysis records and a fail-closed `/impact` experience. Analysis informs explicit migration decisions and never auto-migrates or auto-activates a project or consumer.

## RDL-022 — Migration Planning & Controlled Adoption ✅

Turn RDL-021 impact intelligence into governed adoption plans. Plans are tied to exact source and target releases, carry an impacted-entity remediation checklist, ownership, due dates, readiness, approval, staging and explicit activation. No publication or analysis can auto-migrate a project or consumer.

## RDL-023 — Enterprise Standards Dashboard & Control Tower — Delivered

- Enterprise portfolio health KPIs across governed standards lifecycle state.
- Consolidated extension-review, consumer-notification and migration-plan queue.
- Published release health with consumer discovery/staging/activation signals.
- Migration readiness, blocked/overdue remediation and breaking-action indicators.
- Trusted read-only API and fail-closed browser route at `/control-tower`.
- Drill-through to authoritative governance/adoption workflows; no duplicated mutable state.
