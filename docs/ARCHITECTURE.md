# RDL Explorer Target Architecture

## 1. Architectural intent

RDL Explorer evolves the proven CFIHOS Explorer experience into a provenance-aware, multi-RDL engineering-information platform.

RDL-001 establishes the target architecture without changing the inherited runtime data path.

## 2. Authority and persistence

The authoritative standard remains the published source package, workbook or governed external API. PostgreSQL is a normalized operational representation, not the authority.

```text
Authoritative RDL Sources
CFIHOS | Hydrogen | CCUS | future RDLs
              |
              v
        Ingestion adapters
              |
       validate + normalize
              |
              v
   PostgreSQL RDL Repository
              |
        service/API layer
              |
              v
         RDL Explorer
```

Each ingestion must preserve enough metadata to identify and reproduce the source: source, release, package identity, checksum/hash where appropriate, ingestion timestamp, validation outcome and provenance.

## 3. Core domain concepts

The generic model will be introduced incrementally around these concepts:

```text
RdlSource
   |
   +-- RdlRelease
          |
          +-- RdlPackage
```

Normalized entities will include classes, properties, document types, controlled values, units, source standards and other reference entities where supported by the originating RDL.

Relationships are first-class records rather than implicit joins hidden inside individual screens.

## 4. Entity identity

A native identifier alone must not be assumed to be globally unique.

Logical identity must include at least:

- RDL source;
- release/package context;
- entity type/domain;
- native source identifier.

For example, the logical identity of a CFIHOS entity is conceptually closer to:

```text
CFIHOS : 2.0 : TagClass : CFIHOS-30000521
```

than simply `CFIHOS-30000521`.

## 5. Provenance

Every normalized entity and relationship must be able to answer:

- Which RDL introduced this?
- Which release/package?
- What was the native identifier?
- Is it authoritative, normalized, derived or explanatory?
- Has it been extended by another governed layer?

The UI must never make AI-generated explanation or normalized presentation indistinguishable from authoritative source content.

## 6. RDL layering

The long-term model supports explicit composition:

```text
L1 Industry RDL
CFIHOS / Hydrogen / CCUS
        |
        v
L2 Company RDL
        |
        v
L3 Asset RDL
        |
        v
L4 Project RDL / CIS
```

Extensions reference and extend their baseline. They do not silently modify the underlying authoritative package.

An effective project context is a governed composition of exact versions and extensions and can be published as an immutable effective RDL package.

## 7. DataGate boundary

RDL Explorer publishes standards and effective requirement packages. DataGate consumes them.

```text
RDL Explorer
     |
     | publish immutable package/API
     v
DataGate staging/import
     |
     | review / activate
     v
Project standard baseline
     |
     v
Validation and findings
```

DataGate must not query RDL Explorer internal database tables directly.

Preferred integration principle: **push notification, pull content**. RDL Explorer may announce availability; DataGate explicitly discovers, pulls, validates and activates the package it needs.

## 8. Database boundary

RDL Explorer and DataGate should have separate logical databases even if they eventually share PostgreSQL infrastructure.

Target separation:

```text
PostgreSQL infrastructure
  |
  +-- rdl_explorer
  |     +-- rdl
  |     +-- ingestion
  |     +-- metadata
  |
  +-- datagate
        +-- its own schemas and lifecycle
```

## 9. Transitional architecture

Until database parity is proven, the inherited CFIHOS workbook-snapshot repository remains available.

During migration, RDL Explorer should support parity testing between:

```text
CFIHOS snapshot repository
          vs
PostgreSQL-backed CFIHOS package
```

The database path becomes authoritative for RDL Explorer only after reproducible parity is demonstrated for agreed reference cases and regression tests.
