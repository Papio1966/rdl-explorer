# RDL-054 — Multi-RDL Composition, Collision Resolution & Derived Provenance

## Decision

RDL Explorer owns Industry/Company/Asset/Project RDL governance. DataGate remains a consumer of governed releases and an originator of L4 proposal bundles; it does not own Company/Asset composition or promotion.

L1 external releases remain immutable. An L2 Company context may pin multiple exact L1 packages. Same-name objects may coexist because identity is source/release/package/type/native-id based; **same name does not mean semantic equivalence**. Exact-name logic may only create a collision/mapping candidate that requires governed human review.

When the RDL Custodian decides to create one target-layer object from multiple source objects, RDL-054 records a new target extension/change plus a first-class composition record. Every contributor retains exact provenance to its source package and entity. Source entities are never rewritten.

## Deep comparison and component-level resolution

The custodian decision must expose differences beyond the label. The contract compares definition, hierarchy, properties, attributes, document requirements, disciplines, information requirements and relationships. Resolution is **component-level** and may use one source, combine several contributors, define a target-layer override, retain items separately, exclude an item or keep it as a reference.

The target object therefore has its own stable identity and exact provenance back to every contributing source-object version.

## Source upgrade behavior

A later L1 release never changes an existing L2/L3/L4 release. The composition dependency projection identifies which derived target objects depend on a changed source release. Existing release-impact and controlled-adoption workflows can then assess a possible successor Company/Asset/Project release. Historical packages and project pins remain unchanged until an explicit new governed release/adoption occurs.

## Promotion

Project→Asset and Asset→Company promotion continues to clone/create a new governed target-layer draft with provenance. RDL-054 adds an advisory promotion-candidate projection over approved lower-layer extensions. It **never automatically promotes** an object.

## Product boundaries

- RDL Explorer: source ingestion, collision/equivalence governance, composition, derivation provenance, promotion, versioning and publication.
- DataGate: pull/verify/stage/activate exact governed releases; validate project information; originate complete L4 proposal bundles.
- DataGate remains a consumer. Direct DataGate-to-RDL database access or mutation is prohibited.

## Implementation scope

Macro-gate 2 adds:

1. first-class `entity_composition` persistence linked to the existing target extension/change;
2. exact source package/entity contributors;
3. auditable component-level decisions;
4. a dependency view and release-impact query hook;
5. advisory upward-promotion candidate reporting;
6. a deterministic TypeScript collision/comparison/composition contract.

This deliberately reuses existing cross-RDL mapping governance and enterprise extension governance instead of creating a second review lifecycle.
