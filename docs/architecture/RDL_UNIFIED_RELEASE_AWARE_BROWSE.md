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
