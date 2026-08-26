# RDL Explorer®

RDL Explorer is a React + TypeScript platform for exploring, understanding and applying engineering Reference Data Libraries (RDLs). The product is bootstrapped from the proven CFIHOS Explorer codebase, with **CFIHOS 2.0 remaining the initial and only active RDL in RDL-001**.

RDL-001 intentionally preserves the current CFIHOS functionality while establishing a separate product boundary and architecture for future multi-RDL, PostgreSQL, provenance, versioning, governance, API and DataGate capabilities.

## Product boundary

- **CFIHOS Explorer** remains a lightweight, free/reference utility focused on CFIHOS.
- **RDL Explorer®** is the evolving multi-RDL platform and future commercial product.
- RDL Explorer starts from the CFIHOS Explorer UX and regression baseline rather than rewriting it.
- CFIHOS is treated as the first reference RDL, not as the identity of the application.

See [Product Boundary](docs/PRODUCT_BOUNDARY.md) for the full separation.

## Current status — RDL-002

This bootstrap release preserves the existing CFIHOS 2.0 capabilities:

- Tag Class and Equipment Class exploration
- document, property, discipline, source-standard and lifecycle views
- Data Model and validation tooling
- generated/reviewed CFIHOS runtime and validation snapshots
- Contract Information Specification Builder with locked baseline and explicit overrides
- JSON save/open and downstream CSV export for CIS workflows
- grounded CFIHOS AI Assistant with active-CIS context
- About and User Guide pages
- route-level code splitting, progressive disclosure and regression checks
- scheduled upstream CFIHOS change monitoring

RDL-002 adds the PostgreSQL platform foundation while intentionally leaving the current CFIHOS snapshot runtime unchanged. The database is additive infrastructure at this stage; no CFIHOS entities are read from PostgreSQL yet.

## Technology

- React 19
- TypeScript
- Vite
- npm / Node.js 22
- GitHub Actions
- Vercel
- OpenAI Responses API for optional server-side generative synthesis
- PostgreSQL foundation is present from RDL-002 onward; the CFIHOS snapshot remains the active runtime until parity is proven.

## Quick start

Prerequisites: Node.js 22 and npm.

```bash
npm ci
npm run test:regression
npm run build
npm run dev
```

The browser currently consumes the committed `public/cfihos-workbook.json` snapshot. It does not parse the upstream XLSX at runtime. This remains the RDL-001 compatibility path.


## PostgreSQL foundation

RDL-002 establishes the database boundary without changing the current Explorer data path.

- database: `rdl_explorer`;
- schemas: `rdl`, `ingestion`, `metadata`;
- migration history: `metadata.schema_migrations`;
- migration runner: `npm run db:migrate`;
- health check: `npm run db:health`;
- local setup: [`database/README.md`](database/README.md);
- connection environment variable: `RDL_DATABASE_URL`.

The default local connection string is `postgresql://localhost:5432/rdl_explorer`. Credentials must not be committed.

The database does **not** become the source authority: governed RDL packages remain authoritative. The current `public/cfihos-workbook.json` runtime remains active until database parity is demonstrated in a later sprint.

## Documentation

- [Product Boundary](docs/PRODUCT_BOUNDARY.md)
- [RDL Explorer Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Requirements](docs/REQUIREMENTS.md)
- [Operations & Maintenance Guide](docs/OPERATIONS_AND_MAINTENANCE.md)
- [Existing Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) — describes the inherited CFIHOS implementation and remains useful until superseded incrementally.
- [Roles & Responsibilities](docs/ROLES_AND_RESPONSIBILITIES.md)

For end-user navigation and feature guidance, use the in-application **RDL Explorer User Guide** and **About RDL Explorer** pages.

## Release workflow

```text
feature/fix branch
  -> local regression + build
  -> GitHub Pull Request
  -> automated checks + Vercel Preview
  -> review/acceptance
  -> squash merge to main
```

## Architecture guardrails

- Preserve authoritative RDL source packages separately from PostgreSQL.
- PostgreSQL will be a normalized operational repository, not the standards authority.
- Every normalized entity must eventually retain source, release, native identifier, entity type and provenance.
- Do not assume a native identifier is globally unique across RDLs or entity domains.
- DataGate must consume immutable packages or APIs; it must not depend on RDL Explorer internal SQL tables.
- Industry, Company, Asset and Project RDL layers must remain explicit and provenance-aware.
- Do not mutate authoritative baselines to represent local or contractual overrides.
- Keep AI synthesis grounded in retrieved evidence and explicit context.
- Keep the CFIHOS compatibility/regression path available while the generic architecture is introduced.

### Enterprise standards control tower

RDL-023 adds `/control-tower`, a read-only management view over standards governance, published releases, consumer adoption and migration readiness. Live data remains behind the trusted governance boundary; without a valid session the page shows clearly labelled demonstration data.

### Enterprise notifications & work queue

RDL-024 adds `/work-queue`, a personal operational inbox for standards reviewers and approvers. Work items can be assigned, acknowledged, tracked against SLA/aging indicators, reminded and escalated, but every item drills through to the authoritative governed workflow for the actual decision. Live data remains behind the trusted signed identity boundary; otherwise the page is clearly labelled as demonstration data.


## RDL-025 — AI-assisted Standards Intelligence

RDL-025 adds evidence-backed, advisory AI over governed RDL and lifecycle state. Live enterprise evidence requires a trusted `rdl-ai-standards-analyst` identity. AI outputs cite evidence identifiers and cannot approve extensions, publish releases, approve/stage/activate migrations, or migrate projects/consumers. Advisory runs may be immutably audited without becoming governance decisions.
