# RDL-046 - Proposal Bundle Review and Governance UX/API Hardening

## Purpose

RDL-045 created the atomic external proposal bundle contract. RDL-046 turns that contract into a safer operational review surface for RDL Explorer standards owners.

The scope is bounded: RDL Explorer exposes deterministic readback, fail-closed review readiness and a first governance UX surface. DataGate implementation is out of scope.

## Decision

RDL Explorer remains the governance and publication authority. DataGate and other consumers may submit proposal bundles, but they must not directly mutate RDL Explorer tables, promote standards layers or publish standards releases.

RDL-046 adds readback and review support around the RDL-045 tables:

```text
rdl.external_standards_proposal_bundle_queue
rdl.external_standards_proposal_bundle_component
rdl.external_standards_proposal_bundle_dependency
rdl.external_standards_proposal_bundle_event
```

## API contract

RDL-046 adds reviewer-facing readback endpoints:

```text
GET /api/proposals/bundle-queue
GET /api/proposals/bundle-detail?proposalBundleId=<id>
GET /api/proposals/bundle-detail?sourceSystem=DATAGATE&requestKey=<request-key>
```

The queue endpoint exposes deterministic filters for source system, proposal status, completeness status and target context.

The detail endpoint returns:

- queue summary;
- components;
- dependencies;
- event history;
- explicit governance boundary metadata.

## Fail-closed review semantics

A bundle can be accepted only when all of these are true:

```text
validationStatus = schema_validated
completenessStatus = complete
missingDependencyCount = 0
proposalStatus is not terminal
```

Incomplete bundles remain visible but fail closed on acceptance. They are not hidden and must show the reason they cannot be accepted.

## UX contract

RDL-046 adds a first proposal-bundle review page component. The page is intentionally lightweight and is constrained to governance visibility:

- total bundles;
- ready-for-review bundles;
- incomplete fail-closed bundles;
- source system and request key;
- target level and target context;
- component and dependency counts;
- fail-closed status.

The UX must reinforce the governance boundary: acceptance does not publish, promotion remains RDL Explorer only and direct DataGate database mutation is prohibited.

## Out of scope

- DataGate implementation work.
- Direct DataGate-to-RDL database mutation.
- Automatic Project-to-Asset or Project-to-Company promotion.
- Standards publication workflow mutation.
- Cross-bundle dependency resolution beyond explicit fail-closed readback.
- RDL-043 semantic projection changes.
- RDL-042 workbook runtime changes.

## Validation

RDL-046 must preserve:

- RDL-045 proposal bundle contract;
- RDL-044 external proposal contract;
- RDL-043 batch 5;
- RDL-041.2 batch 1;
- RDL-042 runtime authority;
- source-layer counts.
