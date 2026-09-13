# RDL-055 — Live DataGate ↔ RDL Integration Proof

## Macro-gate 2 decision

Macro-gate 1 found no blocking RDL contract gap. The proposal-bundle, governance/readback, publication, distribution, compatibility, pull-receipt and multi-RDL provenance contracts already exist. The RDL-side missing capability is one deterministic acceptance harness that correlates evidence across those contracts and fails closed when any mandatory link or negative path is missing.

RDL-055 therefore adds a **public contracts only** evidence verifier. It does not add a database migration, does not create a DataGate dependency inside the RDL repository, and does not introduce a cross-product write path.

The local Macro-gate 2 test uses a synthetic fixture solely to prove the verifier itself. It **does not claim that the synthetic fixture is a live DataGate execution**. Formal RDL-055 cross-product acceptance still requires evidence produced by the DataGate stream against the merged RDL-055 contract.

## Correlation contract

A valid first-slice proof must correlate:

1. one DataGate external request/idempotency key;
2. the stable RDL proposal-bundle identity returned for that request;
3. the accepted standards-owner governance decision and audit identity;
4. an explicit publication link to one immutable RDL release;
5. the same release through the read-only distribution contract;
6. compatible manifest/package schema versions and SHA-256 integrity evidence;
7. a consumer-owned RDL-053 pull receipt with status `verified` and `safeToUseForValidation=true`;
8. RDL-054 multi-source provenance where the published fixture is a derived higher-layer object;
9. evidence that same-name source objects were not collapsed by name;
10. evidence that the historical project baseline remains unchanged after later publication.

The public release identity is the cross-product correlation point after publication. A consumer does not need RDL-internal table identifiers or direct SQL access to prove the package it consumed.

## Mandatory scenarios

The verifier requires all of the Macro-gate 1 scenarios:

- positive L4 proposal → governance → publication → pull/verify → verified receipt;
- positive multi-source provenance consumption;
- idempotent proposal replay;
- incomplete proposal rejection;
- unauthorized proposal/governance rejection;
- rejected governance does not publish;
- unknown release/package rejection;
- incompatible schema rejection;
- integrity mismatch rejection;
- stale/superseded content blocked from silent activation;
- same-name/different-source objects not auto-equated;
- no DataGate-to-RDL database access;
- no RDL-to-DataGate database mutation;
- frozen historical project baseline preserved.

A missing or failed mandatory scenario makes the combined proof fail.

## Product boundary

RDL Explorer owns standards ingestion, semantic governance, composition, promotion, publication and distribution contracts. DataGate consumes exact governed releases, performs project validation and originates L4 proposal bundles.

**DataGate-to-RDL database access remains prohibited.**

**RDL-to-DataGate database mutation remains prohibited.**

RDL Explorer does not need DataGate database credentials, and DataGate does not need RDL database credentials. The integration proof must be reconstructible from API/contract evidence and consumer-owned receipts.

## RDL-054 preservation

The first live cross-product evidence must include at least one governed higher-layer object whose RDL-054 multi-source provenance identifies multiple exact L1 contributors. DataGate consumes the published governed identity and provenance. It must not recreate the composition engine or infer equivalence from a display name.

A successor source or Company/Asset publication must not rewrite the historical project baseline used by an existing validation run.

## Macro-gate 2 exit

Macro-gate 2 passes when:

- the verifier and its fail-closed negative tests pass;
- RDL-045, RDL-047, RDL-051, RDL-052, RDL-053 and RDL-054 preservation tests remain green;
- regression, build and 0/0 lint remain green;
- the exact repository scope is limited to the RDL-055 verifier, test and this architecture document;
- no database, GitHub or DataGate mutation is performed by the local validation package.

After merge, the DataGate stream can execute the actual cross-product slice and return the evidence envelope for formal RDL-055 live acceptance.
