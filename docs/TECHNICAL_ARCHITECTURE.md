# CFIHOS Explorer — Technical Architecture

## 1. Purpose

This document describes the current technical architecture and the design constraints that should be preserved by future maintainers.

## 2. System context

CFIHOS Explorer is a React + TypeScript single-page application for exploring and validating CFIHOS 2.0 reference data, deriving and authoring Contract Information Specifications (CIS), and providing evidence-grounded AI assistance.

```text
Official CFIHOS XLSX
        |
        | controlled generation / validation
        v
+-------------------------------+
| Repository release artifacts  |
| cfihos-workbook.json          |
| validation-snapshot.json      |
+-------------------------------+
        |
        v
React/Vite browser application
        |
        +--> Explorer repositories and pages
        +--> Validation
        +--> CIS derivation / CIS Builder
        +--> deterministic Assistant retrieval
                    |
                    v
              POST /api/assistant
                    |
                    v
              OpenAI Responses API
```

## 3. Front-end architecture

The application is a Vite SPA using React Router. Major pages are route-level lazy-loaded to keep the initial JavaScript bundle smaller and to prevent feature-specific dependencies from inflating the startup path.

The browser reads generated CFIHOS data through `src/cfihos/workbook.ts`. That module exposes neutral application-level APIs for sheet names, rows, headers and inspections. It does not import SheetJS.

### Runtime workbook contract

`public/cfihos-workbook.json` uses schema:

```text
cfihos-workbook-snapshot-v1
```

It contains source URL, generation timestamp, SHA-256, sheet names, headers and normalized rows.

**Design rule:** browser repositories must depend on the JSON workbook abstraction, not XLSX-specific types.

## 4. Controlled source-data generation

`script/generate-workbook-snapshot.ts` (repository path: `scripts/generate-workbook-snapshot.ts`) downloads the official workbook, calculates SHA-256, parses the workbook in Node and writes the browser runtime snapshot.

`read-excel-file` is intentionally a development-only dependency behind `scripts/rdl-ingestion/workbookReader.ts`. The runtime-isolation regression test exists to prevent any XLSX parser from entering `src/` or `api/`.

The generator uses Node HTTPS first and can fall back to operating-system `curl` trust where enterprise certificate chains prevent Node fetch from succeeding.

## 5. Validation architecture

`scripts/generate-validation-snapshot.ts` independently parses the official or supplied workbook and publishes `public/validation-snapshot.json`.

The Validation UI reads the published snapshot rather than recalculating the complete audit in each reviewer browser. This makes validation evidence reproducible and keeps browser behaviour deterministic.

The validation generator supports an explicit local workbook path, enabling controlled validation of a candidate upstream release before changing the runtime snapshot.

## 6. Upstream CFIHOS maintenance architecture

`scripts/check-cfihos-update.ts` compares the current official workbook SHA-256 with the hash committed in `cfihos-workbook.json`.

When hashes differ it can construct a candidate snapshot and compare important domains such as classes, documents, properties, requirements, relationships, source standards and disciplines. The machine-readable report is written under `reports/` when a change is detected.

`.github/workflows/cfihos-upstream-monitor.yml` runs the check weekly and supports manual execution. It is deliberately detection-only.

```text
Scheduled/manual GitHub Action
        -> download official workbook
        -> SHA-256 comparison
        -> unchanged: green
        -> changed: report artifact + visible failure
        -> human review
```

**Design rule:** upstream changes must not automatically alter production reference data.

## 7. Repository/domain layer

CFIHOS repository classes under `src/cfihos/repository/` interpret normalized workbook rows into domain-specific queries and relationships. The workbook abstraction is shared, while semantic logic remains in repositories.

This separation is important because it allows source transport/parsing to change without rewriting domain semantics.

## 8. CIS architecture

The CIS capability separates:

```text
Project scope
    -> CFIHOS-derived locked baseline
    -> explicit contract overrides
    -> final contractual CIS/export
```

The baseline is derived from selected Tag/Equipment Classes and disciplines using validated CFIHOS relationships. Contract deviations are stored separately as exclusions, changes or Owner/Operator additions.

**Design rule:** never mutate the locked CFIHOS baseline to represent a contract decision.

