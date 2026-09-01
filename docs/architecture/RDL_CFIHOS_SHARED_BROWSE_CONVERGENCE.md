# RDL-035.3 — CFIHOS Shared Browse Convergence Architecture

## Principle

> Source and release change the data, not the navigation paradigm.

The seven primary browse families now use one release-aware navigation implementation across CFIHOS, Water / Desalination and CCUS.

```text
CFIHOS 2.0 ───────────┐
Water / Desalination ├─> normalized browse projection
CCUS ─────────────────┘           |
                                  v
                         RdlReleaseAwareBrowse
                           |              |
                    entity_parent      flat vocabularies
                           |              |
                           +-------> canonical detail
```

## Route boundary

`RdlScopedLegacyGuard` is the convergence boundary. For the shared entity types it delegates to `RdlReleaseAwareBrowse` regardless of source. CFIHOS-specific specialist children are retained only for non-shared capabilities and as temporary unreachable implementation residue pending cleanup.

The seven shared entity types are:
- `tag_class`
- `equipment_class`
- `document_type`
- `property`
- `source_standard`
- `discipline`
- `unit_of_measure`

## Explicit source/release context

Browse pages operate against one source and one release. `scope=all` therefore does not select a browse implementation or substitute CFIHOS data. It fails closed and asks the user to choose an RDL source/release. Cross-source discovery remains the responsibility of global search and catalogue/intelligence experiences.

## Hierarchy truthfulness

Hierarchy remains derived only from authoritative relationship-index records satisfying all of the following:
- exact source
- exact release
- package belonging to the selected records
- relationship type `entity_parent`
- same source and target entity type
- source entity is the child
- target entity is the parent

Names, identifiers, aliases, definitions and metadata are never used to infer hierarchy.

## Metadata parity

RDL-035.2 established the normalized browse metadata contract. RDL-035.3 consumes that contract unchanged:
- aliases and additional search text
- secondary and tertiary labels
- badges
- generic facets

This preserves CFIHOS specialist browse semantics without importing CFIHOS repositories/models into the shared browser or branching on `sourceKey`.

## Unit dimension filtering

Unit-of-Measure dimension filtering is driven only by projected `facets.dimension` metadata. The same facet control works for CFIHOS, Water / Desalination and CCUS. Dimension values and labels originate from authoritative source metadata; they are not inferred from unit names or symbols.

## Release status

Release status remains informational. `reviewed`, `candidate`, `draft` or `superseded` status must never select a navigation paradigm.

## Runtime stability

RDL-035.3 is a route/convergence increment. It does not regenerate or modify the runtime indexes. The RDL-035.2 enriched search index and the existing relationship index are frozen for this cutover.

## Cleanup boundary

Specialist CFIHOS browse page implementations and their CSS are not removed in RDL-035.3. They may be retired only after GitHub Chromium proves:
- all seven CFIHOS routes use the shared shell
- canonical detail navigation
- representative metadata search
- Unit dimension filtering
- serious/critical accessibility gate

Other CFIHOS repositories remain independent of this cleanup because they continue to support CIS, Assistant, diagnostics and other product capabilities.
