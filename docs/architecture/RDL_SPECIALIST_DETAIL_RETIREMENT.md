# RDL Specialist Detail Retirement Architecture

## Context

RDL-031 introduced a release-aware generic rich entity-detail architecture. RDL-032 extended that projection to specialist CFIHOS parity and converged the historic CFIHOS detail URL families through a compatibility redirect.

After convergence, the historic specialist detail implementations inside the browse-page modules became unreachable through application routing. RDL-033 removes those duplicate implementations and the residual page-local CSS that supported them.

## Target architecture

```text
Browse/list route
  /classes/tag
  /classes/equipment
  /documents
  /dictionary
  /standards
  /disciplines
  /units
        |
        | select entity
        v
Legacy compatibility detail URL
        |
        v
RdlLegacyEntityRedirect
  explicit cfihos / cfihos-2.0
        |
        v
Canonical release-aware entity route
  /rdl/cfihos/cfihos-2.0/<entity-type>/<id>
        |
        v
RdlEntityPage + loadRdlEntityDetail
```

The browse page owns discovery only. The generic entity-detail service owns detail semantics.

## Browse-page responsibilities

A specialist-named CFIHOS browse page may still provide:

- source-native hierarchy browsing;
- source-native list/search presentation;
- browse filters such as Unit dimension;
- navigation to an entity identifier;
- page-local styling required by those browse/list surfaces.

It must not own a second entity-detail projection, load detail-only relationships from a route parameter, or retain unreachable CSS for a retired detail implementation.

## Scope guard responsibilities

`RdlScopedLegacyGuard` is a browse-route scope boundary only.

For CFIHOS or all-RDL scope it renders the CFIHOS browse surface. For another selected RDL it reads the exact selected release from the release-aware search index and renders only records from that source/release. It remains fail-closed and does not substitute CFIHOS content.

Detail routing is not a responsibility of this guard after RDL-032.

## Compatibility routing

`RdlLegacyEntityRedirect` remains the sole compatibility owner for the seven historic CFIHOS detail URL families. The mapping is explicit and immutable for this compatibility contract:

- source: `cfihos`
- release: `cfihos-2.0`

The adapter must not use a mutable default-release lookup.

## CSS ownership after RDL-033.2

The seven historic page stylesheets remain because the browse/list pages are still source-native CFIHOS surfaces. Their ownership is now limited to classes referenced by active TSX.

The deterministic contract scans the active TSX source and rejects orphan classes in these stylesheets. It also checks representative retired-detail selectors are absent and browse-critical selectors remain.

This provides a simple architectural invariant:

> A specialist browse stylesheet may style an active browse surface, but it may not preserve a hidden second detail UI.

The cleanup retains `uom-detail` because that class is still the active right-hand browse-layout container. Retired nested Unit detail classes such as `uom-detail-inner`, `uom-detail-header` and `uom-detail-row` are removed.

## Retirement safety rules

1. Do not remove a browse route while retiring detail code or styles.
2. Do not remove a repository solely because one retired page stopped importing it.
3. Do not change search or relationship index generation as part of code/style retirement.
4. Do not change canonical entity-detail semantics.
5. Preserve RDL-030 release isolation, RDL-031 navigation and RDL-032 parity/convergence contracts.
6. Retain only page-local CSS classes that are referenced by active TSX.
7. Treat GitHub Chromium as the authoritative proof that browser behavior and accessibility remain unchanged.

## RDL-033 result

RDL-033.1 reduced the seven specialist page modules to browse/search responsibilities only. RDL-033.2 then removes their unreachable specialist-detail styling and strengthens the deterministic contract so residual CSS cannot silently accumulate again.

The resulting architecture has one detail renderer and seven lightweight CFIHOS browse/list entry points, with legacy URL compatibility preserved through an explicit release-pinned adapter.
