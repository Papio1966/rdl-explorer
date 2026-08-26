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

**Status: implementation sprint.** Replace production governance API `psql` process spawning with a managed Node PostgreSQL pool, structured database/runtime errors, explicit transaction support, configurable TLS/pool settings, and separate liveness/readiness endpoints. Preserve all RDL-012 browser and governance API semantics.

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

## RDL-014 — Production Deployment & Runtime Hardening

**Status: complete.** Harden the RDL-013 production PostgreSQL/API runtime with request correlation IDs, structured operational logging, strict production configuration validation, defensive governance rate limiting, liveness/readiness operational contracts, graceful pool shutdown support and production deployment guidance. No RDL domain model or browser governance semantics change in this sprint.
