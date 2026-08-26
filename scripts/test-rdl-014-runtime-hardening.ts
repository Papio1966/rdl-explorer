import assert from "node:assert/strict";
import { FixedWindowRateLimiter } from "../server/runtime/RateLimiter.ts";
import { createRequestContext } from "../server/runtime/RequestContext.ts";
import { inspectRuntimeEnvironment } from "../server/runtime/environment.ts";

const preserved = createRequestContext({ "x-request-id": "trace-123" }, "governance.queue", "GET", 1_000);
assert.equal(preserved.requestId, "trace-123");
assert.equal(preserved.route, "governance.queue");

const replaced = createRequestContext({ "x-request-id": "unsafe request id with spaces" }, "health", "GET", 1_000);
assert.notEqual(replaced.requestId, "unsafe request id with spaces");
assert.ok(replaced.requestId.length > 10);

const limiter = new FixedWindowRateLimiter(2, 60_000);
assert.equal(limiter.consume("reviewer@example.com", 1_000).allowed, true);
assert.equal(limiter.consume("reviewer@example.com", 1_001).allowed, true);
const blocked = limiter.consume("reviewer@example.com", 1_002);
assert.equal(blocked.allowed, false);
assert.equal(blocked.remaining, 0);
assert.equal(limiter.consume("reviewer@example.com", 61_001).allowed, true);

const productionBad = inspectRuntimeEnvironment({
  VERCEL_ENV: "production",
  RDL_DATABASE_URL: "postgresql://localhost:5432/rdl_explorer",
  RDL_GOVERNANCE_AUTH_SECRET: "short",
  RDL_GOVERNANCE_RATE_LIMIT_PER_MINUTE: "120",
} as NodeJS.ProcessEnv);
assert.equal(productionBad.production, true);
assert.ok(productionBad.errors.some((item) => item.includes("RDL_DATABASE_URL")));
assert.ok(productionBad.errors.some((item) => item.includes("RDL_GOVERNANCE_AUTH_SECRET")));

const productionGood = inspectRuntimeEnvironment({
  VERCEL_ENV: "production",
  RDL_DATABASE_URL: "postgresql://db.example.internal:5432/rdl_explorer",
  RDL_GOVERNANCE_AUTH_SECRET: "12345678901234567890123456789012",
  RDL_DATABASE_SSL: "true",
  RDL_GOVERNANCE_RATE_LIMIT_PER_MINUTE: "120",
} as NodeJS.ProcessEnv);
assert.deepEqual(productionGood.errors, []);

console.log("PASS RDL-014 production deployment and runtime hardening contract");
