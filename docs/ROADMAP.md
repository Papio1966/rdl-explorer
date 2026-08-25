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

**Status: implementation sprint.** Introduce explicit `snapshot`, `postgresql` and `dual` server-side read modes. `snapshot` remains the safe default. `dual` executes both paths, compares semantic results deterministically and fails closed on divergence. Browser pages, CIS derivation and Assistant retrieval remain on the current runtime in this sprint.

## RDL-007 — First Additional RDL

Assess the available candidate RDLs and ingest one through the generic source/release/package/entity/relationship contract. Choose a candidate that is sufficiently different from CFIHOS to test the model while remaining manageable for a first multi-RDL implementation.

## RDL-008 — Second Additional RDL / Genericity Proof

Add a structurally different second RDL and prove that ingestion, identity, provenance and repository reads are generic rather than CFIHOS plus one special case.

## RDL-009 — Multi-RDL UX & Global Search

Expose source-aware exploration only after the backend genuinely supports multiple RDLs:

- RDL selector;
- All RDLs mode;
- provenance/source badges;
- source-aware global search;
- cross-RDL navigation.

## RDL-010 — Cross-RDL Intelligence

Add standards-intelligence capabilities:

- equivalent concepts;
- overlaps;
- gaps;
- conflicting definitions;
- complementary properties/documents;
- governed mappings;
- AI-assisted cross-RDL interpretation.

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
