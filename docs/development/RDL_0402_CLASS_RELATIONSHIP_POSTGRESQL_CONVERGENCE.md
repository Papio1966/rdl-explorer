# RDL-040.2 — Class Relationship PostgreSQL Convergence

## Objective

Move the authoritative `tag equipment class relationshi` row source used by `CfihosClassRelationshipRepository` from the browser workbook snapshot to the server-side PostgreSQL compatibility API, while preserving the existing repository contract and diagnostics.

## Scope

RDL-040.2 changes only the Class Relationship row authority. The repository continues to resolve Tag Class and Equipment Class endpoints through the existing repositories. Those repositories are separate PostgreSQL-convergence slices. This avoids duplicating class projection logic in the compatibility service.

The controlled browser read modes remain:

- `json` — immutable snapshot/reference and rollback mode;
- `dual` — compare PostgreSQL relationship rows and source fingerprint with the snapshot, failing closed on mismatch;
- `api` — PostgreSQL compatibility endpoint is authoritative for relationship rows.

## Proven Gate 1 baseline

Gate 1 established on CFIHOS 2.0 package `cfihos-2.0-b5a2a09e9e0e`:

- 911 workbook relationship rows;
- 911 PostgreSQL `tag_equipment_mapping` relationships;
- 848 Tag Classes;
- 832 Equipment Classes;
- 26 populated mapping reasons;
- zero unresolved Tag references;
- zero unresolved Equipment references;
- source SHA parity with the reviewed CFIHOS snapshot.

## Runtime boundary

`CfihosRuntimeCompatibilityService.classRelationships()` selects only the validated requested package and only authoritative `tag_equipment_mapping` relationships whose source locator is `tag equipment class relationshi`. PostgreSQL remains server-only.

The browser compatibility client reconstructs the five legacy worksheet fields consumed by the repository and checks exact row semantics in dual mode. It does not infer relationships or substitute another release.

## Semantic invariants

RDL-040.2 must preserve:

1. source/release/package identity and source SHA;
2. all 911 relationship endpoint identifiers and names;
3. mapping reason values;
4. authoritative source-sheet provenance;
5. existing canonical-ID resolution behavior;
6. existing relationship sorting and lookup behavior;
7. existing diagnostics, including unresolved-reference counts.

## DataGate impact

None. This is a runtime/API implementation change with unchanged normalized RDL entity/relationship vocabulary and unchanged semantic output. No migration, ingestion change, or package contract change is introduced.

## Explicitly out of scope

- Tag Class repository cutover;
- Equipment Class repository cutover;
- class-document, JIP33, Unit, Source Standard, or other repository cutovers;
- database schema changes;
- workbook or JSON regeneration;
- search/relationship index retirement.
