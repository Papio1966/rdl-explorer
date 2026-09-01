# RDL-035.2 — Generic Browse Metadata Projection

## Purpose

RDL-034 established one release-aware navigation paradigm across Water / Desalination and CCUS. RDL-035.1 then showed that CFIHOS is structurally compatible with that browser but still exposes richer specialist browse metadata that the thin search projection does not preserve.

RDL-035.2 closes that projection gap without introducing CFIHOS-specific logic into the shared browser.

## Decision

Use the existing release-aware search index as the browse projection and enrich each record with optional normalized metadata.

```text
Authoritative workbook
        |
        v
release-aware generator
        |
        v
RdlSearchRecord
  identity / provenance
  name / definition
  aliases
  search text
  secondary / tertiary labels
  badges
  facets
        |
        v
RdlReleaseAwareBrowse
  hierarchy or flat mode
  metadata-aware search
  generic row metadata
  generic badges
  generic facets
        |
        v
canonical entity detail
```

A second browse index is deliberately avoided because it would duplicate source/release/package identity and create an unnecessary synchronization contract.

## Contract

```ts
export type RdlBrowseFacetValue = {
  value: string;
  label?: string;
};

export type RdlSearchRecord = {
  // existing release identity and entity fields
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: string[];
  facets?: Record<string, RdlBrowseFacetValue>;
};
```

All new fields are optional so existing RDL sources remain valid when a source does not provide richer metadata.

## Separation of concerns

### Generator responsibility
The generator understands workbook/profile field mappings and projects source-native values into normalized browse concepts.

Examples:
- CFIHOS `document type short code` -> `secondaryLabel`
- CFIHOS `document type classification` -> `tertiaryLabel`
- class synonyms -> `aliases`
- class parent/existence information -> `searchText`
- `abstract class indicator` -> `badges: ["Abstract"]`
- UoM symbol / UNECE / dimension / system values -> normalized metadata/search fields
- UoM dimension identity -> `facets.dimension`

### Browser responsibility
The browser understands only normalized concepts:
- search aliases/text
- secondary/tertiary labels
- badges
- facet keys/values

It must not depend on CFIHOS repositories, CFIHOS types or source-key conditionals.

## Search behavior

Metadata-aware search combines:
- native identifier
- entity name
- definition
- entity type
- aliases
- search text
- secondary and tertiary labels
- badges
- facet values and labels

Global search preserves the existing identifier/name scoring precedence while allowing metadata matches.

## Facet behavior

Facet controls are derived from `record.facets` for the exact selected source/release/entity record set.

Rules:
1. no facet is invented from names or free text
2. facet values remain release scoped
3. invalid URL facet values fail open to the unfiltered vocabulary rather than hiding records
4. selecting `all` removes the facet key from the URL
5. facet URL parameters use the generic facet key, e.g. `?dimension=<value>`
6. hierarchy truth continues to come only from authoritative same-release `entity_parent` relationships

RDL-035.2 proves the facet contract with Unit-of-Measure dimensions.

## UoM dimension projection

For CFIHOS, the preferred dimension facet identity is:
1. authoritative dimension native identifier
2. dimension code
3. dimension name

The display label prefers dimension name, then code, then identifier.

For mapped Water / Desalination and CCUS releases, the same contract is populated from the source mapping profile and workbook values available in that release. Sources without a separate dimension identifier may use the authoritative dimension/quantity-kind value supplied by the workbook as the facet value.

This is a metadata facet, not hierarchy.

## Runtime-index policy

RDL-035.2 intentionally changes `public/rdl-search-index.json`.

It must not change `public/rdl-relationship-index.json`.

Generation must be deterministic: generating the search index twice from an unchanged repository must produce the same SHA-256 hash.

## CFIHOS cutover boundary

RDL-035.2 does not alter the current CFIHOS browse routing boundary. Specialist pages remain the visible CFIHOS implementation while the normalized projection is proven.

RDL-035.3 may cut CFIHOS over only after:
- primary entity counts remain stable
- all 1,678 CFIHOS same-type hierarchy endpoints remain valid
- normalized metadata fidelity is proven against the CFIHOS snapshot
- Unit dimension facet identity is faithful to source
- GitHub Chromium confirms browser and accessibility parity

## Product principle

> Source and release change the data, not the navigation paradigm.

RDL-035.2 extends that principle to browse metadata: source-specific semantics are normalized at the projection boundary, not embedded into navigation components.
