# RDL-043 - Normalized Projection Completeness

## Purpose

RDL-043 improves the generic normalized model using the RDL-041.2 source-projection accounting evidence while preserving the RDL-042 PostgreSQL-backed workbook runtime authority.

RDL-043 does not replace the lossless source layer. It adds an assessed projection/accounting v2 layer beside the immutable RDL-041.2 accounting batch.

```text
Lossless PostgreSQL source
        |
        +-- RDL-041.2 projection/accounting v1
        |      immutable historical row-level evidence
        |
        +-- RDL-043 projection/accounting v2
               generic equivalence identifiers
               property grouping semantics
               JIP33 semantic metadata completion
               governed projection exceptions
               semantic assessment decisions
```

## Scope

RDL-043 Macro-gate 2 implements:

1. Generic external identifier systems and identifiers.
2. Generic relationships from normalized RDL entities to external identifiers.
3. Generic property groups, grouping purposes and group relationships.
4. Eight-field JIP33 semantic metadata repair where Macro-gate 1 proved zero value conflicts.
5. Governed projection exceptions for unresolved external equivalence rows.
6. Governed projection exceptions for the ten document-required-per-class rows whose asset type says Equipment while the referenced class exists as a Tag Class only.
7. RDL-043 source semantic assessment for every source row.
8. Projection/accounting v2 with new lineage links and disposition decisions.

## Explicit non-scope

RDL-043 does not:

- modify the lossless source sheet/source record layer;
- rewrite the RDL-042 `/api/rdl-runtime/cfihos-workbook` runtime boundary;
- regenerate frozen JSON rollback/reference artifacts;
- rewrite the immutable RDL-041.2 accounting batch 1;
- normalize the CFIHOS data dictionary into a schema/constraint model;
- normalize the full RDL master object registry/ontology;
- clean up legacy `source_locator` semantics.

The data dictionary and full master-object registry are deliberately deferred because Macro-gate 1 showed they are broader information-model/ontology domains, not simple projection gaps.

## Semantic assessment decisions

RDL-043 records a semantic assessment row for every source row using these decisions:

- `NORMALIZE`
- `CONTRIBUTING_ONLY`
- `SOURCE_ONLY`
- `NOT_APPLICABLE`
- `UNRESOLVED`
- `DEFER_WITH_REASON`

This separates projection from semantic assessment:

```text
Projection:  what normalized objects and relationships exist?
Assessment:  was each source row intentionally normalized, retained as source evidence, deferred or unresolved?
```

## Governed exceptions

RDL-043 captures exceptions as first-class `projection_exception` entities so they can be queried, audited and carried into release quality reporting without fabricating false normalized semantics.

The expected governed exception categories are:

- `external_equivalence_unresolved`
- `asset_type_vs_tag_class_mismatch`

## Runtime boundary

RDL-043 must keep these RDL-042 files byte-for-byte unchanged:

- `api/rdl-runtime/cfihos-workbook.ts`
- `server/rdl/CfihosSourceWorkbookService.ts`
- `src/cfihos/workbook.ts`

The current UI/CIS/Assistant workbook contract continues to be served by the lossless PostgreSQL workbook boundary. RDL-043 changes the normalized projection and semantic assessment layer only.

## Validation contract

The RDL-043 dedicated validation requires:

- source sheets remain 23;
- source records remain 42,514;
- RDL-041.2 v1 accounting batch remains exact and immutable;
- exactly one RDL-043 v2 accounting batch exists;
- v2 accounting has zero unaccounted rows;
- every normalized entity and relationship has one primary v2 lineage link;
- external equivalence and property-group source rows are normalized using generic entity/relationship types;
- JIP33 eight-field semantic repair has zero mismatches versus source values;
- the 10 class/document conflicts are governed exceptions;
- the 37 unresolved external equivalence references are governed exceptions;
- frozen JSON rollback artifacts are unchanged;
- RDL-042 runtime authority files are unchanged.
