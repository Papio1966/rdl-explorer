import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/assistant.ts", import.meta.url), "utf8");

for (const token of [
  "MAX_REQUEST_BYTES",
  "MAX_QUESTION_LENGTH",
  "MAX_CIS_CONTEXT_BYTES",
  "MAX_OUTPUT_TOKENS",
  "RATE_LIMIT",
  'status(415)',
  'status(413)',
  'status(429)',
  'Retry-After',
  'store: false',
]) {
  assert.ok(api.includes(token), `Missing Assistant API hardening contract: ${token}`);
}

assert.ok(!api.includes("payload?.error?.message ||"), "Raw provider error messages must not be returned to clients");
assert.ok(api.includes('console.error("Assistant provider returned an error"'), "Provider failures should remain observable server-side");
assert.ok(api.includes('x-forwarded-for'), "Best-effort per-client rate limiting must use the forwarded client address");

console.log("PASS Assistant API hardening: validation, size bounds, rate guard, output bound and safe provider errors are present.");