The working CIS is persisted in browser storage and can be saved/opened as JSON. CSV is a downstream exchange/export format rather than the preferred editable master.

## 9. AI Assistant architecture

The Assistant follows retrieval-first grounding:

```text
User question
   -> deterministic intent/concept retrieval
   -> CFIHOS evidence and/or Explorer capability evidence
   -> optional active CIS context
   -> server-side generative synthesis
   -> answer + visible evidence + deterministic actions
```

The model is not given direct access to the raw workbook or the web.

### Server boundary

`api/assistant.ts` is a Vercel server function. It:

- accepts POST only
- requires a question and retrieved evidence
- caps evidence count and detail length
- reads `OPENAI_API_KEY` only on the server
- uses `OPENAI_MODEL` or defaults to `gpt-5.4-mini`
- calls the OpenAI Responses API
- uses `store: false`
- aborts the model request after 20 seconds
- returns controlled errors to the browser

### Trust model

The Assistant distinguishes formal CFIHOS evidence, Explorer capability metadata, candidate/semantic interpretation and active CIS evidence. When active CIS context is supplied it must distinguish the locked baseline from Owner/Operator overrides.

Application navigation actions are deterministic metadata supplied by the application; the model does not invent routes.

## 10. Deployment architecture

Vercel hosts Preview and Production deployments. Feature-branch pushes can produce Preview deployments; merges to `main` produce Production deployments according to the connected project configuration.

`vercel.json` reserves `/api/` for server functions and sends other routes to `/index.html` for SPA routing. API functions have a configured maximum duration of 30 seconds.

OpenAI environment variables are configured in Vercel and are not part of the client bundle.

## 11. CI/CD

`.github/workflows/build.yml` builds on pushes and pull requests targeting `main`.

The release pattern is feature branch -> PR -> automated checks -> Vercel Preview -> human acceptance -> squash merge -> Production deployment.

The upstream monitor is separate from the build workflow so upstream source monitoring cannot silently become a release action.

## 12. Regression architecture

`npm run test:regression` currently composes:

```text
test-workbook-runtime-isolation.ts
  -> test-assistant-api-hardening.ts
  -> test-app-regression.ts
  -> test-cis-derivation.ts
```

The deterministic suite protects architectural contracts, server-side Assistant hardening and selected semantic derivation cases. GitHub Actions also runs Playwright browser E2E and Axe accessibility checks against critical Explorer, CIS and Assistant journeys. Browser Assistant tests mock `/api/assistant` so CI remains deterministic and does not consume model API credit.

## 13. Security boundaries and known risks

### Preserved controls

- OpenAI secret remains server-side.
- Model requests use retrieved evidence rather than raw workbook/web access.
- Model storage is disabled (`store: false`).
- XLSX parsing is removed from browser/API runtime.
- Upstream CFIHOS updates require explicit regeneration/review.
- CIS contract overrides remain separate from the source baseline.

### Development-time workbook parser

RDL-039 retires SheetJS `xlsx@0.18.5` and routes controlled generation/validation through the maintained `read-excel-file` package behind one repository-local compatibility adapter. Workbook parsing remains outside the browser/API runtime, and generated release artifacts remain the reviewed runtime boundary.

## 14. Architectural decisions to preserve

1. **Snapshot over live XLSX:** production browsers consume a reviewed JSON snapshot rather than an upstream XLSX that can change without review.
2. **Retrieval before generation:** the Assistant retrieves evidence before model synthesis.
3. **Server-side secrets:** OpenAI credentials never enter the browser bundle.
4. **Immutable CFIHOS baseline:** contract-specific decisions are explicit overrides.
5. **Human-controlled upstream adoption:** monitoring detects changes; humans approve refreshes.
6. **Route-level code splitting:** major pages remain lazy-loaded; do not solve bundle warnings by merely increasing warning thresholds.
7. **Reproducible validation:** validation evidence is generated and published, not recalculated ad hoc by reviewers.

## 15. Future architecture backlog

Potential hardening items include:

- split/normalize the large workbook JSON snapshot by domain/worksheet
- extend API usage telemetry and governance reporting beyond the current server-side rate/cost controls
- formalize release/versioning conventions beyond the current audit baseline
- automate generation of a review PR after an upstream change only after the operating model is approved

