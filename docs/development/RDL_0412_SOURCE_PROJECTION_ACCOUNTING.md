# RDL-041.2 — Source-Projection Accounting and Lineage

## Purpose

RDL-041.1 preserves every reviewed CFIHOS worksheet row and parsed field in
PostgreSQL. RDL-041.2 adds an additive accounting layer that explains how those
source records contributed to the existing normalized `rdl_entity` and
`rdl_relationship` objects.

This slice does **not** modify normalized objects and does not change browser,
CIS, Assistant, or shared workbook-loader runtime authority.

## Evidence behind the design

The source-locator semantic audit proved that `source_locator` is useful
compatibility provenance but is not authoritative lineage:

- all 13,609 entities and 39,461 relationships point syntactically to an
  existing source record;
- 366 of 367 controlled-list entities point to a row containing a different
  controlled-list identifier;
- all 547 Property-to-controlled-list relationships have correct endpoints but
  an incorrect source-row locator;
- 3,027 source rows contribute to 367 controlled-list entities;
- 533 JIP33 source rows contribute to 488 Information Requirement entities;
- 45 JIP33 rows are additional contributors to an existing entity, and some
  collapsed relationship objects also have multiple contributing rows.

An authoritative model must therefore support both:

- one source record producing multiple normalized objects; and
- one normalized object consolidating multiple source records.

## Data model

Migration `022_create_source_projection_accounting.sql` adds three immutable
accounting tables.

### `rdl.rdl_projection_accounting_batch`

A batch identifies one exact combination of:

- governed package;
- source-content SHA-256;
- lossless source-layer SHA-256;
- normalized-projection semantic SHA-256;
- accounting adapter and version.

A changed source or normalized state produces a new batch. Replaying the exact
same state reuses the existing batch without allocating new identities.

### `rdl.rdl_source_projection_link`

This is the authoritative many-to-many lineage ledger. Each row connects one
`rdl_source_record` to either one normalized entity or one normalized
relationship.

`lineage_role` distinguishes:

- `primary` — the first authoritative source record for the normalized object;
- `contributing` — an additional source record consolidated into that object.

Exactly one primary link is required for every normalized entity and every
normalized relationship in a completed batch.

### `rdl.rdl_source_projection_disposition`

This table contains only source records with zero normalized output. Supported
statuses are:

- `unresolved` — a projection was intended but a required endpoint is absent;
- `unmapped` — source semantics are preserved but no normalized mapping has
  been implemented;
- `not_applicable` — release presentation or guidance content is not part of
  the normalized semantic model;
- `error` — an unexpected zero-output condition requiring intervention.

Projected status is derived from lineage links and is never stored as a
zero-output disposition.

## Current CFIHOS accounting policy

The current 42,514 source records classify as follows:

| Row-level status | Count | Policy |
|---|---:|---|
| `projected` | 25,532 | At least one semantic lineage link exists |
| `unmapped` | 16,924 | RDL master object, data dictionary, equivalence mapping, or property grouping normalization is not implemented |
| `not_applicable` | 48 | Cover/Index and Guidance presentation content |
| `unresolved` | 10 | Class Document rows require missing Equipment-class endpoints |
| `error` | 0 | No unexplained zero-output rows |

The 53,070 normalized objects receive one primary link each. Additional
contributing links preserve controlled-list and JIP33 consolidation, producing
55,866 total lineage links.

## Semantic completeness is separate

`projected` is a row-level statement only. It means that at least one normalized
object is linked to the source row. It does not assert that every populated
source field has been normalized.

The current accounting view therefore reports:

```text
semantic_completeness_status = not_assessed
```

Field-level and semantic completeness remain RDL-043 work. This separation is
especially important for JIP33, where all source rows have projection lineage
but some populated source fields are not yet represented in normalized
metadata.

## Deterministic backfill

`database/sql/backfill_rdl_0412_cfihos_projection_accounting.sql` derives
lineage from source identifiers and relationship endpoints, not from the
legacy locator ordinal.

The backfill:

1. locks the exact package and source/normalized fingerprints;
2. resolves entity lineage by source-native identifier;
3. resolves relationship lineage by semantic endpoints;
4. assigns one primary and any additional contributing links;
5. classifies every zero-output source row with an explicit reason;
6. fails closed if any normalized object is unlinked or any source row is
   unaccounted;
7. writes one immutable accounting batch transactionally;
8. replays idempotently for the same source and normalized state.

## Views

- `rdl.rdl_source_projection_accounting` — current row-level status, reason,
  link counts, raw row, and explicit `not_assessed` semantic completeness;
- `rdl.rdl_source_projection_accounting_summary` — package/sheet/status
  aggregates;
- `rdl.rdl_normalized_projection_lineage` — reverse lineage from normalized
  objects to all primary and contributing source records.

## Guardrails

RDL-041.2 does not:

- rewrite `source_locator` values;
- update or delete lossless source records;
- update or delete normalized entities or relationships;
- claim field or semantic completeness;
- repair missing JIP33 fields;
- create the ten unresolved Class Document relationships;
- normalize the currently unmapped source sheets;
- change RDL Explorer UI/runtime authority;
- change DataGate.

## Subsequent slices

- **RDL-042** exposes one PostgreSQL-backed workbook/sheet compatibility API and
  switches the shared workbook loader away from static JSON, while retaining
  JSON as rollback and regression evidence.
- **RDL-043** uses the accounting evidence to repair normalized projection gaps
  and assess field/semantic completeness explicitly.
