# RDL-039 — Development-Time Workbook Parser Hardening

## Objective

Replace the advisory-bearing development-only `xlsx@0.18.5` dependency without changing browser/API runtime behavior, RDL package semantics, generated search/relationship indexes, PostgreSQL ingestion semantics or DataGate-facing contracts.

## Decision

RDL-039 uses `read-excel-file@9.3.10` behind one shared development-time adapter:

`XLSX workbook -> scripts/rdl-ingestion/workbookReader.ts -> existing ingestion / snapshot / validation / index logic`

The parser remains tooling-only. `src/` and `api/` must not import either the retired `xlsx` package or the replacement parser.

## Evidence basis

The pre-implementation dual-parser spike compared four repository-controlled CCUS and Water / Desalination workbooks across 92 sheets. Sheet names/order and all headers matched. There was one non-semantic cell representation difference (`""` versus `null`) in Water / Desalination v2; downstream RDL mapping normalizes both to empty text.

## Compatibility contract

The shared adapter:

1. reads a workbook from a Node `Buffer` or file path;
2. preserves source worksheet names and ordering;
3. exposes deterministic formatted text values compatible with the repository's former `raw:false` usage;
4. maps booleans to `TRUE` / `FALSE` and dates to ISO text;
5. retains `null` for absent values;
6. provides first-row header object projection with SheetJS-compatible duplicate/empty header keys;
7. skips fully empty data rows;
8. keeps workbook SHA-256 calculation outside the parser so provenance is unchanged.

## Async boundary

`read-excel-file` is asynchronous. `generateCfihosFormatSql()` therefore becomes async, and the four profile-driven ingestion entrypoints await it. Their stdout SQL contract and the shell `npx tsx ... | psql` boundary remain unchanged.

The CFIHOS-specific ingestion generator is not part of this migration because it does not import `xlsx`.

## Invariants

- no browser or API runtime parser dependency;
- no database migration;
- no source workbook mutation;
- no RDL source/release/package identity change;
- no entity or relationship vocabulary change;
- no hierarchy change;
- no generated search-index semantic change;
- no generated relationship-index semantic change;
- no CFIHOS snapshot schema change;
- no validation semantic change;
- no DataGate package/identity contract change;
- no local Playwright.

## Acceptance

RDL-039 is locally acceptable only when:

- the dedicated workbook parser contract passes for all four repository workbooks;
- no direct `xlsx` imports remain;
- `xlsx` is absent from `package.json` / lockfile and `read-excel-file` is pinned to `9.3.10`;
- regenerated `rdl-search-index.json` and `rdl-relationship-index.json` retain their committed SHA-256 values;
- RDL-030 through RDL-035 deterministic regressions remain green;
- the full deterministic regression suite and production build pass;
- `git diff --check` passes;
- the final changed-file set is exactly governed and the worktree contains no generated evidence.
