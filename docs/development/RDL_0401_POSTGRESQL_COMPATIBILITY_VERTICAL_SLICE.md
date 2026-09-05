# RDL-040.1 — PostgreSQL Compatibility Vertical Slice

## Objective

Start retiring browser dependence on the monolithic CFIHOS workbook snapshot without weakening the established CFIHOS repository contracts. This increment proves the cutover mechanism on the smallest PostgreSQL-ready repository: Handover Events.

## Evidence basis

RDL-040 Gates 1, 1B, 2, 2A and 2B established that:

- the committed CFIHOS workbook snapshot is a 23-worksheet, ~16.7 MB browser artifact;
- normalized PostgreSQL already contains all five Handover Event entities with the source `sequence` metadata and authoritative source-locator provenance;
- all 1,127 Discipline / Document Type relationships and their five lifecycle-status attributes are represented in PostgreSQL;
- nine workbook-backed repositories are candidates for PostgreSQL convergence, while whole-workbook scans, `RDL master object`, `CFIHOS object equivalent mappin` and `property groupings` remain deferred;
- production browser reads must continue to cross a same-origin API boundary. Browser code must never receive database credentials.

## Decision

RDL-040.1 introduces a CFIHOS-specific compatibility service and API endpoint for Handover Events only. It does **not** attempt a nine-repository bulk cutover.

The existing `CfihosHandoverEventRepository` remains the public semantic contract. Only its source-loading boundary changes:

```text
Production/API mode
CfihosHandoverEventRepository
        |
        v
src/cfihos/runtimeCompatibility.ts
        |
        v
/api/rdl-runtime/cfihos-handover-events
        |
        v
CfihosRuntimeCompatibilityService
        |
        v
exact validated CFIHOS package in PostgreSQL
```

Development/rollback mode continues to use the reviewed workbook snapshot. Dual mode executes both paths, compares source fingerprint, Handover Event semantics and lifecycle diagnostic counts, and fails closed on any mismatch.

## Preserved contracts

1. `CfihosHandoverEventRepository.initialize()`, `getHandoverEvents()` and `getDiagnostics()` retain their existing behavior.
2. Production reads remain same-origin API calls; PostgreSQL credentials remain server-side.
3. The exact validated `cfihos/cfihos-2.0` package is selected. No latest-release substitution is allowed.
4. The package source SHA-256 is returned by the API and must match the reviewed snapshot in dual mode.
5. Handover Event source locator must remain `handover event`.
6. Lifecycle relationship diagnostics are derived only from stored `document_discipline` rows originating from `discipline document type`.
7. JSON remains an explicit rollback/reference mode. API failure never silently falls back to JSON.
8. No database migration, ingestion, source-workbook mutation, JSON regeneration, entity/relationship vocabulary change, hierarchy change or DataGate semantic change is introduced.
9. The remaining eight PostgreSQL-ready repositories stay on their existing workbook source in this increment.
10. Deferred whole-workbook and uncovered-sheet capabilities remain untouched.

## Acceptance

RDL-040.1 is locally acceptable only when all of the following pass:

- live PostgreSQL Handover Event source count/provenance/source-SHA parity;
- live PostgreSQL lifecycle relationship count and status-coverage parity;
- JSON mode makes no runtime API call;
- dual mode returns the PostgreSQL candidate only after exact parity and fails closed on a row or SHA mismatch;
- API mode uses the new same-origin endpoint;
- the public Handover Event repository event and diagnostic semantics remain unchanged;
- RDL-005/RDL-006 database parity remains green;
- RDL-030 through RDL-035, RDL-039, full deterministic regression, build, lint and `git diff --check` pass;
- the three frozen CFIHOS/search/relationship artifacts remain byte-for-byte unchanged;
- no local Playwright is run. GitHub Actions Chromium remains authoritative for browser E2E/accessibility before merge.

## Next increment

Only after this vertical slice is green locally and in GitHub should RDL-040 expand the same compatibility pattern to the next subset of the eight remaining PostgreSQL-ready repositories. The expansion should continue in small cohorts selected by dependency and semantic complexity, not as a bulk rewrite.
