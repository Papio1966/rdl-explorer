# RDL-042 — Global PostgreSQL Source Runtime Cutover

## Objective

RDL-042 moves the shared CFIHOS workbook runtime boundary from the immutable
`public/cfihos-workbook.json` artifact to the lossless PostgreSQL source layer
created by RDL-041.1 and accounted by RDL-041.2.

The cutover is deliberately made once, at `src/cfihos/workbook.ts`. Existing
CFIHOS repositories and pages keep their current public workbook/sheet APIs.
There is no repository-by-repository convergence in this slice.

## Architecture

```text
UI / CIS / Assistant / CFIHOS repositories
                  |
                  v
        src/cfihos/workbook.ts
                  |
        +---------+---------+
        |                   |
        v                   v
PostgreSQL runtime       immutable JSON
(api / dual)             (json / oracle)
        |
        v
/api/rdl-runtime/cfihos-workbook
        |
        v
CfihosSourceWorkbookService
        |
        v
rdl.rdl_source_sheet + rdl.rdl_source_record
```

The client contract remains `cfihos-workbook-snapshot-v1` with the same
`loadCfihosWorkbook`, `getCfihosSheetNames`, `getCfihosWorksheetRows`,
`getCfihosWorksheetHeaders`, `inspectCfihosWorksheet` and cache-reset APIs.

## Transport decision

The governed static workbook is about 16.7 MB and the lossless PostgreSQL JSON
row representation is about 17.3 MB before HTTP-envelope overhead. Vercel
Functions currently limit request and response bodies to 4.5 MB, so returning
the whole workbook from one serverless response is not deployable.

RDL-042 therefore uses one endpoint path with two read contracts:

1. Manifest read:
   `GET /api/rdl-runtime/cfihos-workbook?sourceKey=cfihos&releaseKey=cfihos-2.0`
2. Package-pinned sheet read:
   `GET /api/rdl-runtime/cfihos-workbook?sourceKey=cfihos&releaseKey=cfihos-2.0&packageKey=...&sheetName=...`

The manifest locks the exact validated package, source SHA, source URI,
generated timestamp, sheet order, headers and row counts. Every subsequent
worksheet read includes that `packageKey`, preventing a mixed-version workbook
if a newer package becomes available during loading.

The browser fetches worksheet responses with bounded concurrency and assembles
the same in-memory `CfihosWorkbookSnapshot` used by existing consumers. The
largest current worksheet is comfortably below a conservative 4.0 MB response
budget, which the RDL-042 contract test enforces for every sheet.

Official Vercel references:
- https://vercel.com/docs/errors/FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE
- https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE

## Runtime modes

RDL-042 reuses the established browser read-mode contract:

- `api` — PostgreSQL/runtime API is authoritative; failure is fail-closed.
- `dual` — immutable JSON is loaded as reference, PostgreSQL reconstructs the
  candidate workbook, every source/source-metadata/sheet/header/row semantic is
  compared, and the PostgreSQL candidate is returned only after exact parity.
- `json` — explicit rollback/reference mode; the immutable JSON artifact remains
  the source and no PostgreSQL workbook API call is required.

Normal browser production authority therefore follows the same global read-mode policy
already used by the RDL browser/runtime convergence work. Repository/CLI test
harnesses that execute source repositories without an HTTP application server remain
on the immutable JSON reference by default; targeted runtime tests can explicitly
select `api` or `dual`. This preserves deterministic local gates without weakening
the browser production cutover.

## PostgreSQL contract

No migration is required. RDL-042 reads only:

- `rdl.rdl_package` and its source/release identity;
- `rdl.rdl_source_sheet` ordered by `sheet_order`;
- `rdl.rdl_source_record` ordered by `record_order`.

Package metadata supplies `source_uri`, `content_sha256` and manifest fields
`schema`, `generatedAt` and `sourceSha256`. Source records supply the exact
`raw_row` JSONB evidence. The service verifies stored row counts before serving
data.

## Safety and preservation

RDL-042 must preserve:

- 23 sheets / 42,514 lossless source rows;
- 13,609 normalized entities / 39,461 normalized relationships;
- 55,866 source-projection lineage links / 16,982 dispositions;
- all established source, normalized and accounting fingerprints and identity
  sequences;
- RDL-041.2 and RDL-041.1 contracts;
- RDL-004, RDL-005 and RDL-006;
- RDL-040.1 through RDL-040.4;
- RDL-035 and RDL-039;
- deterministic application regression, production build and the accepted lint
  baseline of 24 warnings / 0 errors;
- the three immutable frozen JSON artifacts.

There is no DataGate database/runtime change in RDL-042.

## RDL-043 boundary

RDL-042 does not claim normalized field/semantic completeness. RDL-043 remains
responsible for normalized projection improvements such as JIP33 field coverage,
the ten unresolved Equipment document-requirement rows, property groupings and
other currently unmapped normalized semantics.

The crucial distinction is that these normalized-model gaps no longer prevent
the runtime from preserving and serving the complete governed source workbook
semantics from PostgreSQL.
