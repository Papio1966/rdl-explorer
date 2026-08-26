# RDL Explorer — Operations & Maintenance Guide

## 1. Purpose

This guide defines the operational procedures for installing, configuring, deploying, maintaining, monitoring and recovering RDL Explorer. It is intended for the application owner, technical maintainer, CFIHOS/data steward, AI service owner and GitHub/Vercel administrator.

CFIHOS Explorer is currently a pre-production/UAT React + TypeScript application built around the CFIHOS 2.0 CORE Reference Data Library. The browser consumes a generated JSON snapshot of the official workbook; it does not parse XLSX at runtime.

## 2. Operational principles

The following controls are architectural requirements:

1. Do not reintroduce XLSX parsing into `src/` or `api/`. SheetJS is development-only and is used by controlled generation/validation scripts.
2. Treat `public/cfihos-workbook.json` as a generated, reviewed release artifact. An upstream workbook change must not silently change production data.
3. Preserve the locked CFIHOS baseline in the CIS Builder. Contract decisions are recorded as explicit overrides; they do not mutate CFIHOS.
4. Keep `OPENAI_API_KEY` server-side. It must never be placed in browser code, committed to Git, or exposed in screenshots/logs.
5. AI answers remain evidence-grounded. The model receives retrieved evidence and active CIS context, not direct workbook or web access.
6. Use feature branches, pull requests, automated checks and Vercel Preview deployments before merging to `main`.

## 3. Technology and services

- Node.js 22 and npm
- React 19 + TypeScript + Vite
- Git and GitHub
- GitHub Actions
- Vercel for Preview and Production deployment
- OpenAI Responses API for optional generative synthesis
- Official CFIHOS 2.0 CORE workbook source defined in `src/cfihos/source.ts`

## 4. Initial installation

### 4.1 Prerequisites

Install Git, Node.js 22 and npm. Confirm:

```bash
node --version
npm --version
git --version
```

### 4.2 Clone and install

```bash
git clone <repository-url>
cd cfihos-explorer
npm ci
```

Use `npm ci` for reproducible installation from `package-lock.json`. Use `npm install` only when intentionally changing dependencies.

### 4.3 Verify generated reference assets

The repository must contain:

```text
public/cfihos-workbook.json
public/validation-snapshot.json
```

The browser reads `/cfihos-workbook.json`. If the workbook snapshot is absent, regenerate it as described in Runbook 3.

### 4.4 Local validation

```bash
npm run test:regression
npm run build
```

The regression command currently runs workbook runtime-isolation checks, application architecture checks and CIS derivation tests.

### 4.5 Start local development

```bash
npm run dev
```

Open the local URL printed by Vite. The OpenAI server function is not provided by ordinary Vite development; deterministic Assistant retrieval remains available. Use a Vercel Preview deployment (or an appropriate Vercel local runtime) for end-to-end generative Assistant testing.

## 5. Configuration

### 5.1 CFIHOS source

The controlled upstream source is defined in:

```text
src/cfihos/source.ts
```

At the time of this guide it identifies CFIHOS version `2.0` and the official CORE workbook URL. A source/version change must be reviewed by the CFIHOS/Data Steward before release.

### 5.2 OpenAI configuration

Configure these Vercel environment variables:

```text
OPENAI_API_KEY   required for generative synthesis
OPENAI_MODEL     optional; server default is gpt-5.4-mini
```

For normal testing, configure the key for Preview and Production. Keep it marked sensitive/secret. Environment-variable changes require a fresh deployment to take effect.

The API endpoint is `POST /api/assistant`. It limits evidence, truncates evidence detail, applies a 20-second model timeout, sets `store: false`, and rejects requests without a question and retrieved evidence.

### 5.3 Vercel routing

`vercel.json` excludes `/api/` from the SPA fallback and sets a 30-second maximum duration for API functions. Do not replace this with a catch-all rewrite that sends `/api/assistant` to `index.html`.

## 6. Standard development and release workflow

Use this workflow for application changes:

```text
main
  -> feature/fix branch
  -> local tests and build
  -> commit and push
  -> GitHub Pull Request
  -> GitHub checks + Vercel Preview
  -> functional review
  -> squash merge to main
  -> Vercel Production deployment
```

Recommended local synchronization after a squash merge:

```bash
git switch main
git fetch origin
git reset --hard origin/main
git status
```

Only use the hard reset when the working tree contains no local work that must be preserved. This avoids retaining the pre-squash feature commit on local `main`.

## 7. Operational runbooks

### Runbook 1 — Normal application change

**Trigger:** approved bug fix, enhancement or maintenance change.  
**Primary owner:** Technical Maintainer.  
**Approver:** Application Owner; specialist review where relevant.

