# RDL-051 - Publication / Distribution Readiness for DataGate Consumers

## Purpose

RDL-051 hardens the consumer-facing publication and distribution contract so DataGate can consume governed standards from RDL Explorer without direct database coupling.

RDL Explorer remains the standards system of record for governance, publication and distribution. DataGate remains a read-only API/contract consumer of governed standards and uses those standards for project validation. RDL Explorer must not mutate DataGate project state, and DataGate must not mutate the RDL Explorer database.

## Consumer contract

The distribution contract is identified by:

- contract id: `rdl-distribution-consumer`;
- contract version: `v1`;
- manifest schema version: `rdl-distribution-manifest/v1`;
- package schema version: `rdl-distribution-package/v1`.

The contract is intentionally explicit about identity and integrity so DataGate can verify what it consumed and detect stale or incompatible content.

## Manifest response requirements

A manifest response must expose consumer-facing metadata for:

- contract id;
- contract version;
- release id;
- release key;
- release version;
- publication status;
- generated timestamp;
- manifest checksum;
- distribution checksum when available;
- ETag or equivalent integrity header;
- stale content detection fields.

The manifest is a preflight object. DataGate can read it before downloading the full package to decide whether a release is known, compatible, current and safe to consume.

## Package response requirements

A package response must expose consumer-facing metadata for:

- contract id;
- contract version;
- release id;
- release key;
- release version;
- publication status;
- generated timestamp;
- package checksum;
- manifest checksum when available;
- distribution checksum;
- ETag or equivalent integrity header;
- content identity.

The package is the governed payload. DataGate may cache or pin the package by release identity and checksum, but the package remains RDL Explorer output.

## DataGate consumer boundary

DataGate consumption is read-only API/contract consumption.

Allowed consumer actions:

- authenticate as a package consumer;
- read distribution catalogue metadata;
- read a manifest for a governed release;
- download a governed package for a release;
- compare release identity and checksum values;
- reject stale, missing or incompatible content before validation;
- cache consumed package identity in DataGate for traceability.

Not allowed in RDL-051:

- direct DataGate-to-RDL database mutation;
- DataGate updating RDL Explorer publication state;
- RDL Explorer mutating DataGate project validation state;
- project CIS authoring or tailoring in RDL Explorer;
- DataGate project validation logic moving into RDL Explorer.

## Stale and incompatible content detection

A consumer must compare at least:

- contract id;
- contract version;
- schema version;
- release id;
- release key;
- release version;
- package checksum;
- manifest checksum;
- distribution checksum;
- ETag.

If any expected identity or integrity value changes unexpectedly, the consumer must treat the content as stale or incompatible until the consuming application explicitly accepts the new release identity.

## Error and preflight semantics

Missing or invalid release requests must return a clear error and must not create or mutate any DataGate state.

RDL Explorer can reject requests that do not specify a valid release id. DataGate should treat those responses as preflight failures and stop before project validation.

## Governance boundary

RDL Explorer governance actions remain in RDL Explorer:

- approve standards changes;
- publish governed releases;
- create distribution manifests;
- create package payloads;
- expose read-only distribution APIs;
- maintain contract versioning.

DataGate consumer actions remain in DataGate:

- select a published release for a project context;
- validate EPC/project submissions using the governed package;
- record consumed package identity for project traceability;
- reject or block project validation when a package is missing, stale or incompatible.

## Macro-gate 2 validation

Macro-gate 2 must prove that:

- manifest and package endpoints expose contract id and contract version;
- manifest and package endpoints expose identity and integrity fields;
- ETag or equivalent integrity header is present;
- DataGate remains a read-only API/contract consumer;
- direct DataGate-to-RDL database mutation remains prohibited;
- existing RDL-050, RDL-049, RDL-048, RDL-046, RDL-045 and RDL-044 contracts still pass;
- regression, build and lint remain green;
- there is no commit, push, PR, merge, persistent database mutation, DataGate mutation or local Playwright run.
