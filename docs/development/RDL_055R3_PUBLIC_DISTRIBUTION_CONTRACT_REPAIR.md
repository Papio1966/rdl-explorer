# RDL-055R3 - Public distribution runtime and package checksum repair

## Purpose

RDL-055R3 repairs the last RDL-side public distribution incompatibility found while qualifying the live DataGate-to-RDL boundary.

The qualification Project/L4 release is already governed, immutable, active, and persistently enrolled for distribution. The remaining defects are in the public read contract:

1. `api/distribution/manifest.ts` and `api/distribution/package.ts` import a removed helper at `api/_shared/request.ts`, so those handlers cannot load.
2. `PublishedPackageDistributionRepository.consumerPackage()` exposes the existing immutable package-body SHA-256 only as `distributionSha256`. The RDL-052 consumer contract also requires an explicit non-empty `packageChecksum`, so DataGate correctly rejects the otherwise valid package before project validation.

## Repair

The public handlers now use the same current runtime helpers as the catalogue handler:

- request lifecycle helpers from `api/_runtime.ts`;
- query parsing from `api/governance/_shared.ts`;
- distribution authentication and error handling remain in `api/distribution/_shared.ts`.

The consumer package now exposes:

- `packageChecksum`: SHA-256 of the immutable `rdl-distribution-package/v1` package body before checksum fields are added;
- `distributionSha256`: the same v1 package-body fingerprint that was already exposed before this repair.

For v1, the two values are intentionally identical. This is the least disruptive repair because it gives the required package identity a precise cryptographic meaning without changing the already-observed distribution fingerprint for the same immutable release.

## Preserved boundaries

- No database schema or persistent release state changes.
- No publication or distribution lifecycle changes.
- No DataGate repository or database access.
- No direct DataGate-to-RDL database mutation.
- RDL-054 exact multi-source derivation provenance remains unchanged.
- Same-name entities from different exact source packages remain distinct.
- `effectiveRelationships` remains part of the immutable consumer package when present in the publication payload.
- Existing RDL-051 and RDL-052 contract/schema versions remain unchanged.

## Acceptance

RDL-055R3 is locally acceptable when:

- manifest and package handlers load and answer authenticated requests;
- release 17 remains visible as the active Project/L4 qualification release;
- public manifest schema is `rdl-distribution-manifest/v1`;
- public package schema is `rdl-distribution-package/v1`;
- `packageChecksum` is a 64-character SHA-256 and recomputes from the immutable package body;
- the existing `distributionSha256` remains unchanged for release 17;
- RDL-052 compatibility changes from rejection to pass;
- the qualification package still contains 53,077 effective relationships;
- the RDL-054 Company composite still has two exact L1 contributors;
- the two exact `percent` / `CFIHOS-60000001` source entities from CFIHOS and CCUS remain separately addressable;
- regression, build, lint, and preserved RDL contracts remain green.
