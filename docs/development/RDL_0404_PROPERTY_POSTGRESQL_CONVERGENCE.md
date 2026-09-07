# RDL-040.4 Property PostgreSQL Convergence

## Objective

Move the runtime/browser authority used by `CfihosPropertyRepository` from the frozen workbook snapshot to the validated PostgreSQL CFIHOS package while retaining the workbook snapshot as immutable reference/rollback evidence.

## Qualification evidence

RDL-040.4 Property was selected only after exact source-to-PostgreSQL readiness proof:

- 1,388 / 1,388 Property public objects exact, including source order;
- 848 / 848 Tag Class public objects exact, including 847 parent identities;
- 4,018 / 4,018 Tag Class -> Property assignments exact;
- 547 Property -> controlled-list relationships exact;
- 3,027 / 3,027 controlled-list values exact;
- picklist source-standard metadata exact, including multi-standard semicolon-delimited values;
- representative Property search semantics exact;
- frozen source SHA-256 unchanged.

## Runtime contract

`CfihosPropertyRepository` now consumes `loadCfihosPropertySource()` instead of delegating runtime reads to the workbook-backed `CfihosRepository`.

The source contract contains four authoritative inputs:

1. Property rows;
2. Tag Class rows;
3. direct Tag Class -> Property assignment rows;
4. Property picklist value rows.

The browser runtime modes remain unchanged:

- `api`: PostgreSQL compatibility endpoint is authoritative;
- `json`: frozen workbook snapshot is authoritative rollback/reference;
- `dual`: both sources are read and exact semantic parity is required; mismatch or inability to confirm parity fails closed.

The compatibility endpoint is:

`GET /api/rdl-runtime/cfihos-properties?sourceKey=cfihos&releaseKey=cfihos-2.0`

Schema version:

`rdl-cfihos-properties/v1`

## PostgreSQL authority

The server compatibility service reads only the validated package resolved for `cfihos/cfihos-2.0` and preserves package/release isolation.

Authoritative facts used:

- `rdl.rdl_entity` / `property`;
- `rdl.rdl_entity` / `tag_class`;
- `rdl.rdl_relationship` / `class_property` from `tag class property`;
- `rdl.rdl_relationship` / `controlled_list_value` plus `controlled_list` and `controlled_value` entities from `property picklist values`.

Property definition remains the top-level `rdl_entity.definition`. Other Property semantics are read from `normalized_metadata`. Picklist source-standard IDs/codes are preserved from controlled-value metadata, including multi-standard values.

## Preserved public behavior

The Property facade keeps the existing public methods and semantics:

- `getProperties()`;
- `getProperty(propertyId)`;
- `searchProperties(query)`;
- `getTagClassesUsingProperty(propertyId)`;
- `getPropertyUsage(propertyId)`;
- `getPicklistValues(propertyId)`.

Search fields and sort behavior remain unchanged. Tag Class usage remains direct assignment usage only. Picklist values retain numeric, case-insensitive code sorting.

## Deliberate non-scope

RDL-040.4 does **not**:

- change database schema or migrations;
- change CFIHOS ingestion;
- regenerate any frozen JSON artifact;
- modify `CfihosRepository` or its other consumers;
- converge Equipment, Tag Class, Property Grouping, or diagnostic/audit repositories as separate runtime authorities;
- change DataGate semantic contracts.

`CfihosRepository.getProperties()` remains workbook-backed for its existing direct consumers. This slice changes only the runtime authority behind `CfihosPropertyRepository`, whose production consumer is Property search in `AssistantPage`.

## Validation

The dedicated test `scripts/test-rdl-0404-property-runtime-compatibility.ts` proves:

- live PostgreSQL package/source/provenance cardinality;
- JSON rollback mode makes no runtime API call;
- API mode uses the same-origin PostgreSQL compatibility endpoint;
- dual mode confirms exact four-input semantic parity;
- dual mode fails closed on semantic or source-fingerprint mismatch;
- the existing Property repository public contract is unchanged on API-backed source data.

Normal RDL regression/build/lint/frozen-hash gates remain required before commit.
