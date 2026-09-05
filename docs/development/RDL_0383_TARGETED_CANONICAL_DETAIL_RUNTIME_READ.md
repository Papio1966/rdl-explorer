# RDL-038.3 — Targeted Canonical Detail Runtime Read

## Objective

Remove release-wide PostgreSQL relationship materialization from one-entity canonical detail reads while preserving the exact RDL-037.2 browser/API semantics.

## Locked architecture

The public canonical identity remains:

`source + release + entity type + source-native identifier`

`projectRdlEntityDetail()` remains the single semantic projector shared by PostgreSQL authority and JSON rollback/reference. RDL-038.3 changes only the PostgreSQL input projection supplied to that projector.

The targeted projection:

1. resolves the exact validated package for the requested source/release;
2. loads the release entity catalogue once so canonical linked-entity metadata remains exact;
3. loads only stored relationships touching the anchor and its same-type ancestor chain;
4. builds the smallest semantic entity closure needed by existing derived-relationship rules;
5. reuses the existing `projectRelationships()` implementation to preserve relationship attributes and overwrite ordering;
6. retains only relationships directly relevant to the anchor plus `entity_parent` / `class_property` edges needed for inherited class properties;
7. passes that closure to the unchanged `projectRdlEntityDetail()` function.

## Invariants

- No database migration or new index.
- No API schema or browser route change.
- No JSON oracle regeneration.
- No source/release/package fallback.
- No change to `src/rdl/entityDetail.ts`.
- No change to RDL package identity, entity vocabulary, relationship vocabulary, provenance, or hierarchy rules.
- `entity_parent` remains the only authoritative same-type hierarchy edge.
- Historical releases remain explicitly addressable and isolated.
- Missing entities remain `null`; another release/entity is never substituted.
- DataGate-facing RDL package/identity semantics are unchanged.

## Acceptance

RDL-038.3 is locally acceptable only when:

- targeted detail equals the committed JSON oracle for representative CFIHOS, CCUS, Water current, and Water historical identities;
- controlled values, property mappings, source standards, information requirements, units, disciplines, and inherited class detail are represented in the parity set where available;
- RDL-037.2 canonical-detail convergence remains green;
- RDL-038.2 targeted hierarchy remains green;
- RDL-034 and RDL-035 browse contracts remain green;
- production build and `git diff --check` pass;
- no local Playwright is run.
