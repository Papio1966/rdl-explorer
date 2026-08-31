# Unified Entity Detail Parity Architecture

## Decision

RDL Explorer will use the release-aware generic entity detail projection as the canonical long-term detail model. Specialist CFIHOS pages remain compatibility surfaces until the generic model has proven semantic parity.

## Projection model

The browser continues to consume deterministic static artifacts. `rdl-search-index.json` supplies release-scoped entity identities and `rdl-relationship-index.json` supplies release-scoped structured edges. The browser does not query PostgreSQL at runtime.

RDL-032 extends the relationship vocabulary with browser projections for:

- `property_unit`
- `property_controlled_value`
- `controlled_value_source_standard`
- `mapping_class_property`
- `mapping_class_standard`
- `mapping_property_standard`

The existing vocabulary remains authoritative for hierarchy, class properties, Tag/Equipment mappings, class documents, document disciplines, Information Requirements and Source Standards.

## Effective property semantics

For Tag and Equipment Classes, the generic detail service walks only explicit `entity_parent` edges within the selected release/package. It evaluates the selected class first and then ancestors. The first occurrence of a Property wins, preserving the existing specialist rule that a closer/direct assignment overrides an identical assignment inherited from a more distant ancestor.

## Controlled values

The normalized model can represent a controlled list as a distinct node. The browser search index currently does not expose controlled-list entities. To avoid unnecessary search-index churn, RDL-032 projects an explicit Property → Controlled Value edge by joining the Property's structured picklist identifier to the controlled-value row's structured picklist identifier. This is a deterministic projection, not free-text inference.

## Source mapping evidence

Source-mapping rows are projected directly between existing searchable entities rather than creating synthetic mapping nodes. Mapping IDs and source section/original terminology remain relationship attributes, preserving evidence while keeping all endpoints navigable.

## Fail-closed invariant

The generator validates every source and target identity against the exact release/package search index before writing the runtime artifact. A missing endpoint aborts generation.
