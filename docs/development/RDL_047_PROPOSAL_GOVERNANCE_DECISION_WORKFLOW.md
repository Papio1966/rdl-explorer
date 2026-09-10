# RDL-047 - Proposal Governance Decision Workflow

## Purpose

RDL-047 hardens the external proposal bundle review capability into an explicit governed decision workflow. It builds on RDL-044, RDL-045 and RDL-046. RDL Explorer remains the standards, proposal, promotion and publication authority. DataGate remains a controlled consumer and project validation engine.

## Decision actions

The governed proposal bundle decision actions are:

- `start_review`
- `accept`
- `reject`
- `withdraw`
- `link_publication`

Every decision requires a reviewer identity, rationale and optimistic `expectedVersion`. Rationale is mandatory and bounded to avoid silent or low-quality governance decisions.

## Fail-closed acceptance

Acceptance must fail closed when any of these are true:

- the bundle has not passed schema validation;
- the bundle is an `incomplete_candidate`;
- the bundle has unresolved required dependencies;
- the bundle is already terminal (`accepted`, `rejected`, or `withdrawn`).

Readback continues to expose `canAccept`, `reviewState`, `failClosedReason`, `missingDependencyCount` and `completenessStatus` so UI and consumers can display safe decision state.

## Audit and publication boundary

Decision events preserve actor, rationale, evidence, timestamp and version semantics through the existing proposal bundle review repository and database function. Acceptance does not publish automatically. Publication linkage remains a separate explicit `link_publication` action.

## UX boundary

RDL-047 adds a reusable governance action surface for proposal bundles. The UI surface shows the review version, disables unsafe decisions, blocks acceptance when `canAccept` is false and displays fail-closed reason text.

## Out of scope

- DataGate implementation changes.
- Direct DataGate-to-RDL database mutation.
- Automatic promotion or publication.
- Reworking normalized projection or source ingestion.
- Local Playwright; GitHub Browser E2E/accessibility remains authoritative.

## Validation

RDL-047 validation consists of:

- static contract validation for policy, API/service, readback, UX and documentation boundaries;
- database contract validation for the existing proposal bundle review function, event/audit table and optimistic-version/rationale/actor/publication-linkage contract;
- preservation of RDL-044/RDL-045/RDL-046 contract tests;
- application regression, production build and lint baseline validation.
