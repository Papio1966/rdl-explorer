# RDL-055R2 - Durable Publication-to-Distribution Enrollment

## Problem

RDL-019 introduced `rdl.effective_standard_distribution` with a one-time backfill for releases that existed when migration 010 ran. Releases published later were readable through a LEFT JOIN and an application-side `active` fallback, but they did not receive an auditable persistent lifecycle row.

The RDL-055 live qualification exposed this gap after publishing the genuine Project/L4 release `rdl055-qualification-project-release / 1.0.0`.

## Decision

Migration 028 introduces an idempotent database lifecycle primitive:

- `rdl.ensure_effective_standard_distribution(release_id)` creates the missing lifecycle row and otherwise returns the existing row without changing it;
- `trg_enroll_effective_standard_distribution` invokes that primitive after every future insert into `rdl.effective_standard_release`;
- an additive one-time backfill enrolls releases published between migration 010 and migration 028;
- existing active, deprecated, or superseded lifecycle rows are never rewritten by enrollment.

The existing RDL-020 publication notification trigger remains authoritative for `release.published` notifications. RDL-055R2 does not add a second notification and does not auto-stage or auto-activate a consumer.

## Invariants

1. `rdl.effective_standard_release` remains immutable.
2. Exactly one distribution row exists per effective-standard release.
3. New rows use the existing RDL-019 defaults (`active`, compatibility contract `rdl-distribution/v1`, minimum consumer version `1.0`).
4. Repeated enrollment is idempotent.
5. Enrollment never changes an existing lifecycle state or deprecation/supersession metadata.
6. Public distribution schemas remain `rdl-distribution-manifest/v1` and `rdl-distribution-package/v1`.
7. RDL-055R multi-RDL provenance and `effectiveRelationships` remain unchanged.
8. DataGate remains a read-only public-contract consumer with no direct database access.

## RDL-055 recovery consequence

Applying migration 028 intentionally enrolls the already-published RDL-055 qualification release into a persisted `active` distribution lifecycle. Once RDL-055R2 is merged and closed, upstream recovery can resume with authenticated catalogue, manifest, and package validation rather than direct distribution-table mutation.
