# RDL-031 — Consistent Rich Navigation Across RDLs

## RDL-031.1 Architecture Decision

**Branch:** `feature/rdl-031-consistent-rich-navigation`
**Status:** Architecture baseline established; RDL-031.5 endpoint-integrity repair package prepared
**Date:** 31-Aug-2026

---

## 1. Objective

Provide a consistent, release-aware rich detail experience across all loaded RDLs while preserving the strict source/release isolation established in RDL-030.

The target logical section order is:

1. Definition
2. Classification
3. Hierarchy
4. Properties
5. Related Classes
6. Required Documents
7. Information Requirements
8. Source Standards
9. Provenance

The order is stable across RDLs. Optional sections are shown only when the selected entity/release genuinely supplies relevant data.

---

## 2. Current state

### Generic multi-RDL detail

`RdlEntityPage` is already the correct release-isolated entry point for multi-RDL entities.

It resolves an entity by the exact tuple:

`sourceKey + releaseKey + entityType + nativeIdentifier`

and fails closed if the record is absent.

However, the current page exposes only:

- Definition
- Provenance

This is therefore the right route contract but not yet the right user experience.

### Existing rich CFIHOS detail pages

The existing specialist CFIHOS pages already demonstrate the richer interaction pattern:

- on-page contents navigation;
- explicit section anchors;
- progressive disclosure for long lists;
- related-class navigation;
- property requirements;
- document requirements;
- JIP33 information requirements where relevant;
- source-standard provenance.

These pages should be treated as UX/reference implementations, not duplicated per RDL.

### Existing scoped legacy browsing

The legacy browse routes are already protected by `RdlScopedLegacyGuard`.

For non-CFIHOS scopes they:

- filter records to the exact active release;
- never fall back silently to CFIHOS;
- offer a link into the generic release-aware detail route.

This remains valid during RDL-031.

---

## 3. Architecture decision

### 3.1 Do not create separate rich pages for each RDL

RDL-031 must not create:

- a CCUS Tag Class detail page;
- a Water Tag Class detail page;
- separate duplicated Property/Document/etc. implementations.

That would recreate the CFIHOS-first architecture and make every future RDL expensive.

Instead, RDL-031 will build one generic detail projection and one generic rich detail renderer.

### 3.2 Preserve specialist CFIHOS pages during this sprint

Existing CFIHOS specialist browse/detail pages remain in place for compatibility and for richer functionality that has not yet been normalized into the generic model.

RDL-031 does not remove or rewrite the specialist pages.

The generic multi-RDL route becomes progressively richer without destabilizing the established CFIHOS experience.

### 3.3 Introduce a generic entity-detail projection

Proposed data-layer contract:

```ts
type RdlEntityDetailProjection = {
  identity: {
    sourceKey: string;
    releaseKey: string;
    packageKey: string;
    entityType: string;
    nativeIdentifier: string;
    name: string;
    definition?: string;
  };

  classification?: {
    labels: Array<{ label: string; value: string }>;
  };

  hierarchy?: {
    parents: RdlEntityLink[];
    children: RdlEntityLink[];
  };

  properties?: RdlRelationshipItem[];
  relatedClasses?: RdlRelationshipItem[];
  requiredDocuments?: RdlRelationshipItem[];
  informationRequirements?: RdlRelationshipItem[];
  sourceStandards?: RdlRelationshipItem[];

  provenance: {
    sourceName: string;
    versionLabel: string;
    releaseStatus: string;
    sourceSheet: string;
    packageKey: string;
  };
};
```

All related-entity links must include the **same explicit source/release identity** unless the relationship itself explicitly points to another governed source/release.

No relationship lookup may silently search a different release.

---

## 4. Navigation contract

The generic page will expose one accessible:

```text
On this page
```

navigation component.

The section order is fixed:

```text
Definition
Classification
Hierarchy
Properties
Related Classes
Required Documents
Information Requirements
Source Standards
Provenance
```

Rules:

- `Definition` is always present.
- `Provenance` is always present.
- Optional sections appear only when meaningful data exists.
- Empty optional sections are not rendered merely to create visual symmetry.
- Navigation links are rendered only for sections actually present.
- Every section receives a stable anchor ID.
- The visible order and navigation order must match.

Recommended generic anchor IDs:

```text
rdl-definition
rdl-classification
rdl-hierarchy
rdl-properties
rdl-related-classes
rdl-required-documents
rdl-information-requirements
rdl-source-standards
rdl-provenance
```

---

## 5. Progressive disclosure contract

Any relationship/list section with more than 10 items should initially show 5 items.

The shared interaction contract is:

- initial visible count: 5;
- `Show all N ...`;
- `aria-expanded="false"` initially;
- expanded state shows all;
- button becomes `Show less`;
- collapsing restores 5 items.

This should be implemented once as a reusable component rather than independently per section.

---

## 6. Section semantics

### Definition

Always shown.

Uses the selected release record only.

### Classification

May contain:

