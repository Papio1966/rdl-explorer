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

## RDL-034.4 — Reference browse completion

The common browse boundary now covers all seven existing primary browse entity types used by the legacy route family:

```text
Tag Classes ----------- hierarchy when authoritative parents exist
Equipment Classes ----- hierarchy when authoritative parents exist
Document Types -------- flat when no authoritative parents exist
Properties ------------- flat when no authoritative parents exist
Source Standards ------- flat when no authoritative parents exist
Disciplines ------------ flat when no authoritative parents exist
Units of Measure ------- flat when no authoritative parents exist

          exact source + exact release + exact entity type
                              |
                              v
                    RdlReleaseAwareBrowse
                              |
                authoritative entity_parent?
                     /                    \
                   yes                    no
                    |                      |
              hierarchy mode          flat mode
                     \                    /
                      +------------------+
                              |
                              v
                 canonical release-aware detail
```

For both Water / Desalination 2.0 candidate and CCUS 2.0 candidate, `source_standard`, `discipline`, and `unit_of_measure` have zero same-type `entity_parent` relationships. Their browse mode is therefore flat by evidence, not by hard-coded entity-type policy. A future release that supplies authoritative same-type parentage would automatically use hierarchy mode through the same component.

Cross-type relationships do not create browse hierarchy. In particular:

- `entity_source_standard`, `mapping_class_standard`, `mapping_property_standard`, and `information_requirement_standard` enrich Source Standard detail;
- `document_discipline` enriches Discipline and Document Type detail;
- `property_unit` enriches Unit of Measure and Property detail.

The browser does not infer grouping from standard names, discipline names, unit symbols, unit dimensions, identifier prefixes, ordering, or free text. Unit dimension filtering remains a CFIHOS specialist capability until dimension membership is represented in the generic release-aware browse contract.

Presentation metadata is now explicit for the seven converged types:

- `tag_class`: Classes / Tag Class / Tags icon;
- `equipment_class`: Classes / Equipment Class / Boxes icon;
- `document_type`: Information / Document Type / File icon;
- `property`: Reference / Property / Book icon;
- `source_standard`: Reference / Source Standard / Database icon;
- `discipline`: Information / Discipline / Shapes icon;
- `unit_of_measure`: Reference / Unit of Measure / Ruler icon.

These are presentation differences only. Source and release continue to change the data, not the navigation paradigm. Release lifecycle status never selects hierarchy versus flat mode.
