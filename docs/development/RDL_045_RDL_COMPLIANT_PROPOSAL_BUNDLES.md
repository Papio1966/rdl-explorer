# RDL-045 - RDL-compliant external proposal bundle contract

## Purpose

RDL-044 introduced a safe external standards proposal intake boundary for DataGate and other consumers. RDL-045 extends that boundary so one external request can represent one atomic RDL-compliant semantic bundle rather than a single loose object label or a set of unrelated proposals.

The immediate driver is the DataGate project-specific extension scenario. A project may identify a candidate need such as a new maintainable class, document type, discipline relationship, property, controlled list or UOM. That candidate must not become governed RDL until RDL Explorer validates the whole object graph.

## Decision

RDL Explorer remains the standards system of record and publication authority. DataGate remains a controlled standards consumer and proposer. DataGate must not directly mutate RDL Explorer internal tables.

An external proposal bundle is the governed unit of intake for multi-component DataGate PSE-style submissions. The bundle may contain:

- object deltas, such as tag classes, equipment classes, document types, disciplines, properties, controlled lists, controlled values and units of measure;
- relationship deltas, such as entity-parent, class-property, class-document, document-discipline, property-controlled-list and controlled-list-value relationships;
- references to existing governed RDL objects in the parent package or context;
- dependency declarations and dependency-closure evidence;
- source evidence and rationale;
- source level, target level, target context and parent package identity;
- idempotency fields and review/readback state.

## Contract introduced by RDL-045

RDL-045 adds these database objects:

```text
rdl.external_standards_proposal_bundle
rdl.external_standards_proposal_bundle_component
rdl.external_standards_proposal_bundle_dependency
rdl.external_standards_proposal_bundle_event
rdl.external_standards_proposal_bundle_queue
rdl.submit_external_standards_proposal_bundle(...)
rdl.review_external_standards_proposal_bundle(...)
```

The bundle contract is layered on RDL-044. Every bundle owns exactly one RDL-044 external proposal record, so RDL-044 idempotency, identity, review history and publication linkage remain valid.

## Completeness semantics

A bundle can be stored even when incomplete, but it is explicitly classified:

```text
complete
incomplete_candidate
```

A required dependency is satisfied only when it is resolved by:

```text
bundle_component
existing_governed_object
```

A required unresolved dependency remains:

```text
missing
```

An incomplete bundle cannot be accepted by the RDL-045 bundle review function. This prevents a partial object graph from becoming an apparently governed standards candidate.

## Dependency closure

Dependency closure is the RDL-045 validation rule that prevents a partial semantic object graph from becoming an apparently governed standards candidate. Each required dependency must either resolve to another component in the same bundle or to an existing governed object in the parent package/context lineage. Required dependencies that remain missing keep the bundle in incomplete_candidate state and block acceptance.

## Idempotency

The bundle idempotency grain is:

```text
source_system + external_request_key + bundle_sha256
```

The persisted uniqueness guard is:

```text
source_system + external_request_key
```

The same request and same hash returns the existing bundle. The same request and a different hash is rejected as an idempotency conflict.

## Promotion and publication boundaries

Acceptance of a bundle is not publication. Publication remains a separate RDL Explorer action.

Promotion remains an RDL Explorer governance action. DataGate may observe proposal and publication results, but it must not promote Project content to Asset, Company or Industry levels itself.

Historical project execution remains pinned to the exact RDL package, PSE and effective context under which it executed. Promotion creates new governed target-level records and does not rewrite historical project baselines.

## DataGate state

DataGate remains blocked until RDL-045 is merged, CI-green and formally closed.

```text
DATAGATE_022B_02_MAY_RESUME=NO
BlockingReason=RDL-compliant proposal bundle contract must be implemented, merged, CI-green and closed in RDL Explorer before DataGate implements against it.
```
