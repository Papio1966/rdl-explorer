import { getRdlDatabaseClient } from "../server/db/runtime.ts";
import { RuntimeConfigurationError, assertRuntimeEnvironment } from "../server/runtime/environment.ts";
import { beginApiRequest, completeApiRequest, type RuntimeRequest, type RuntimeResponse } from "./_runtime.ts";

export default async function handler(request: RuntimeRequest, response: RuntimeResponse) {
  const context = beginApiRequest(request, response, "readiness");
  try {
    assertRuntimeEnvironment();
    const database = getRdlDatabaseClient();
    const health = await database.health();
    const statusCode = health.ok ? 200 : 503;
    completeApiRequest(context, statusCode, { databaseReady: health.ok });
    response.status(statusCode).json({
      ok: health.ok,
      service: "rdl-explorer",
      check: "readiness",
      database: health.database,
      message: health.ok ? undefined : "PostgreSQL is not ready.",
      pool: database.poolStats(),
    });
  } catch (error) {
    const configuration = error instanceof RuntimeConfigurationError;
    completeApiRequest(context, 503, { configurationError: configuration });
    response.status(503).json({
      ok: false,
      service: "rdl-explorer",
      check: "readiness",
      message: configuration ? "Runtime configuration is not ready." : "PostgreSQL is not ready.",
    });
  }
}
