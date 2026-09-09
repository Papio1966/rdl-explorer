# RDL-044 — DataGate external standards proposal contract

## Purpose

RDL-044 defines the upstream proposal boundary that allows DataGate, or another governed consumer, to submit candidate standards-layer changes to RDL Explorer without bypassing RDL Explorer governance.

The contract exists because DataGate is a standards consumer and enforcement engine. RDL Explorer remains the standards governance, source-ingestion, normalization and publication authority.

## Architecture decision

DataGate does not write RDL Explorer internal tables, does not ingest CFIHOS workbooks, and does not silently promote project content into Asset, Company or Industry standards.

Instead, DataGate may submit an external standards proposal to RDL Explorer. RDL Explorer stores that proposal in a quarantined, idempotent proposal table and exposes review transitions through the RDL Explorer governance boundary.

The boundary follows the existing integration principle:

```text
push notification, pull content
```

DataGate may notify or propose. RDL Explorer governs and publishes. DataGate later pulls the governed package/release through the existing publication and distribution APIs.

## Contract scope

The proposal contract captures:

- proposal identity and idempotency;
- consumer and proposer identity;
- source system and source level;
- target level and target context;
- parent package or baseline;
- proposed entity and relationship deltas;
- source evidence;
- rationale;
- optional promotion target;
- review status and optimistic review version;
- append-only event history;
- optional publication result metadata.

## Explicit non-goals

RDL-044 does not:

- mutate DataGate;
- mutate RDL Explorer source records;
- mutate RDL-041/RDL-043 accounting history;
- create context extension changes automatically;
- publish effective standards automatically;
- activate DataGate baselines automatically;
- collapse L1/L2/L3/L4 provenance.

## Lifecycle

```text
DataGate proposal
      |
      v
external_standards_proposal: received
      |
      +-- start_review --> in_review
      |
      +-- reject -------> rejected
      |
      +-- withdraw -----> withdrawn
      |
      +-- accept -------> accepted
      |
      +-- link_publication (accepted only)
```

Acceptance means the RDL Explorer governance team has accepted the proposal record as suitable for standards governance processing. It does not mean automatic project-to-asset/company promotion.

## Relationship to existing RDL Explorer capabilities

RDL-044 is deliberately additive. It uses the current RDL Explorer direction already established by:

- enterprise contexts and exact package pins;
- governed extension changes;
- effective publication;
- package distribution;
- consumer notification and pull/stage/activate lifecycle;
- RDL-043 semantic projection completeness.

The external proposal contract is the missing upstream intake layer between DataGate findings and RDL Explorer standards governance.

## DataGate boundary

DataGate should use this contract to submit candidate improvements such as:

- new maintainable equipment classes identified during project execution;
- asset-specific or company-specific extension requests;
- corrections discovered during validation;
- proposed relationship deltas and supporting evidence.

DataGate must still pull and activate governed packages through the distribution/consumer integration contract after RDL Explorer publication.
