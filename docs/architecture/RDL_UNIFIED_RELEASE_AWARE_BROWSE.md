# Unified Release-Aware Browse Architecture

## Principle

RDL Explorer uses a common navigation paradigm for the same entity type across loaded RDL sources. Source identity, release identity, package identity, hierarchy depth, vocabulary size, and release status remain visible data/provenance differences; they do not select different UX paradigms.

## RDL-034.1 flow

```text
/classes/tag
    |
    +-- CFIHOS --------------------> existing TagClassesPage
    |
    +-- Water / CCUS --------------> RdlReleaseAwareBrowse
                                      |-- rdl-search-index.json
                                      |-- rdl-relationship-index.json
                                      |      entity_parent: child -> parent
                                      |-- search / hierarchy shell
                                      '-- canonical /rdl/:source/:release/tag_class/:id
```

The new shell is generic. It has no dependency on `cfihosRepository`, `CfihosTagClass`, or other CFIHOS-specific models.

## Hierarchy truthfulness

`entity_parent` is authoritative only inside the exact source/release/package represented by the runtime indexes. The browser never infers parentage from names or text. If no parent relationship is supplied, all entities remain browseable as a flat vocabulary inside the same navigation shell.

Malformed cycles or disconnected hierarchy fragments must not hide entities; unreachable nodes are surfaced as safe flat roots.

## Release status

No UI routing decision may branch on `draft`, `candidate`, `reviewed`, `superseded`, or similar lifecycle labels. Those labels remain provenance/governance metadata.

## RDL-034.2 — Equipment Class convergence

The shared class-browse boundary now covers both normalized class entity types:

```text
/classes/tag
/classes/equipment
      |
      +-- CFIHOS -----------------> existing specialist browse page
      |
      '-- Water / CCUS -----------> RdlReleaseAwareBrowse
                                     |-- exact sourceKey
                                     |-- exact releaseKey
                                     |-- explicit entityType
                                     |-- authoritative entity_parent hierarchy
                                     '-- canonical release-aware detail
```

Water / Desalination 2.0 candidate contains 50 Equipment Classes with 49 parent relationships. CCUS 2.0 candidate contains 61 Equipment Classes with 60 parent relationships. Each therefore forms a complete rooted hierarchy without inferred parentage.

The generic shell may vary labels and decorative iconography by entity type, but source identity or release lifecycle status never selects a different navigation model.

## RDL-034.3 — Hierarchical and flat browse modes

The shared browse boundary now covers four normalized entity types:

```text
                     exact source + release + entity type
                                  |
                                  v
                        RdlReleaseAwareBrowse
                                  |
                    authoritative entity_parent?
                         /                    \
                       yes                    no
                        |                      |
                  hierarchy mode          flat mode
                        |                      |
              Tag / Equipment        Document / Property
                        \                      /
                         +--------------------+
                                  |
                                  v
                     canonical release-aware detail
```

For Water / Desalination 2.0 candidate and CCUS 2.0 candidate, Document Types and Properties have zero same-type `entity_parent` relationships. Their flat presentation is therefore a truthful statement about source structure, not a UI fallback or missing-data inference.

The browser makes the source structure explicit with `data-browse-mode="hierarchy"` or `data-browse-mode="flat"`. Hierarchical navigation uses ARIA tree/treeitem semantics. Search results and flat vocabularies use list/listitem semantics. This prevents a hierarchy-only accessibility model from being imposed on non-hierarchical vocabularies.

Presentation metadata is entity-type aware but navigation mechanics remain source-neutral:

- `tag_class`: Classes / Tag Class / hierarchy when authoritative parents exist;
- `equipment_class`: Classes / Equipment Class / hierarchy when authoritative parents exist;
- `document_type`: Information / Document Type / flat when no authoritative parents exist;
- `property`: Reference / Property / flat when no authoritative parents exist.

Release lifecycle status remains provenance only. It never selects hierarchy versus flat mode; only authoritative same-release relationships do.
