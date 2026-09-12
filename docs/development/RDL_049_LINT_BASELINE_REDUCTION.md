# RDL-049 — Lint Baseline Reduction / Code Hygiene

## Purpose

Reduce the RDL Explorer lint baseline from 24 warnings / 0 errors to 0 warnings / 0 errors without changing product behaviour.

## Scope

RDL-049 is a code hygiene sprint. It does not introduce new RDL product behaviour, proposal semantics, database migrations, distribution contracts, or DataGate integration changes.

## Warning groups addressed

- `eslint(no-useless-escape)` mechanical string and regex cleanup.
- `eslint(no-unused-vars)` removal or cleanup of unused symbols.
- `eslint(no-unused-expressions)` replacement of expression side effects with explicit control flow.
- `react-hooks(exhaustive-deps)` dependency-array repair using behaviour-preserving dependencies or stable refs where a callback dependency would create an autosave loop.
- `react(only-export-components)` Fast Refresh hygiene by separating the RDL scope hook/context support module from the provider component module.

## Guardrails

- No persistent database mutation.
- No GitHub mutation during Macro-gate 2.
- No DataGate mutation.
- No local Playwright run. Browser E2E/accessibility remains authoritative in GitHub during Macro-gate 4.
- All RDL-048 product-boundary/governance contracts must remain green.

## Acceptance

Macro-gate 2 is acceptable only when local lint reports zero warnings and zero errors, build passes, regression passes, and the RDL-048/046/045/044 contract stack remains green.
