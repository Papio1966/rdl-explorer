# RDL-038.2 — Targeted Hierarchy Runtime Read

## Decision

RDL-038.1 proved that exact PostgreSQL entity and relationship lookups are fast and that the expensive path is the release-wide runtime relationship projection. RDL-038.2 therefore optimizes only the browser hierarchy relationship family (`entity_parent`).

## Invariants

1. Runtime identity remains `source + release + entity type + source-native identifier`.
2. The exact validated package for the requested source/release remains authoritative.
3. Only stored `entity_parent` relationships are returned by the fast path; no hierarchy is inferred.
4. Source-native identifiers and source locator provenance are preserved.
5. Runtime relationship API schema remains `rdl-runtime-relationships/v1`.
6. Non-`entity_parent` relationship families remain on the existing generic projection path.
7. JSON/dual runtime rollback/parity contracts remain unchanged.
8. No database schema/index change is introduced.
9. DataGate's shared RDL package/entity/relationship semantics are unchanged.

## Performance boundary

Before RDL-038.2, an `entity_parent` API request loaded all entities and all raw relationships for a release, generated the complete derived relationship graph, and only then filtered to `entity_parent`.

After RDL-038.2, `entity_parent` reads select only persisted parent relationships for the exact validated package and map them directly to the existing runtime record shape.