1. Synchronize local `main`.
2. Create a descriptive feature/fix branch.
3. Implement the change.
4. Run `npm run test:regression`.
5. Run `npm run build`.
6. Perform focused local smoke testing.
7. Commit and push the branch.
8. Create a PR to `main`.
9. Confirm automated checks and Vercel Preview are green.
10. Perform Preview acceptance testing.
11. Squash merge.
12. Verify Production deployment and critical paths.
13. Synchronize local `main`.

**Rollback:** revert the merged PR or redeploy the previous known-good Vercel deployment, then investigate on a new branch.

### Runbook 2 — Check for an upstream CFIHOS change

**Trigger:** scheduled weekly monitor, suspected upstream release, or manual maintenance check.  
**Primary owner:** CFIHOS/Data Steward.  
**Technical support:** Technical Maintainer.

Manual command:

```bash
npm run check:cfihos-update
```

The checker downloads the official workbook, calculates SHA-256 and compares it with the hash in `public/cfihos-workbook.json`.

For CI signalling:

```bash
npm run check:cfihos-update -- --fail-on-change
```

The GitHub workflow `.github/workflows/cfihos-upstream-monitor.yml` runs weekly on Monday at 06:00 UTC and supports manual `workflow_dispatch` execution.

**Unchanged:** no refresh is required.  
**Changed:** review `reports/cfihos-upstream-change-report.json` (uploaded as a workflow artifact when available). Do not automatically update production.

### Runbook 3 — Refresh the runtime CFIHOS snapshot

**Trigger:** upstream change has been confirmed and approved for evaluation.  
**Primary owner:** Technical Maintainer.  
**Semantic approval:** CFIHOS/Data Steward.

1. Create a dedicated refresh branch from current `main`.
2. Run:

```bash
npx tsx scripts/generate-workbook-snapshot.ts
```

3. Record the printed source mode, SHA-256, worksheet count and snapshot size.
4. Confirm `public/cfihos-workbook.json` changed only because of the intended upstream source.
5. Regenerate validation evidence using Runbook 4.
6. Run `npm run test:regression`.
7. Run `npm run build`.
8. Review the upstream change report and Validation page.
9. Smoke-test major routes, CIS Builder and Assistant.
10. Create a refresh PR with a summary of semantic changes.
11. Require CFIHOS/Data Steward review before merge.
12. Merge only after checks and Preview acceptance pass.

The generator first tries Node `fetch`; where enterprise certificate trust prevents that, it falls back to operating-system `curl` trust.

### Runbook 4 — Regenerate the validation snapshot

Run against the official source:

```bash
npm run validate:cfihos
```

Or validate a specific local workbook:

```bash
npm run validate:cfihos -- /path/to/workbook.xlsx
```

This regenerates:

```text
public/validation-snapshot.json
```

Review validation findings before committing the generated snapshot. The validation generator also records source provenance and workbook SHA-256.

### Runbook 5 — Regression and build verification

Minimum release gate:

```bash
npm run test:regression
npm run build
```

Expected regression areas:

- browser workbook loader remains JSON-only
- critical application routes remain registered
- critical navigation capabilities remain discoverable
- route-level lazy loading remains enabled
- CIS persistence and Assistant boundary remain present
- centrifuge derivation regression remains stable
- Process Unit -> block diagram mapping remains stable
- Source Standard references resolve independently

A failure blocks release until understood and resolved.

### Runbook 6 — Production smoke test

After deployment, verify at minimum:

- Overview loads
- Tag Classes and Equipment Classes populate
- Document Types populate and `Required by Classes` renders correctly
- Source Standards and Units of Measure populate
- Data Model loads
- Validation loads its published snapshot
- CIS Builder can create/open an editable CIS
- Assistant performs a direct grounded lookup
- Assistant can access active CIS context when a CIS is present
- About and User Guide load

For generative Assistant verification use a Vercel environment with valid OpenAI configuration.

### Runbook 7 — Rotate the OpenAI API key

**Primary owner:** AI Service Owner or approved Vercel administrator.

1. Create/rotate the key in the approved OpenAI account/project.
2. Update `OPENAI_API_KEY` in Vercel for the required environments.
3. Do not commit or paste the key into source, tickets or documentation.
4. Trigger/redeploy Preview and Production as required.
5. Test `/assistant` through the application.
6. Revoke the old key after successful verification.
7. Review API usage/cost after rotation.

### Runbook 8 — Dependency/security review

```bash
npm audit
npm outdated
```

Do not run `npm audit fix --force` without review. At the time this guide was written, `xlsx` is retained as a development-only dependency for controlled snapshot/validation scripts and has known advisories with no npm fix available. It must not be imported under `src/` or `api/`.

Verify runtime isolation with:

```bash
grep -R 'from "xlsx"\|require("xlsx")' --line-number src api
```

Expected result: no matches.

### Runbook 9 — Rollback

For an application regression:

1. Identify the last known-good production deployment/commit.
2. Prefer reverting the problematic PR in GitHub so repository history reflects the rollback.
3. Allow Vercel to deploy the reverted `main`.
4. Verify production smoke tests.
5. Open a new issue/branch for root-cause correction.