- entity type;
- normalized category/family;
- source-native classification metadata;
- package/source sheet context where classification is genuinely meaningful.

Do not invent hierarchy from names or identifiers.

### Hierarchy

Show explicit parent/child relationships only.

No inferred hierarchy.

### Properties

For class entities, show explicitly related properties and requirement metadata where available.

For property entities, this section is normally absent unless the normalized model supplies property-to-property structure.

### Related Classes

Context-sensitive content may include:

- Tag → Equipment;
- Equipment → Tag;
- class → parent/child class;
- other explicitly governed class relationships.

The generic heading stays `Related Classes`; row metadata can explain the relationship type.

### Required Documents

Show explicit class/document relationships.

Do not derive document obligations from free text.

### Information Requirements

This is the generic section name.

CFIHOS JIP33 requirements can appear here as a source/type of information requirement.

Other RDLs can populate the same section when they provide equivalent structured requirements.

### Source Standards

Show direct class-standard links and, where available, property-level provenance.

### Provenance

Always shown and must include at least:

- source;
- release/version;
- release status;
- release key;
- package key;
- source sheet;
- entity type.

---

## 7. Release-isolation rules

RDL-030 constraints remain mandatory.

Every detail request must resolve using:

```text
sourceKey
releaseKey
entityType
nativeIdentifier
```

Relationship resolution must additionally filter by the exact selected package/release context.

Historical and successor releases must remain independently addressable.

A missing relationship in the selected release must remain missing; the UI must not borrow it from another release.

---

## 8. Routing rules

Canonical rich detail route remains:

```text
/rdl/:sourceKey/:releaseKey/:entityType/:nativeIdentifier
```

The older route without an explicit release may remain for compatibility, but it must resolve to the source's configured default release and must not become the canonical link generated by RDL-031.

All new generic links should use the explicit release-aware route helper.

---

## 9. What RDL-031 should reuse from the existing CFIHOS UX

Reuse the interaction concepts, not the CFIHOS-specific implementation:

- accessible `On this page` navigation;
- stable section anchors;
- progressive disclosure;
- clear related-entity identity;
- explicit source/provenance display;
- empty/loading/error states;
- keyboard/focus accessibility.

Do not duplicate the large CFIHOS page components into a generic page.

---

## 10. Remaining technical unknown before implementation

The inspection proves the UI/routing architecture but does **not yet prove which normalized relationship families are already available to the generic multi-RDL runtime**.

Before coding, RDL-031.2 must inspect:

- normalized RDL entity model;
- normalized relationship model;
- generated JSON/runtime snapshots;
- CCUS v2 relationship serialization;
- Water/Desalination v2 relationship serialization;
- relationship type names and endpoint identities;
- whether hierarchy, properties, class relations, documents, requirements and source standards are already materialized generically.

This determines whether RDL-031 is:

1. primarily a UI/projection sprint, or
2. a UI + generic relationship-index sprint.

No implementation should begin until that is confirmed.

---

## 11. Acceptance criteria

RDL-031 is complete when:

1. CCUS and Water/Desalination generic entity pages provide meaningful rich navigation where structured relationships exist.
2. CFIHOS generic entity routes use the same section architecture without breaking specialist pages.
3. all relationship links preserve exact source/release identity;
4. no cross-release fallback occurs;
5. optional sections are truthful and conditional;
6. long relationship lists use accessible progressive disclosure;
7. `On this page` navigation reflects exactly the rendered sections;
8. RDL-030 historical/current release isolation remains green;
9. local contract/regression/build/diff gates pass;
10. GitHub Actions Playwright Chromium E2E and accessibility gates pass.

---

## 12. Implementation sequencing

### RDL-031.1
Architecture and current-state inspection. **Complete.**

### RDL-031.2
Generic relationship/data capability inspection.

### RDL-031.3
Create generic detail projection and deterministic contract tests.

### RDL-031.4
Implement reusable rich-detail navigation/sections/progressive disclosure.

### RDL-031.5
Wire CCUS and Water/Desalination rich relationships.

### RDL-031.6
Regression, build, GitHub browser E2E/accessibility, documentation and merge.


## RDL-031.5 endpoint-integrity correction

The first RDL-031.4 installation correctly failed closed because a CFIHOS class-document row declared an Equipment asset type for `CFIHOS-30000880`, while the canonical runtime entity exists only as a Tag Class. The PostgreSQL ingestion join naturally suppresses such a relationship because the typed endpoint does not exist; the initial static relationship generator did not.

RDL-031.5 aligns the static browser projection with the authoritative ingestion semantics:

- relationship endpoints must exist as the same typed identity in the same source, release and package;
- CFIHOS class-document asset typing is accepted only when that typed class exists;
- generic profile class-document rows project every valid typed identity rather than choosing an arbitrary first match;
- the relationship generator itself now fails closed if any projected endpoint is absent from `rdl-search-index.json`;
- the RDL-031 contract keeps the known tag-only `CFIHOS-30000880` anomaly as a regression anchor.
