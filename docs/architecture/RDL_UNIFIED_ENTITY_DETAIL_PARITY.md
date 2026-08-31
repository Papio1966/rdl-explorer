# Unified Entity Detail Parity Architecture

## Decision

RDL Explorer uses the release-aware generic entity detail projection as the canonical entity-detail model. RDL-032.3 makes it the only active detail renderer reached from legacy CFIHOS detail URLs while preserving the existing specialist browse/list surfaces.

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

For Tag and Equipment Classes, the generic detail service walks only explicit `entity_parent` edges within the selected release/package. It evaluates the selected class first and then ancestors. The first occurrence of a Property wins, preserving the specialist rule that a closer/direct assignment overrides an identical assignment inherited from a more distant ancestor.

## Controlled values

The normalized model can represent a controlled list as a distinct node. The browser search index currently does not expose controlled-list entities. To avoid unnecessary search-index churn, RDL-032 projects an explicit Property → Controlled Value edge by joining the Property's structured picklist identifier to the controlled-value row's structured picklist identifier. This is a deterministic projection, not free-text inference.

## Source mapping evidence

Source-mapping rows are projected directly between existing searchable entities rather than creating synthetic mapping nodes. Mapping IDs and source section/original terminology remain relationship attributes, preserving evidence while keeping all endpoints navigable.

## Legacy compatibility adapter

`RdlLegacyEntityRedirect` is intentionally thin. It performs no data lookup and no semantic inference. It maps the legacy route parameter to the equivalent canonical entity type and delegates URL construction to `rdlEntityRoute`.

Compatibility routes are pinned to:

- source: `cfihos`
- release: `cfihos-2.0`

This pin is deliberate. A legacy CFIHOS URL is historical compatibility syntax, not permission to follow a future mutable default release.

The adapter preserves `location.search` and uses React Router `replace` navigation. Old anchor fragments are not carried forward because specialist and generic section IDs are intentionally different; retaining them would create broken anchor semantics.

## Browse/detail separation

The no-identifier routes remain specialist browsing surfaces:

- `/classes/tag`
- `/classes/equipment`
- `/dictionary`
- `/documents`
- `/disciplines`
- `/units`
- `/standards`

Their identifier-bearing counterparts are compatibility aliases only and no longer render the specialist detail branch. This gives RDL Explorer one active detail implementation without forcing a large browse-page rewrite in the same increment.

The dormant specialist detail code remains in the browse-page modules for now. It is not route-owned after RDL-032.3 and can be removed in a later dead-code cleanup once browser telemetry/regression confidence is sufficient.

## Fail-closed invariant

The relationship generator validates every source and target identity against the exact release/package search index before writing the runtime artifact. A missing endpoint aborts generation.

Legacy compatibility is also fail-closed with respect to release identity: the adapter never calls `getDefaultReleaseKey`, never consults the active RDL scope and never substitutes another source.

## Runtime artifact stability

RDL-032.3 does not alter either runtime index artifact. Installation and validation compare SHA-256 values for both `public/rdl-search-index.json` and `public/rdl-relationship-index.json` before and after the routing change.
