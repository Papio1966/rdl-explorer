import assert from "node:assert/strict";

const baseUrl = (process.argv[2] ?? process.env.RDL_SMOKE_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Usage: npm run smoke:deployment -- https://deployment.example.com");
  process.exit(2);
}

await check("/api/health", 200, (body) => {
  assert.equal(body.ok, true);
  assert.equal(body.check, "liveness");
});

await check("/api/version", 200, (body) => {
  assert.equal(body.ok, true);
  assert.equal(body.service, "rdl-explorer");
});

await check("/api/readiness", 200, (body) => {
  assert.equal(body.ok, true);
  assert.equal(body.check, "readiness");
});

const governance = await fetch(`${baseUrl}/api/governance/session`, { headers: { "x-request-id": "rdl-smoke-governance" } });
assert.ok([401, 403, 503].includes(governance.status), `Unauthenticated governance session must fail closed; received ${governance.status}`);
assert.ok(governance.headers.get("x-request-id"), "Governance response must include X-Request-ID");

console.log(`PASS RDL deployment smoke test: ${baseUrl}`);

async function check(path: string, expectedStatus: number, validate: (body: Record<string, unknown>) => void) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { "x-request-id": `rdl-smoke-${path.split("/").pop()}` } });
  assert.equal(response.status, expectedStatus, `${path} returned ${response.status}`);
  assert.ok(response.headers.get("x-request-id"), `${path} must include X-Request-ID`);
  const body = await response.json() as Record<string, unknown>;
  validate(body);
}
