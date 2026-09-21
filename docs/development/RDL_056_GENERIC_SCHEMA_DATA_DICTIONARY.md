# RDL-056 — Generic Schema & Data Dictionary Normalization

## Decision
RDL-056 introduces a dedicated governed schema domain for information-model semantics. Data Dictionary rows are not projected as ordinary `rdl_entity` records.

The canonical lineage is:

`rdl_source -> rdl_release -> rdl_package -> immutable rdl_source_sheet/rdl_source_record -> schema_definition -> schema_constraint`

`schema_definition` preserves the complete row-level identity and the directly represented information-model fields. `schema_constraint` makes requirement status, format/datatype hint, presence constraints and relationship semantics explicitly queryable without inventing semantic equivalence.

## Reuse boundary
Existing `property`, `unit_of_measure`, `controlled_list`, `controlled_value` and other RDL entities remain authoritative reference-data objects. RDL-056 may cross-link to them in later governed work, but does not duplicate or reinterpret them merely because names overlap.

## Data type rule
`format_specification` is the exact source value. `data_type_hint` is only the lower-cased first format clause (for example `Text, max 10 characters -> text`). It is a deterministic parsing aid, not a new ontology or semantic-equivalence claim.

## Browser/API projection
The existing `/dictionary` route remains the Property reference browser. RDL-056 adds `/schema` for information-model semantics through the versioned read-only API `rdl-schema-dictionary/v1`.

## Preservation
RDL-056 does not rewrite source packages, RDL entities, release 17, RDL-055 live-integration contracts or DataGate state.
