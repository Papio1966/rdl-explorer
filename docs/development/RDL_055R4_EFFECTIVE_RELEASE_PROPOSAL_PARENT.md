# RDL-055R4 - Effective Project Release Proposal Parent Contract

## Purpose

RDL-055R4 extends the RDL-044/RDL-045 external proposal boundary so a proposal may be parented by either an exact legacy raw package or one immutable effective standard release. It exists because a governed multi-RDL Project/L4 release is not equivalent to any one inherited L1 package.

## Parent modes

Exactly one parent mode is valid:

- `parentPackageId` - legacy raw package parent, preserved unchanged for historical/single-package callers.
- `parentEffectiveReleaseId` - immutable `rdl.effective_standard_release` parent.

The two identifiers are mutually exclusive in both service validation and database constraints. `parentPackageId` is never overloaded with a release ID.

For effective-release mode, RDL Explorer validates that the release exists, its enterprise context key equals `targetContextKey`, and its context type equals the target level. If `sourceEvidence.parentEffectiveReleaseCompositionSha256` (or `sourceEvidence.parentEffectiveRelease.compositionSha256`) is supplied, it must equal the authoritative release composition SHA-256.

## Dependency closure

Legacy package mode keeps the existing exact package lookup.

Effective-release mode resolves `existing_governed_object` against the immutable release projection: exact package pins plus governed effective changes from that release. The helper proves existence without introducing name-based equivalence and without selecting one inherited package as the Project parent.

## Readback

Proposal and bundle queue/readback surfaces expose:

- `parentMode`;
- optional raw package ID/key;
- optional effective release ID;
- effective parent context key/type;
- effective release key/version;
- effective release composition SHA-256.

The proposal record does not duplicate the full multi-RDL composition.

## Governance and idempotency

Existing review/publication semantics are unchanged. A replay with the same request key and canonical hash must use the same parent mode and exact parent identity. Changing parent mode or effective release is an idempotency conflict.

## RDL-055 qualification preservation

Release 17 (`rdl055-qualification-project-release`, version `1.0.0`) remains immutable. RDL-055R4 must not modify its package pins, RDL-054 derivation, public manifest/package checksums, distribution lifecycle, or 53,077 effective relationships. DataGate remains a public-contract consumer and does not access the RDL database directly.
