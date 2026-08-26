# RDL Explorer — Deployment Runbook

## Purpose

This runbook defines the platform-neutral promotion, smoke-test and rollback procedure for the RDL Explorer production runtime. Platform-specific deployment mechanics may differ, but the release contract in this document must remain unchanged.

## Environment promotion model

Use three logical environments:

1. **Development** — local development and database integration testing.
2. **Preview / UAT** — immutable candidate release built from a pull request or release candidate commit.
3. **Production** — promoted known-good release after automated gates and smoke checks pass.

Do not rebuild application source between Preview/UAT acceptance and Production promotion where the hosting platform supports promotion of the same immutable artifact.

## Release metadata

Populate the following build/runtime metadata where supported:

- `RDL_RELEASE_ID` — human-readable deployment/release identifier.
- `RDL_COMMIT_SHA` — source commit SHA.
- `RDL_BUILD_VERSION` — application/build version.
- `RDL_BUILD_TIMESTAMP` — ISO-8601 build timestamp.

`GET /api/version` exposes non-secret release metadata for diagnostics and deployment verification.

## Build and package

Run:

```bash
npm ci
npm run test:rdl-014
npm run test:rdl-015
npm run test:regression
npm run build
npm run package:deployment
```

The package command creates:

```text
artifacts/rdl-explorer-deployment.tgz
```

The archive contains the built static application, API/server sources, package lock and the platform-neutral runtime manifest.

## Pre-production validation

Where a test PostgreSQL database is available, run:

```bash
npm run db:test:rdl-013
```

Validate production configuration before promotion:

```bash
RDL_RUNTIME_ENV=production npm run validate:production-env
```

## Deployment smoke test

After deployment:

```bash
npm run smoke:deployment -- https://<deployment-host>
```

The smoke test verifies:

- liveness returns HTTP 200;
- readiness returns HTTP 200;
- build/version metadata is reachable;
- `X-Request-ID` is present;
- unauthenticated governance access fails closed.

## Observability

`GET /api/metrics` returns process-local request counters, error counts and latency aggregates. These metrics are useful for diagnostics but are **not** a distributed production monitoring backend. Serverless and horizontally scaled deployments must export or aggregate equivalent telemetry through the hosting platform or an external observability service.

Operational dashboards should monitor at minimum:

- request volume;
- HTTP 4xx/5xx rates;
- governance review error/conflict rates;
- p50/p95/p99 API latency where the telemetry platform supports percentiles;
- readiness failures;
- PostgreSQL connectivity;
- deployment/release identifier.

## Rollback

Rollback is application-first:

1. Stop promotion of the faulty release.
2. Restore the previous known-good immutable release/artifact.
3. Verify `/api/health`, `/api/readiness` and `/api/version`.
4. Run the deployment smoke test against the restored release.
5. Confirm governance remains fail-closed for unauthenticated callers.
6. Open a corrective branch from current `main` or revert the faulty PR as appropriate.

RDL-015 introduces no database migration. If a future deployment includes database migrations, the migration-specific rollback/forward-fix strategy must be assessed separately before deployment.
