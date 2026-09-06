# RDL-040.3 — Unit of Measure PostgreSQL Convergence

## Objective

Move the legacy CFIHOS Unit of Measure repository source authority from direct workbook reads to the controlled PostgreSQL runtime compatibility boundary without changing its public repository contract, sorting, lookup or diagnostic semantics.

## Scope

RDL-040.3 covers `CfihosUnitOfMeasureRepository` only. PostgreSQL is authoritative for:

- 1,472 Unit of Measure entities and their native identity, UNECE code, symbol, dimension, measurement-system and synonym metadata;
- Tag Class property SI / Imperial Unit references;
- Equipment Class property SI / Imperial Unit references;
- Property Unit-of-Measure dimension references;
- source/package provenance required to verify release identity.

No database schema, migration, ingestion, source workbook, static search index or relationship index changes are included.

## Compatibility modes

- `json`: immutable workbook snapshot remains rollback/reference authority and makes no runtime API call.
- `api`: same-origin `/api/rdl-runtime/cfihos-units-of-measure` is operational authority.
- `dual`: snapshot and PostgreSQL sources are compared semantically and by source SHA-256; mismatches fail closed.

## Preserved repository contract

The existing async methods remain unchanged:

- `initialize()`
- `getUnits()`
- `getUnit(id)`
- `getUnitsForDimension(dimensionId)`
- `getDiagnostics()`

The existing repository continues to own normalization, sorting, indexing and diagnostics. Only its source loader changes.

## Gate-1 evidence

The reviewed baseline `8644f98d152a0abff6771a365eb285b1f9489fe0` proved:

- snapshot units: 1,472; PostgreSQL units: 1,472;
- every Unit-of-Measure model field matched with zero mismatches;
- source provenance matched for every Unit entity;
- Tag SI refs 1,043 / 1,043; Tag Imperial 878 / 878;
- Equipment SI 658 / 658; Equipment Imperial 547 / 547;
- Property dimensions 612 / 612;
- 3,126 Unit references resolved, zero unresolved;
- 612 Property dimension references resolved, zero unresolved;
- 199 dimensions and 2 measurement systems preserved.

## DataGate impact

None. This slice changes only the RDL Explorer runtime implementation boundary. Package identity, source/release identity, entity identity, normalized metadata and relationship vocabulary remain unchanged.
