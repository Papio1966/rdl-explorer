# RDL-053 — Consumer Release Inbox / Pull Receipt Operational Readiness

## Status

Implementation candidate for Macro-gate 2.

## Purpose

RDL-053 hardens the operational handoff created by RDL-051 and proven by RDL-052. A DataGate-like consumer must be able to retain an explicit receipt describing which governed release/package it pulled, when it pulled it, whether the distribution contract and integrity checks passed, whether the content is current, and whether that exact pull is safe to use for project validation.

The receipt is an operational consumer artefact. It is not a new governance decision, release state, subscription acknowledgement, or RDL database record.

## Architecture decision

RDL-053 uses **consumer-owned persistence**. RDL Explorer defines the receipt contract and reference construction logic, while the consuming application decides whether and how to persist receipts in its own bounded context.

There is **no RDL acknowledgement endpoint** for package pulls. This preserves the RDL-051/RDL-052 boundary: DataGate-like consumers use **read-only API/contract consumption** and do not need a write credential against RDL Explorer merely to record what they consumed.

Direct DataGate-to-RDL database mutation remains prohibited.

This decision deliberately keeps package-pull evidence separate from the existing RDL consumer-integration notification acknowledgement workflow. Notification acknowledgement is an RDL-owned operational workflow; a package pull receipt is evidence owned by the consumer that performed the pull.

## Receipt contract

Schema version: `rdl-consumer-pull-receipt/v1`

Contract version: `v1`

The receipt carries:

- consumer key;
- canonical pull timestamp;
- deterministic receipt key for idempotent handling of the same pull;
- release id, release key, release version and publication status;
- manifest, distribution and optional package SHA-256 values;
- ETag/integrity token;
- the inherited RDL-051/RDL-052 consumer contract identity and schema versions;
- compatibility, release-identity, integrity and freshness verification outcomes;
- normalized verification issues;
- derived receipt status;
- derived `safeToUseForValidation` flag;
- explicit consumer/RDL persistence boundary metadata.

## Derived status vocabulary

The consumer does not assert `safeToUseForValidation` directly. It is derived fail-closed from verification evidence:

- `verified` — contract/schema compatible, release identity verified, integrity verified, and content current;
- `stale` — contract/schema compatible but the content is no longer current;
- `incompatible` — distribution contract or schema is incompatible;
- `rejected` — release identity or integrity verification failed.

Only `verified` is safe to use for validation.

## Idempotency

`receiptKey` is deterministic across the consumer key, exact release identity, distribution checksum and canonical pull timestamp. Retrying persistence of the same constructed receipt therefore reuses the same key. A genuinely later pull receives a different key while still retaining the same governed release/package identity if the package has not changed.

## Ownership boundary

RDL Explorer owns:

- governed standards and releases;
- publication/distribution APIs;
- distribution contract/schema versions;
- package/manifest identity and integrity metadata;
- the portable pull-receipt schema/reference logic.

The consumer owns:

- the act of pulling/caching/pinning a package;
- local receipt persistence;
- local association of a receipt with project validation runs;
- blocking validation when the receipt is not `verified`;
- retention/history policy for its receipts.

RDL-053 does not mutate DataGate, create a DataGate database dependency, add an RDL database table, or add a consumer-to-RDL receipt POST API.

## Validation scope

Macro-gate 2 must prove:

1. the receipt inherits the RDL-051/RDL-052 contract identity and schema versions;
2. verified content produces a safe receipt;
3. stale, incompatible and integrity/release-identity failures fail closed;
4. receipt keys are stable for an identical pull and distinct for a later pull;
5. malformed identity/checksum/timestamp inputs are rejected;
6. the implementation contains no RDL database persistence or POST/write-back path;
7. RDL-051, RDL-052, regression, build and zero-warning lint remain green;
8. no DataGate mutation is performed.

Local Playwright is not required. GitHub Browser E2E/accessibility remains authoritative in Macro-gate 4.
