# RDL-035.1 — CFIHOS Shared Browse Readiness & Parity Audit

## Decision

**Do not switch CFIHOS browse routes to `RdlReleaseAwareBrowse` yet.**

The shared browser is structurally ready for all seven primary CFIHOS entity types, but the current release-aware search projection is intentionally thin and does not yet preserve several useful CFIHOS browse capabilities.

The next implementation increment should generalize the release-aware browse projection with entity metadata, aliases, display metadata and optional facets before CFIHOS cutover.

## Structural readiness

CFIHOS 2.0 is fully represented in the release-aware search/relationship indexes:

| Entity type | Records | Same-type `entity_parent` | Browse mode |
|---|---:|---:|---|
| Tag Classes | 848 | 847 | hierarchy |
| Equipment Classes | 832 | 831 | hierarchy |
| Document Types | 329 | 0 | flat |
| Properties | 1,388 | 0 | flat |
| Source Standards | 305 | 0 | flat |
| Disciplines | 34 | 0 | flat |
| Units of Measure | 1,472 | 0 | flat |

All 1,678 same-type hierarchy relationships have valid indexed endpoints.

## Current generic search projection

`RdlSearchRecord` currently carries only:

- source/release/package identity
- entity type
- native identifier
- name
- definition
- source sheet

The shared browser searches only native identifier, name and definition.

That is sufficient for release isolation, hierarchy/flat-mode selection and canonical detail navigation, but it is not sufficient for full CFIHOS browse parity.

## Parity assessment

| Browse family | Structural parity | Search/display parity | Decision |
|---|---|---|---|
| Tag Classes | Ready | Missing parent-name search, synonyms and abstract-class indicator | **Not ready** |
| Equipment Classes | Ready | Missing parent-name search, existence reason, synonyms and abstract-class indicator | **Not ready** |
| Document Types | Ready | Missing short code, classification and synonyms | **Not ready** |
| Properties | Ready | Missing datatype, UoM dimension, picklist, existence reason and synonyms | **Not ready** |
| Source Standards | Ready | Code is already projected as record name and description as definition | **Ready in principle** |
| Disciplines | Ready | Missing discipline code | **Not ready** |
| Units of Measure | Ready | Missing symbol, UNECE code, dimension, system, synonyms and dimension facet/filter | **Not ready** |

## Key conclusion

RDL-034 solved the **navigation paradigm** problem. RDL-035 must now solve the **browse metadata parity** problem.

The correct architecture is not to re-introduce CFIHOS-specific code into `RdlReleaseAwareBrowse`. Instead, extend the release-aware browse/search projection so each RDL can expose optional normalized browse metadata without the component depending on CFIHOS repositories.

## Recommended normalized browse metadata contract

Add optional fields to the release-aware search/browse projection:

```ts
export type RdlSearchRecord = {
  // existing identity/provenance fields
  sourceKey: RdlSourceKey;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  sourceSheet: string;

  // normalized browse projection
  aliases?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: Array<{ key: string; label: string }>;
  facets?: Record<string, Array<{ value: string; label: string }>>;
  searchText?: string[];
};
```

The exact schema can be refined in RDL-035.2, but the principles should hold:

1. Optional metadata is source-neutral.
2. Generators map source-specific workbook fields into normalized browse fields.
3. Search uses `searchText` / aliases in addition to identity/name/definition.
4. List rows may render secondary/tertiary metadata when present.
5. Facets are authoritative metadata-driven filters, never inferred from names.
6. CFIHOS Units of Measure retain dimension filtering through a generic facet contract.
7. Hierarchy continues to come only from authoritative same-release `entity_parent` relationships.
8. Canonical detail routes remain unchanged.

## Proposed mapping for CFIHOS

| Entity type | Aliases / search text | Secondary display | Badge/facet |
|---|---|---|---|
| Tag Class | parent name, synonyms | native ID | `abstract` badge |
| Equipment Class | parent name, existence reason, synonyms | native ID | `abstract` badge |
| Document Type | short code, classification, synonyms | short code | classification |
| Property | datatype, dimension code, picklist, existence reason, synonyms | datatype | picklist/dimension optional |
| Source Standard | existing code/name/description sufficient | native ID | none required |
| Discipline | discipline code | discipline code | none required |
| Unit of Measure | symbol, UNECE code, dimension/system names and codes, synonyms | symbol / UNECE | `dimension` facet |

## Recommended delivery sequence

### RDL-035.2 — Generic Browse Metadata Projection

- extend search-index contract with normalized optional browse metadata
- populate it for CFIHOS first, and preserve existing Water/CCUS behavior
- generalize search to include aliases/search metadata
- generalize list-row secondary metadata and badges
- add generic facet support, initially proving Unit-of-Measure dimension filtering
- keep all CFIHOS browse routes on specialist pages during this increment
- deterministic parity tests compare specialist search capabilities with generic projection

### RDL-035.3 — CFIHOS Shared Browse Cutover

Only after RDL-035.2 proves parity:

- route CFIHOS seven primary browse families through `RdlReleaseAwareBrowse`
- preserve explicit `cfihos-2.0` release identity
- retire the seven specialist browse implementations and their page-local CSS only after dependency checks
- keep CFIHOS repositories that remain required by CIS, Assistant, Data Source diagnostics and other capabilities
- GitHub Chromium remains the authoritative E2E/accessibility gate

## Non-goals for RDL-035.1

- no CFIHOS route cutover
- no repository removal
- no runtime index regeneration
- no detail-rendering changes
- no hierarchy inference
- no release-status branching
- no local Playwright

## RDL-035.1 outcome

**PASS — readiness audit complete.**

CFIHOS shared browse is **structurally ready but not yet parity-ready**. Proceed with RDL-035.2 generic browse metadata projection before any CFIHOS cutover.
