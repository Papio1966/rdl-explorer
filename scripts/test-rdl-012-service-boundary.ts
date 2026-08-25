import assert from "node:assert/strict";
import { authenticateGovernanceIdentity, signGovernanceIdentity } from "../server/auth/GovernanceIdentity.ts";

const secret = "test-governance-secret";
const timestamp = new Date().toISOString();
const roles = ["rdl-mapping-reviewer", "engineering-data"];
const signature = signGovernanceIdentity("reviewer@example.test", timestamp, roles, secret);
const headers = {
  "x-rdl-reviewer": "reviewer@example.test",
  "x-rdl-auth-timestamp": timestamp,
  "x-rdl-roles": roles.join(","),
  "x-rdl-auth-signature": signature,
};

const identity = authenticateGovernanceIdentity(headers, { RDL_GOVERNANCE_AUTH_SECRET: secret } as NodeJS.ProcessEnv);
assert.equal(identity.reviewer, "reviewer@example.test");
assert.ok(identity.roles.includes("rdl-mapping-reviewer"));

assert.throws(
  () => authenticateGovernanceIdentity({ ...headers, "x-rdl-auth-signature": "0".repeat(64) }, { RDL_GOVERNANCE_AUTH_SECRET: secret } as NodeJS.ProcessEnv),
  /signature is invalid/,
);

const unauthorizedRoles = ["engineering-data"];
assert.throws(
  () => authenticateGovernanceIdentity({
    ...headers,
    "x-rdl-roles": unauthorizedRoles.join(","),
    "x-rdl-auth-signature": signGovernanceIdentity("reviewer@example.test", timestamp, unauthorizedRoles, secret),
  }, { RDL_GOVERNANCE_AUTH_SECRET: secret } as NodeJS.ProcessEnv),
  /not authorized/,
);

const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
assert.throws(
  () => authenticateGovernanceIdentity({
    ...headers,
    "x-rdl-auth-timestamp": staleTimestamp,
    "x-rdl-auth-signature": signGovernanceIdentity("reviewer@example.test", staleTimestamp, roles, secret),
  }, { RDL_GOVERNANCE_AUTH_SECRET: secret } as NodeJS.ProcessEnv),
  /stale or invalid/,
);

console.log("PASS RDL-012 authenticated governance service boundary");
