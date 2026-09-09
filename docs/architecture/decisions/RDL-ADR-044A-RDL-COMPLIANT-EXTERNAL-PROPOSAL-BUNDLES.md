# RDL-ADR-044A: RDL-compliant external proposal bundles and promotion lifecycle

**Status:** Accepted  
**Date:** 2026-09-09  
**Applies to:** RDL Explorer, DataGate integration, RDL-044, future RDL-045  
**Related work:** RDL-043 Normalized Projection Completeness; RDL-044 DataGate external standards proposal contract; DataGate 022B-02

## 1. Context

RDL Explorer is the standards system of record for governed RDL content. It owns standards source ingestion, normalization, governance, package publication and release history.

DataGate is a standards consumer and enforcement engine. It validates delivered project and asset information against the applicable governed standards package/release. DataGate must not become a parallel RDL authoring or standards-maintenance authority.

However, DataGate can discover real project execution gaps. For example, a project may need a new maintainable class such as `vacuum toilet`, or may need a new equipment class, tag class, document type, document type-discipline relationship, discipline, property, controlled list, controlled value or unit-of-measure constraint.

RDL-044 established the external standards proposal contract that allows DataGate to submit candidate standards-layer changes to RDL Explorer without directly mutating RDL Explorer internal tables.

The additional architectural decision captured here is that a DataGate-originated proposal must not be a loose object label. It must be a governed, RDL-compliant delta bundle that is complete enough for RDL Explorer to validate, review, promote and publish.

## 2. Decision

RDL Explorer remains the authoritative master for L1/L2/L3/L4 RDL governance and release publication.

DataGate may originate project-local candidate needs and may submit them to RDL Explorer through the RDL-044 external proposal contract. DataGate must not directly update RDL Explorer RDL entities, packages, releases, extension tables or source ingestion tables.

A submitted standards proposal shall be modeled as an **RDL-compliant delta bundle**, not as a single name or ad hoc label.

A delta bundle may include:

- root object deltas, such as a new tag class, equipment class, document type, discipline, property, controlled list, controlled value or unit of measure;
- dependency deltas, such as missing parent classes, value lists, UOM constraints, source standards or discipline definitions;
- relationship deltas, such as entity-parent, class-property, class-document, document-discipline, property-controlled-list, controlled-list-value, property-group, information-requirement and source-standard relationships;
- source evidence, including project evidence, EPC rationale, maintenance rationale, asset engineering evidence and standards owner review notes;
- governance metadata, including proposer identity, consumer identity, source level, target level, parent package/baseline, promotion target, idempotency key, review lifecycle and publication result.

RDL Explorer shall accept, reject, enrich, govern, promote and publish proposal bundles. DataGate shall consume only governed published packages/releases through explicit pull, staging and activation.

## 3. Layering and promotion

Proposal source and target levels shall be explicit.

```text
L1 Industry RDL
  CFIHOS / JIP36 / standards body release

L2 Company / Enterprise RDL
  company-governed extension layer

L3 Asset RDL
  asset-governed extension layer

L4 Project / CIS RDL
  project-specific effective requirement context
```

Promotion is never automatic.

Promotion from L4 to L3, L3 to L2, or L2 to an L1 industry-body proposal shall create a new governed target-level proposal/release. It shall not rewrite the lower-level origin or any frozen project baseline.

An L1 industry-body proposal is not an accepted industry standard. If the standards body later accepts the proposal, RDL Explorer shall ingest the official published industry release as the new L1 authority and link the earlier company/asset/project object as provenance, equivalence or successor evidence as appropriate.

## 4. RDL-compliant bundle requirements

### 4.1 New tag class or equipment class

A new class proposal shall include, or explicitly declare as missing:

- class type: tag class or equipment class;
- proposed identifier strategy;
- name and definition;
- parent class or hierarchy position;
- classification rationale;
- applicable source level and target level;
- exact parent package/release/baseline;
- related properties;
- applicable document types;
- related disciplines where relevant;
- UOM constraints where relevant;
- controlled lists or picklists where relevant;
- source standards or source evidence;
- external identifiers or aliases if known;
- proposer, reviewer and governance metadata.

A label such as `vacuum toilet` is not RDL-compliant by itself.

### 4.2 New property

A property proposal shall include, or explicitly declare as missing:

- property identifier strategy;
- name and definition;
- datatype;
- value domain;
- UOM requirement, where applicable;
- controlled list or picklist, where applicable;
- applicable class relationships;
- required/optional/default requirement semantics where applicable;
- source evidence and governing context.

### 4.3 Controlled list, picklist and controlled values

A controlled-list proposal shall include, or explicitly declare as missing:

- controlled list identifier strategy;
- controlled list name and definition;
- allowed values;
- value codes and value descriptions;
- value order, if meaningful;
- lifecycle status;
- source evidence;
- property relationship.

