import assert from "node:assert/strict";
import { PgJsonClient, DatabaseRuntimeError, type PgPoolLike } from "../server/db/PgJsonClient.ts";
import { getRdlDatabaseConfig } from "../server/db/config.ts";

const config = getRdlDatabaseConfig({
  RDL_DATABASE_URL: "postgresql://example.invalid/rdl",
  RDL_DATABASE_POOL_MAX: "7",
  RDL_DATABASE_IDLE_TIMEOUT_MS: "12000",
  RDL_DATABASE_CONNECTION_TIMEOUT_MS: "2500",
  RDL_DATABASE_SSL: "true",
  RDL_DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
} as NodeJS.ProcessEnv);
assert.equal(config.poolMax, 7);
assert.equal(config.idleTimeoutMs, 12000);
assert.equal(config.connectionTimeoutMs, 2500);
assert.equal(config.ssl, true);
assert.equal(config.sslRejectUnauthorized, false);

let ended = false;
const fakePool: PgPoolLike = {
  totalCount: 2, idleCount: 1, waitingCount: 0,
  async query() { return { rows: [{ value: 42 }] as any[] }; },
  async connect() { throw new Error("not used by this test"); },
  async end() { ended = true; },
};
const client = new PgJsonClient(fakePool);
assert.deepEqual(await client.query("SELECT 42 AS value"), [{ value: 42 }]);
assert.deepEqual(client.poolStats(), { total: 2, idle: 1, waiting: 0 });
await client.close();
assert.equal(ended, true);

const failing = new PgJsonClient({
  async query() { const error = new Error("connection refused") as Error & { code: string }; error.code = "ECONNREFUSED"; throw error; },
  async connect() { throw new Error("not used"); }, async end() {},
} as PgPoolLike);
await assert.rejects(() => failing.query("SELECT 1"), (error: unknown) => {
  assert.ok(error instanceof DatabaseRuntimeError);
  assert.equal(error.code, "ECONNREFUSED");
  return true;
});

console.log("PASS RDL-013 production PostgreSQL runtime contract");
