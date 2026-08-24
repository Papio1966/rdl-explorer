# CFIHOS Explorer

CFIHOS Explorer is a React + TypeScript application for browsing, validating and understanding the CFIHOS 2.0 CORE Reference Data Library, building project-specific Contract Information Specifications (CIS), and providing evidence-grounded AI assistance.

## Current status

The application is currently in pre-production / UAT development.

A detailed CFIHOS 2.0 CORE model-validation audit has been completed. The application now includes:

- Tag Class and Equipment Class exploration
- document, property, discipline, source-standard and lifecycle views
- Data Model and validation tooling
- generated/reviewed CFIHOS runtime and validation snapshots
- Contract Information Specification Builder with locked baseline and explicit overrides
- JSON save/open and downstream CSV export for CIS workflows
- grounded CFIHOS AI Assistant with active-CIS context
- About and User Guide pages
- route-level code splitting and regression checks
- scheduled upstream CFIHOS change monitoring

The completed audit baseline is tagged:

`v0.9.0-audit-complete`

## Technology

- React 19
- TypeScript
- Vite
- npm / Node.js 22
- GitHub Actions
- Vercel
- OpenAI Responses API for optional server-side generative synthesis

## Quick start

Prerequisites: Node.js 22 and npm.

```bash
npm ci
npm run test:regression
npm run build
npm run dev
```

The browser consumes the committed `public/cfihos-workbook.json` snapshot. It does not parse the upstream XLSX at runtime.

## Common maintenance commands

```bash
# Full deterministic regression suite
npm run test:regression

# Production build
npm run build

# Regenerate published validation evidence
npm run validate:cfihos

# Check whether the official CFIHOS workbook changed
npm run check:cfihos-update

# Regenerate the browser runtime workbook snapshot
npx tsx scripts/generate-workbook-snapshot.ts
```

## AI configuration

The Vercel server function uses:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

`OPENAI_API_KEY` must remain server-side and must never be committed to the repository. If GenAI is unavailable, the Assistant can continue to expose deterministic retrieved evidence.

## Documentation

Operational and technical documentation is versioned with the application:

- [Operations & Maintenance Guide](docs/OPERATIONS_AND_MAINTENANCE.md) — installation, configuration, deployment, CFIHOS refresh, testing, rollback and troubleshooting.
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) — runtime data architecture, validation, CIS, AI, deployment and key design decisions.
- [Roles & Responsibilities](docs/ROLES_AND_RESPONSIBILITIES.md) — ownership model and RACI for operating and maintaining the Explorer.

For end-user navigation and feature guidance, use the in-application **User Guide** and **About CFIHOS Explorer** pages.

## Release workflow

Normal changes follow:

```text
feature/fix branch
  -> local regression + build
  -> GitHub Pull Request
  -> automated checks + Vercel Preview
  -> review/acceptance
  -> squash merge to main
  -> Vercel Production deployment
```

Upstream CFIHOS changes are detected by the scheduled **CFIHOS Upstream Monitor**. Detection does not automatically modify or deploy reference data; refreshes require human review.

## Important design constraints

- Do not reintroduce XLSX parsing into browser or API runtime code.
- Do not expose the OpenAI API key to browser code.
- Do not mutate the locked CFIHOS baseline to represent contract overrides.
- Keep AI synthesis grounded in retrieved evidence and explicit CIS context.
- Review upstream CFIHOS changes before regenerating and releasing snapshots.

