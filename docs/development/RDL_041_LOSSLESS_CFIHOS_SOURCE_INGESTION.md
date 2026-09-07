# RDL-041 — Lossless CFIHOS Source Ingestion

## Decision

RDL-040 proved the PostgreSQL/API runtime pattern through four bounded
compatibility slices. It also proved that normalized `rdl_entity` and
`rdl_relationship` projections are not, by themselves, a lossless copy of the
reviewed source artifact.

RDL-041 therefore introduces an additive package-scoped source evidence layer
before any broad workbook-loader or UI cutover.

## Product boundary

RDL Explorer owns source ingestion, normalization, inspection and governed RDL
publication. DataGate consumes a governed RDL package/release; it does not own
CFIHOS workbook ingestion.

## RDL-041.1 scope

RDL-041.1 adds:

- `rdl.rdl_source_sheet` — exact worksheet identity, source order, headers,
  source row count and semantic SHA-256;
- `rdl.rdl_source_record` — every parsed source row, original worksheet row
  number, zero-based record order, complete raw row JSONB and row SHA-256;
- `rdl.rdl_source_sheet_summary` — row-count completeness by package/sheet;
- immutable-update/delete guards for source evidence;
- a dedicated CFIHOS source-record SQL generator and ingestion command;
- an exact PostgreSQL-to-snapshot round-trip parity test.

The reviewed `public/cfihos-workbook.json` remains the governed input and
immutable regression oracle for this slice. No frozen file is regenerated.

## Identity and hashing

A source sheet is uniquely identified by:

```text
package_id + sheet_name
```

Its source order is also unique within the package.

A source record is uniquely identified by:

```text
source_sheet_id + record_order
```

The original worksheet row number is stored independently. For the current
CFIHOS snapshot, parsed data starts on worksheet row 2.

Rows are not unique by hash. Duplicate and empty rows are legitimate source
evidence and are preserved by ordinal. SHA-256 values use canonical JSON with
object keys sorted recursively; array order and scalar types remain unchanged.

## Ingestion behavior

`scripts/generate-cfihos-source-record-sql.ts` reads the existing governed
snapshot and generates one transactional SQL load. The load:

1. requires the exact validated CFIHOS package and package fingerprint;
2. stages all sheets and records;
3. inserts immutable source evidence without updating existing rows;
4. compares the complete staged and stored datasets in both directions;
5. fails closed if any existing evidence differs or any row is missing/extra;
6. records one completed `cfihos-lossless-source-v1` ingestion audit.

Replaying the same package is idempotent. A changed source must use a new
governed package/release rather than mutate existing source evidence.

## Round-trip acceptance

`scripts/test-rdl-0411-lossless-cfihos-source-records.ts` reconstructs the
entire `cfihos-workbook-snapshot-v1` contract from PostgreSQL and requires exact
semantic equality with the immutable snapshot, including:

- source metadata and content SHA-256;
- all 23 worksheet names and their order;
- all worksheet headers, including empty-named columns;
- all 42,514 source rows and their order;
- every parsed field and scalar value;
- every source row number;
- every row and worksheet semantic SHA-256;
- preservation of duplicate row hashes by ordinal;
- immutable source evidence.

## Explicit non-goals for RDL-041.1

This first slice does not:

- change existing normalized entities or relationships;
- repair JIP33 or Class Document normalized projections;
- classify every source record as resolved, unresolved or not applicable;
- change `src/cfihos/workbook.ts`;
- change browser, CIS or Assistant runtime authority;
- add a runtime source-record API;
- change DataGate semantics;
- regenerate the workbook or frozen JSON indexes.

## Subsequent slices

- **RDL-041.2** will add explicit source-record-to-normalized-projection
  accounting and classify unresolved/unprojected source rows without data loss.
- **RDL-042** will expose one PostgreSQL-backed workbook/sheet compatibility
  boundary and switch the shared workbook loader from static JSON to that API,
  retaining JSON as rollback/regression evidence.
- **RDL-043** will close normalized projection gaps and simplify remaining
  CFIHOS-specific repositories where the generic RDL model is sufficient.
