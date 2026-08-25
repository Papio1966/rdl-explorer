# RDL Explorer Roadmap

## RDL-001 — Product Bootstrap

Establish RDL Explorer as a separate product from CFIHOS Explorer.

- preserve inherited functionality;
- establish RDL Explorer identity;
- document product boundary, architecture, requirements and roadmap;
- retain CFIHOS 2.0 as the initial/default RDL;
- keep all existing quality gates green.

## RDL-002 — PostgreSQL Foundation

**Status: implemented foundation.**

Introduce the platform persistence boundary without replacing CFIHOS runtime behavior yet.

- PostgreSQL database `rdl_explorer`;
- initial schemas `rdl`, `ingestion`, `metadata`;
- migration framework and migration history;
- environment configuration and local health checks;
- server database-client contract;
- application-facing RDL repository boundary;
- CFIHOS snapshot remains the active runtime path.

## RDL-003 — Generic RDL Domain Model

Implement source/release/package identity, provenance-aware entities and generic relationships.

- `RdlSource`;
- `RdlRelease`;
- `RdlPackage`;
- normalized entity identity;
- provenance/version metadata;
- relationship model;
- architecture for future RDL layering.

## RDL-004 — CFIHOS Database Ingestion & Parity

Load CFIHOS into PostgreSQL through an adapter and demonstrate parity with the inherited CFIHOS Explorer behavior.

CFIHOS remains the regression reference implementation.

## RDL-005 — First Additional RDL

Select one candidate RDL after compatibility assessment and ingest it through the generic contract.

## RDL-006 — Second Additional RDL

Add a structurally different second RDL to prove the platform has not become CFIHOS plus a single special case.

## RDL-007 — Multi-RDL UX & Global Search

Expose source-aware exploration only after the backend genuinely supports multiple RDLs.

- RDL selector;
- All RDLs mode;
- provenance/source badges;
- source-aware global search;
- cross-RDL navigation.

## RDL-008 — Cross-RDL Intelligence

Add comparison and standards-intelligence capabilities:

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