For an upstream CFIHOS refresh regression, revert the refresh PR so both generated snapshots and code return to the previously reviewed baseline.

## 8. CIS operational considerations

- The browser working CIS is persisted locally by the application; browser storage is origin-specific. A CIS available on localhost is not automatically available on a Vercel Preview hostname.
- Use the CIS JSON format as the editable working/master interchange format.
- Use CSV primarily as a downstream/EPC-facing export where required.
- A loaded CIS should retain project scope, locked baseline and explicit overrides.
- Contract overrides must remain traceable to the baseline decision and rationale.

## 9. Monitoring

Current automated monitoring includes:

- GitHub Build workflow on pushes/PRs to `main`
- deterministic regression and production build checks
- Playwright browser E2E and Axe accessibility checks for critical routes/workflows
- weekly CFIHOS Upstream Monitor
- Vercel deployment status for Preview and Production

The upstream monitor is detection-only: it does not regenerate data, commit, create PRs or deploy changes.

## 10. Backup and recovery

The authoritative recoverable assets are:

- GitHub repository and history
- generated CFIHOS and validation snapshots committed to Git
- Vercel project configuration/environment variables
- OpenAI account/project configuration
- user-exported CIS JSON files

Do not rely on browser local storage as the sole durable copy of a CIS. Users should save/export working CIS JSON where continuity matters.

## 11. Troubleshooting quick reference

| Symptom | First checks |
| --- | --- |
| App route returns home page unexpectedly | Check `src/App.tsx` route and Vercel SPA rewrite |
| `/api/assistant` returns SPA HTML | Confirm `/api/` is excluded from SPA fallback |
| Assistant says API unavailable | Confirm Vercel Preview/Production env vars and fresh deployment |
| Assistant server function times out | Review Vercel function logs and model-service response; endpoint has a 20s model timeout |
| Active CIS missing in Preview | Load/open the CIS on the same Preview hostname; local storage is origin-specific |
| CFIHOS data missing | Confirm `public/cfihos-workbook.json` exists and is valid |
| Upstream monitor fails | Inspect workflow logs and uploaded change-report artifact |
| Node download fails on enterprise network | Generator/checker can fall back to OS `curl` trust |
| `npm audit` reports `xlsx` | Confirm it remains dev-only and absent from `src/`/`api/`; do not force-upgrade blindly |

## 12. Handover checklist

Before transferring operational ownership, confirm the receiving team has:

- GitHub repository access and branch/PR permissions
- Vercel project access and deployment permissions
- ownership of production domain configuration
- approved access to OpenAI API configuration and billing/usage controls
- understanding of CFIHOS upstream monitoring and refresh approval
- ability to run local installation, regression tests and builds
- access to this guide, Technical Architecture and Roles & Responsibilities documents
- a known-good CIS JSON example for functional testing
- a documented support/escalation route



## 13. Pilot operating status

The current user-facing release is a controlled **Pilot** of CFIHOS Explorer. Pilot users should not treat the application as a production system or as a substitute for contractual review of the governing CFIHOS source.

The application identifies its active data source as the reviewed CFIHOS 2.0 snapshot committed with the release. Global cross-domain search is intentionally disabled until that capability is implemented; page-specific search/filtering and the grounded Assistant remain available.

Pilot feedback is currently routed to `alessandro@papioconsulting.eu`. Users should not include confidential project information, credentials, API keys or other secrets in feedback email. Replace this address with the planned functional RDL Explorer inbox when that service is available.

Before expanding the pilot audience, confirm the deployment access model, Vercel environment variables, OpenAI usage/cost controls and the support/escalation route appropriate to that audience.


## RDL production governance runtime

For the database-backed governance service, follow `docs/PRODUCTION_DEPLOYMENT.md`. Production promotion must validate correlation IDs, structured logging, fail-closed runtime configuration, database readiness, reviewer authentication and gateway-level distributed rate limiting. The browser must never receive PostgreSQL credentials or the governance signing secret.

## RDL-015 deployment automation and observability

Production releases should carry `RDL_RELEASE_ID`, `RDL_COMMIT_SHA`, `RDL_BUILD_VERSION` and `RDL_BUILD_TIMESTAMP` where the deployment platform supports them. Operators can confirm the active release with `GET /api/version`.

The build pipeline creates `artifacts/rdl-explorer-deployment.tgz` using `npm run package:deployment`. Treat this archive as an immutable release candidate and prefer promoting the same accepted artifact from Preview/UAT to Production rather than rebuilding from source between environments.

After deployment run:

```bash
npm run smoke:deployment -- https://<deployment-host>
```

`GET /api/metrics` provides process-local request/error/latency aggregates for diagnostics. Do not use these in-memory values as the authoritative cross-instance production dashboard. Export or aggregate telemetry through the hosting platform or an external monitoring service.

For promotion and rollback procedure, see `docs/DEPLOYMENT_RUNBOOK.md`.
