# RDL-052 - Distribution Consumer Compatibility Harness for DataGate Consumers

## Purpose

RDL-052 proves that the RDL-051 publication/distribution contract is usable by a downstream application such as DataGate without coupling DataGate to RDL Explorer internals.

The sprint adds an RDL-side compatibility harness. The harness behaves like a strict external consumer and verifies that a governed distribution manifest and package can be accepted before project validation starts.

## Consumer contract identity

The compatibility harness is pinned to these consumer-facing values:

- consumer contract id: `rdl-distribution-consumer`;
- consumer contract version: `v1`;
- manifest schema version: `rdl-distribution-manifest/v1`;
- package schema version: `rdl-distribution-package/v1`.

These values are part of the external contract. A DataGate-like consumer must reject content with a missing or incompatible contract identity.

## Required consumer fields

A compatible consumer payload must expose and preserve these fields:

- release id;
- release key;
- release version;
- publication status;
- generated timestamp;
- manifest checksum;
- package checksum;
- distribution checksum;
- ETag or equivalent integrity token.

The fields are required so a consumer can prove which governed release it consumed, detect stale content and avoid validating a project against an unknown or drifting standards package.

## Compatibility checks

The harness checks the manifest/package contract before project validation. It must reject content when:

- the contract id is not `rdl-distribution-consumer`;
- the contract version is not `v1`;
- the manifest schema version is not `rdl-distribution-manifest/v1`;
- the package schema version is not `rdl-distribution-package/v1`;
- release identity fields are missing;
- integrity fields are missing;
- the current release identity does not match the previously pinned release identity;
- a stale content signal is detected;
- a direct DataGate-to-RDL database mutation is attempted.

A rejection must happen before project validation. DataGate must not continue validation with stale, incomplete or incompatible RDL distribution content.

## DataGate consumer boundary

DataGate consumption remains read-only API/contract consumption.

Allowed consumer actions:

- read the distribution catalogue;
- read a distribution manifest;
- download a governed distribution package;
- compare release identity and checksum values;
- reject stale or incompatible content before project validation;
- store consumed package identity in DataGate for traceability.

Not allowed:

- direct DataGate-to-RDL database mutation;
- DataGate updating RDL Explorer governance, publication or promotion state;
- RDL Explorer mutating DataGate project validation state;
- project CIS authoring or tailoring in RDL Explorer;
- DataGate project validation logic moving into RDL Explorer.

## Harness model

The RDL-052 model defines:

- the required contract identity;
- the required consumer fields;
- the DataGate consumer boundary;
- a compatible sample payload;
- stale content and incompatible contract rejection behavior;
- a pre-validation gate outcome of `reject_before_project_validation` when compatibility checks fail.

## Macro-gate 2 validation

Macro-gate 2 must prove that:

- RDL-052 documentation exists and defines the compatibility harness;
- the compatibility model pins required DataGate consumer fields;
- the static contract test exercises compatible, stale, incompatible and direct-database-mutation cases;
- stale or incompatible content is rejected before project validation;
- DataGate consumption remains read-only and API/contract based;
- direct DataGate-to-RDL database mutation remains prohibited;
- RDL-051, RDL-050, RDL-049, RDL-048, RDL-046, RDL-045, RDL-044 and package distribution contracts remain green when present on current main;
- database preservation checks run without persistent mutation;
- regression passes;
- build passes;
- lint remains `0 warnings / 0 errors`;
- no commit, push, PR, merge, persistent database mutation, DataGate mutation or local Playwright run occurs.
