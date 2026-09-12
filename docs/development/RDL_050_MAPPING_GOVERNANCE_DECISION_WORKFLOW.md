# RDL-050 — Mapping Governance Decision Workflow Hardening

## Objective

RDL-050 hardens the mapping governance workflow introduced by RDL-048. The objective is to prevent reviewers from making a governed mapping decision from a label alone.

The reviewer must see:

1. the evidence compared;
2. the exact governed decision type;
3. the proposed consequence;
4. what remains unchanged;
5. downstream consumer impact;
6. the audit/readback data retained for future governance.

## Governed decision options

RDL-050 uses five explicit mapping governance decisions:

- Confirm same concept / merge candidate;
- Keep as separate concepts;
- Reject match;
- Retire / supersede one concept;
- Request further analysis.

These replace ambiguous approval-style language for mapping governance decisions. They also separate a true equivalence decision from a decision to keep two similar concepts apart.

## Evidence comparison dimensions

The workflow must prompt reviewers to compare at least:

- concept / class name;
- description / definition;
- properties;
- relationships;
- documents;
- units and controlled values;
- Source standard and envelope level.

## Consequence preview

Before a reviewer records a decision, the page should show a pre-confirmation consequence preview covering:

- proposed standards change;
- unchanged items;
- downstream consumer impact;
- DataGate / project-validation impact;
- reversibility and follow-up checks.

## Audit and readback

RDL-050 represents audit/readback fields for:

- decision type;
- rationale;
- evidence basis;
- reviewer role;
- timestamp;
- reversibility status;
- related publication or follow-up state.

## Product boundary

RDL Explorer governs standards, mappings, publication, distribution and consumer contracts. DataGate consumes published standards and validates project data. RDL-050 does not introduce project CIS authoring, EPC submission validation or DataGate mutation into RDL Explorer.

## Macro-gate 2 scope

Macro-gate 2 is a local implementation and validation gate only. It must not commit, push, create a PR, merge, mutate GitHub, mutate DataGate, mutate the persistent database or run local Playwright.
