# RDL Explorer — Production Deployment & Runtime Hardening

## Purpose

RDL-014 defines the operational contract for deploying RDL Explorer's database-backed governance service safely. It does not move trust into the browser and does not replace enterprise platform controls such as an identity-aware gateway, WAF, centralized log sink or secret manager.

## Request path

```text
Browser
  -> trusted identity gateway / BFF
      -> RDL Explorer API function
          -> request context + correlation ID
          -> authenticated governance identity
          -> per-runtime defensive rate limit
          -> GovernanceService
          -> PostgreSQL pool
```

The gateway MUST remove client-provided `x-rdl-reviewer`, `x-rdl-roles`, `x-rdl-auth-timestamp` and `x-rdl-auth-signature` values before injecting a trusted signed assertion.

## Required production configuration

Production startup/readiness fails closed when the following are not explicitly configured:

- `RDL_DATABASE_URL` — must not use the localhost development fallback.
- `RDL_GOVERNANCE_AUTH_SECRET` — minimum 32 characters.
- `RDL_GOVERNANCE_RATE_LIMIT_PER_MINUTE` — integer between 10 and 10000; default 120.

The following should also be set deliberately:

- `RDL_DATABASE_SSL=true` unless the hosting network guarantees encrypted database transport by another mechanism.
- `RDL_DATABASE_SSL_REJECT_UNAUTHORIZED=true` for certificate verification where the provider supports a trusted certificate chain.
- `RDL_DATABASE_POOL_MAX`, `RDL_DATABASE_IDLE_TIMEOUT_MS`, `RDL_DATABASE_CONNECTION_TIMEOUT_MS` according to the database/service limits.
- `RDL_RELEASE_ID` to a non-secret deployment identifier if operational correlation to a release is desired.

Run the pre-deployment validation with production values present:

```bash
npm run validate:production-env
```

Do not print secrets or the database URL in deployment logs.

## Correlation IDs and structured logs

Every hardened API request receives an `X-Request-ID` response header. A safe incoming `x-request-id` from the trusted platform is preserved; otherwise RDL Explorer generates a UUID.

Operational API events are emitted as one-line JSON with:

- timestamp
- level
- service
- event
- requestId
- route
- method
- durationMs
- non-sensitive event fields

Secrets, authorization material and signatures must never be added to structured log fields. Production hosting should forward stdout/stderr to the enterprise log and alerting platform.

## Governance rate limiting

RDL Explorer applies a defensive fixed-window rate limit keyed to the authenticated reviewer. The browser receives `X-RateLimit-Limit` and `X-RateLimit-Remaining`; a blocked request receives HTTP 429 and `Retry-After`.

This in-process limiter is intentionally not presented as a globally distributed control. Serverless instances can have separate memory. Production MUST also configure the identity gateway/WAF/API platform with a distributed rate limit and abuse protection.

## Liveness and readiness

`GET /api/health` is a liveness check. It does not depend on PostgreSQL and may include `RDL_RELEASE_ID` when configured.

`GET /api/readiness` checks runtime configuration and PostgreSQL connectivity. It returns 503 when configuration or database connectivity is not ready. Pool counters are non-sensitive operational metadata.

Recommended orchestration behavior:

- liveness failure: restart/replace the application instance.
- readiness failure: stop routing governance traffic while leaving the process available for diagnosis.

## Graceful shutdown

`server/runtime/shutdown.ts` exposes signal handlers that close the PostgreSQL pool on `SIGTERM` or `SIGINT` for long-lived/self-hosted Node runtimes. Serverless hosts manage lifecycle differently; the shared pool remains a runtime singleton and is reused while an isolate stays warm.

## Secrets

Store all secrets in the deployment platform's secret manager. Never commit `.env` values, database credentials, the governance signing secret or provider API keys.

At minimum treat these as secrets:

- `RDL_DATABASE_URL`
- `RDL_GOVERNANCE_AUTH_SECRET`
- `OPENAI_API_KEY`

## Deployment checks

Before production promotion:

```bash
npm ci
npm run test:rdl-014
npm run test:regression
npm run build
```

Where a test database is available, also run the RDL-013 PostgreSQL integration test.

After deployment verify:

1. `/api/health` returns 200 and an `X-Request-ID`.
2. `/api/readiness` returns 200 only when PostgreSQL is reachable.
3. unauthenticated governance requests fail closed.
4. an authorized reviewer can load the live queue.
5. invalid/stale signatures are rejected.
6. governance rate-limit headers are present.
7. structured request logs contain correlation IDs and no secrets.

## Rollback

Rollback by redeploying the previous known-good application release. RDL-014 introduces no database migration, so application rollback does not require a database schema rollback.
