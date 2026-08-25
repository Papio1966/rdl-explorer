import assert from "node:assert/strict";
import { getRdlDatabaseClient, closeRdlDatabaseClient } from "../server/db/runtime.ts";

const client = getRdlDatabaseClient();
try {
  const health = await client.health();
  assert.equal(health.ok, true, health.message ?? "database health failed");
  assert.equal(health.database, "rdl_explorer");
  const rows = await client.query<{ source_count: string }>("SELECT count(*)::text AS source_count FROM rdl.rdl_source");
  assert.ok(Number(rows[0]?.source_count ?? 0) >= 3, "expected the existing multi-RDL baseline");
  console.log("PASS RDL-013 PostgreSQL driver integration");
} finally {
  await closeRdlDatabaseClient();
}