### 4.4 Unit of measure

A UOM proposal shall include, or explicitly declare as missing:

- unit identifier strategy;
- unit name and symbol;
- measurement quantity or dimension;
- permitted use;
- related property;
- conversion or equivalence metadata where required;
- source evidence.

### 4.5 Document type

A document type proposal shall include, or explicitly declare as missing:

- document type identifier strategy;
- document type name and definition;
- discipline applicability;
- class applicability;
- document requirement relationships;
- source standard or evidence;
- lifecycle status.

### 4.6 Discipline and document type-discipline relationship

A discipline proposal shall include, or explicitly declare as missing:

- discipline identifier strategy;
- discipline code and name;
- definition and scope;
- parent/grouping where applicable;
- related document types;
- source evidence.

A document type-discipline proposal shall identify both endpoints, the relationship type, applicability context, baseline package and evidence.

## 5. Proposal lifecycle states

The proposal lifecycle should support at least the following logical states:

```text
draft
submitted
schema_validated
incomplete_candidate
in_review
approved_for_project
approved_for_asset
approved_for_company
rejected
withdrawn
published
promoted
```

A project-local candidate may be operationally useful before it is complete. Such a candidate may be stored as `incomplete_candidate`, but it is not publishable as governed RDL content until the required completeness gates pass.

## 6. Required validation gates

RDL Explorer shall validate proposal bundles using gates equivalent to:

| Gate | Required outcome |
| --- | --- |
| Identity gate | Identifiers are unique in the target context and do not misuse industry IDs. |
| Baseline gate | The proposal references the exact parent package/release/baseline. |
| Object completeness gate | Required fields for each object type are present or explicitly marked missing. |
| Dependency closure gate | Referenced properties, lists, values, UOMs, document types, disciplines and source standards exist or are included in the bundle. |
| Relationship validity gate | Relationship types are valid for their source and target entity types. |
| Evidence gate | Source evidence and rationale are sufficient for the requested target level. |
| Collision/idempotency gate | Duplicate or similar existing objects are detected and idempotent replay is safe. |
| Promotion gate | Promotion is allowed only from an approved lower-level object and only to an allowed target level. |
| Publication gate | No unresolved mandatory completeness gaps remain before governed release publication. |

## 7. Vacuum toilet example

A project may discover that `vacuum toilet` is needed as a distinct maintainable equipment class.

DataGate may record a project-local candidate for operational use, but authoritative RDL promotion follows this path:

```text
DataGate L4 project candidate
  -> RDL Explorer external proposal bundle
  -> RDL Explorer validates bundle completeness
  -> RDL Explorer accepts/rejects/enriches as L4 project extension
  -> optional L4 to L3 asset promotion
  -> optional L3 to L2 company promotion
  -> optional L2 to L1 industry-body proposal
  -> official industry release is authoritative only after external acceptance and ingestion
```

The bundle should include the proposed class, parent class, definition, properties, UOM/picklist dependencies, applicable document types, discipline relationships, source evidence and target-level rationale.

## 8. Consequences

### 8.1 Positive consequences

- DataGate can capture real project needs without becoming a standards master.
- RDL Explorer remains the single governed standards authority.
- L4 project needs can be promoted safely to L3, L2 and eventually L1 proposal status.
- Frozen project baselines remain reproducible and are not rewritten by later promotions.
- Standards-body proposals remain distinct from accepted industry standards.
- The proposal process can support full RDL objects rather than weak labels.

### 8.2 Costs and obligations

- RDL Explorer must implement richer proposal-bundle validation beyond the initial RDL-044 intake contract.
- DataGate must distinguish local operational candidates from governed RDL proposal bundles.
- Governance reviewers must enrich incomplete candidates before publication.
- Idempotency, collision detection and dependency closure become mandatory for production proposal flows.

## 9. Non-goals

This decision does not authorize:

- direct DataGate writes to RDL Explorer internal tables;
- DataGate-owned CFIHOS or source workbook ingestion;
- automatic L4-to-L3 or L3-to-L2 promotion;
- automatic acceptance into an industry standard;
- publication of name-only classes, properties or documents;
- rewriting frozen project baselines after promotion.

## 10. Follow-up implementation recommendation

The next RDL Explorer implementation milestone should be:

```text
RDL-045 - RDL-compliant proposal bundle completeness
```

RDL-045 should define the machine-readable delta-bundle schema, validation gates, incomplete-candidate handling, dependency closure rules and promotion-readiness checks needed to make RDL-044 production-grade for DataGate-originated candidate standards changes.

DataGate 022B-02 should consume this decision as a constraint: DataGate may create local project candidates and submit proposal bundles, but the authoritative RDL object, promotion and release remain governed by RDL Explorer.
