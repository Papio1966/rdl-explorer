# RDL-055R — Multi-RDL publication provenance and relationship-closure repair

## Why this repair exists

The RDL-055 live qualification recovery proved that RDL-054 persistence works: a governed higher-layer object can retain exact contributors from more than one Industry/L1 source. The real publication/distribution path still had three blockers:

1. `rdl.context_package_pin` allowed only one package per layer type, which cannot represent a Company/L2 composition based on two Industry RDL packages.
2. RDL-054 derivation provenance was not copied into immutable effective-standard publication or exposed through the public distribution package.
3. The public distribution package did not carry authoritative `effectiveRelationships`, so DataGate could verify package integrity but could not prove semantic relationship closure.

A fourth defect was found in the legacy pin guard: active contexts blocked UPDATE/DELETE but not INSERT.

## Locked decisions

- Industry packages remain immutable and independently addressable.
- A governed context may pin multiple exact packages at the same layer. Precedence remains unique within the context and duplicate context/layer/package pins remain prohibited.
- Active contexts reject INSERT, UPDATE and DELETE of package pins.
- RDL-054 compositions remain the authority for higher-layer derivation provenance.
- New publications snapshot exact composition contributors, component decisions and authoritative relationships into the immutable publication payload.
- `rdl-distribution-manifest/v1` and `rdl-distribution-package/v1` remain the public schemas; the repair is additive for new releases.
- Legacy releases that do not contain relationship/provenance snapshots are not retroactively decorated with synthetic bytes.
- Same-name source entities remain distinct. The distribution projection also keeps inherited identity package-aware, so even the same entity type + same native identifier in two exact source packages is not silently collapsed. Publication of a governed composition is not a declaration that the source entities were automatically equivalent.
- DataGate remains a read-only public-contract consumer. It does not query RDL Explorer tables and does not own composition.

## Public derivation shape

Each published derived object may contain `rdl-entity-derivation/v1` evidence with:

- composition id and kind;
- exact target extension id;
- source key/id;
- release key/id;
- package key/id;
- source entity id/type/native identifier;
- contributor role and source snapshot;
- component-level governance decisions;
- explicit boundary flags showing exact source identity is retained and same-name automatic equivalence is false.

The same derivation is available in the immutable publication manifest/payload and on the corresponding effective distributed entity.

## Relationship closure

For new publications the publication service snapshots authoritative relationships from every exact pinned package into `package_payload.effectiveRelationships`. The distribution package returns that stored snapshot. This avoids inventing relationships and gives DataGate the semantic closure it previously lacked.

## RDL-055 live proof hardening

The RDL-055 verifier still uses `rdl-live-datagate-integration-proof/v1`, but a boolean `multiSourceProvenancePreserved=true` is no longer sufficient. Live evidence must now include:

- at least two distinct exact contributor identities;
- contributors from at least two distinct RDL sources;
- manifest and package evidence references;
- a non-empty authoritative relationship-closure count and package evidence reference.

The final acceptance gate will still validate the referenced public evidence files; this type-level verifier is not a substitute for the public API evidence.

## Migration

Migration 027:

- removes only the obsolete `UNIQUE(context_id, layer_type)` constraint;
- adds `UNIQUE(context_id, layer_type, package_id)`;
- preserves `UNIQUE(context_id, precedence)` from RDL-016;
- expands the active-context pin trigger to INSERT/UPDATE/DELETE.

No source package, source entity, source relationship, RDL-054 composition, historical publication or DataGate state is rewritten.
