import { getRdlDatabaseClient } from "../server/db/runtime.ts";

export type ReadinessResponse = { status(code: number): ReadinessResponse; json(value: unknown): void; setHeader?(name: string, value: string | number): void };

export default async function handler(_request: unknown, response: ReadinessResponse) {
  const database = getRdlDatabaseClient();
  const health = await database.health();
  response.setHeader?.("Cache-Control", "no-store");
  response.status(health.ok ? 200 : 503).json({
    ok: health.ok,
    service: "rdl-explorer",
    check: "readiness",
    database: health.database,
    message: health.ok ? undefined : "PostgreSQL is not ready.",
    pool: database.poolStats(),
  });
}
