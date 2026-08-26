import { GovernanceAuthError, authenticateGovernanceIdentity, type HeaderBag } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { DatabaseRuntimeError } from "../../server/db/PgJsonClient.ts";
import { CrossRdlGovernanceRepository } from "../../server/rdl/CrossRdlGovernanceRepository.ts";
import { GovernanceService } from "../../server/rdl/GovernanceService.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { RuntimeConfigurationError, assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";

export type ApiRequest = { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined>; headers?: HeaderBag };
export type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void; setHeader?(name: string, value: string | number): void };

let rateLimiter: FixedWindowRateLimiter | undefined;
let rateLimitValue = 0;

export function authenticatedContext(request: ApiRequest, context?: RequestContext) {
  assertRuntimeEnvironment();
  const identity = authenticateGovernanceIdentity(request.headers);
  const limit = governanceRateLimit();
  const limiter = governanceRateLimiter(limit);
  const rate = limiter.consume(identity.reviewer);
  if (!rate.allowed) {
    throw new GovernanceRateLimitError(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)), limit);
  }
  const repository = new CrossRdlGovernanceRepository(getRdlDatabaseClient());
  if (context) {
    logRequest("info", "governance.authenticated", context, { reviewer: identity.reviewer, rateLimitRemaining: rate.remaining });
  }
  return { identity, service: new GovernanceService(repository), rate };
}

export function handleApiError(response: ApiResponse, error: unknown, context?: RequestContext) {
  if (error instanceof GovernanceRateLimitError) {
    response.setHeader?.("Retry-After", error.retryAfterSeconds);
    response.setHeader?.("X-RateLimit-Limit", error.limit);
    if (context) logRequest("warn", "governance.rate_limited", context, { statusCode: 429 });
    response.status(429).json({ error: "Too many governance requests; try again shortly." });
    return;
  }
  if (error instanceof GovernanceAuthError) {
    if (context) logRequest("warn", "governance.auth_rejected", context, { statusCode: error.statusCode });
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof RuntimeConfigurationError) {
    if (context) logRequest("error", "runtime.configuration_error", context, { statusCode: 503, errorCode: error.code });
    response.status(503).json({ error: "The governance runtime is not configured for this environment." });
    return;
  }
  if (error instanceof DatabaseRuntimeError) {
    if (context) logRequest("error", "governance.database_error", context, { statusCode: 503, errorCode: error.code });
    else console.error("Governance database request failed", { code: error.code });
    response.status(503).json({ error: "The governance database is temporarily unavailable." });
    return;
  }
  const message = error instanceof Error ? error.message : "Unexpected governance service error.";
  if (/required|unsupported|between|valid/i.test(message)) {
    if (context) logRequest("warn", "governance.validation_error", context, { statusCode: 400 });
    response.status(400).json({ error: message });
    return;
  }
  if (/version conflict/i.test(message)) {
    if (context) logRequest("warn", "governance.version_conflict", context, { statusCode: 409 });
    response.status(409).json({ error: message });
    return;
  }
  if (context) logRequest("error", "governance.api_error", context, { statusCode: 500 });
  else console.error("Governance API request failed", { message });
  response.status(500).json({ error: "The governance service could not complete the request." });
}

export function parseBody<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  throw new Error("A JSON request body is required.");
}

export function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export class GovernanceRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number, readonly limit: number) {
    super("Governance request rate limit exceeded.");
  }
}

function governanceRateLimit() {
  const configured = Number(process.env.RDL_GOVERNANCE_RATE_LIMIT_PER_MINUTE ?? "120");
  return Number.isInteger(configured) && configured >= 10 && configured <= 10_000 ? configured : 120;
}

function governanceRateLimiter(limit: number) {
  if (!rateLimiter || rateLimitValue !== limit) {
    rateLimiter = new FixedWindowRateLimiter(limit, 60_000);
    rateLimitValue = limit;
  }
  return rateLimiter;
}
