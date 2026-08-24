# RDL Explorer Product Boundary

## Purpose

RDL Explorer® is a new product created from the stable CFIHOS Explorer baseline. The two products now have deliberately different roles.

## CFIHOS Explorer

CFIHOS Explorer remains the lightweight CFIHOS-focused utility.

Its role is to be:

- easy to deploy and share;
- useful for demonstrations, pilots, training and standards adoption;
- focused on CFIHOS rather than enterprise RDL governance;
- a reference implementation for CFIHOS behavior;
- a regression oracle for the CFIHOS package inside RDL Explorer.

Future changes should primarily be bug fixes, upstream CFIHOS maintenance and validated pilot improvements.

## RDL Explorer®

RDL Explorer is the platform for the broader product vision:

- multiple RDLs and releases;
- normalized PostgreSQL persistence;
- explicit provenance and versioning;
- cross-RDL search and intelligence;
- Company, Asset and Project extensions;
- governed RDL packages;
- enterprise APIs and integration;
- eventual DataGate handoff and traceability.

## What is inherited

RDL Explorer starts with the proven CFIHOS Explorer experience and code patterns, including browsing, navigation, progressive disclosure, validation, CIS Builder, Assistant, accessibility and regression coverage.

RDL-001 does not attempt to genericize every inherited CFIHOS repository. It establishes the product boundary first and keeps CFIHOS as the working reference implementation.

## Non-goals for RDL-001

RDL-001 does not:

- introduce PostgreSQL runtime dependencies;
- ingest a second RDL;
- provide a multi-RDL selector;
- implement global cross-RDL search;
- introduce Company, Asset or Project RDL persistence;
- integrate directly with DataGate.

## Product relationship

```text
CFIHOS Explorer
free/reference utility
        |
        | proven behavior and regression reference
        v
RDL Explorer®
multi-RDL platform
```

The products may share concepts and selected implementation patterns, but they are independent repositories and can evolve independently.
