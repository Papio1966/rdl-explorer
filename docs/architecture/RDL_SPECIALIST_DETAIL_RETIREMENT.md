# RDL Specialist Detail Retirement Architecture

## Context

RDL-031 introduced a release-aware generic rich entity-detail architecture. RDL-032 extended that projection to specialist CFIHOS parity and converged the historic CFIHOS detail URL families through a compatibility redirect.

After convergence, the historic specialist detail implementations inside the browse-page modules became unreachable through application routing. Keeping them would preserve two implementations of the same semantics and create unnecessary drift risk.

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
- navigation to an entity identifier.

It must not own a second entity-detail projection or load detail-only relationships based on a URL parameter.

## Scope guard responsibilities

`RdlScopedLegacyGuard` is a browse-route scope boundary only.

For CFIHOS or all-RDL scope it renders the CFIHOS browse surface. For another selected RDL it reads the exact selected release from the release-aware search index and renders only records from that source/release. It remains fail-closed and does not substitute CFIHOS content.

Detail routing is not a responsibility of this guard after RDL-032.

## Compatibility routing

`RdlLegacyEntityRedirect` remains the sole compatibility owner for the seven historic CFIHOS detail URL families. The mapping is explicit and immutable for this compatibility contract:

- source: `cfihos`
- release: `cfihos-2.0`

The adapter must not use a mutable default-release lookup.

## Retirement safety rules

1. Do not remove a browse route while retiring detail code.
2. Do not remove a repository solely because one retired page stopped importing it.
3. Do not change search or relationship index generation as part of code retirement.
4. Do not change canonical entity-detail semantics.
5. Preserve RDL-030 release isolation, RDL-031 navigation and RDL-032 parity/convergence contracts.
6. Treat GitHub Chromium as the authoritative proof that browser behavior remains unchanged.

## RDL-033.1 result

The seven browse modules retain browse/search responsibilities but no longer contain route-param-driven specialist detail implementations. The combined retained TypeScript browse-page surface is constrained by the deterministic RDL-033 contract so future work cannot silently reintroduce large parallel detail implementations.
