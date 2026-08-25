import { PgJsonClient } from "./PgJsonClient.ts";
import { getRdlDatabaseConfig } from "./config.ts";

let runtimeClient: PgJsonClient | undefined;

export function getRdlDatabaseClient(env: NodeJS.ProcessEnv = process.env) {
  if (!runtimeClient) {
    const config = getRdlDatabaseConfig(env);
    runtimeClient = PgJsonClient.fromConfig({
      connectionString: config.connectionString,
      max: config.poolMax,
      idleTimeoutMillis: config.idleTimeoutMs,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      application_name: "rdl-explorer",
      ssl: config.ssl ? { rejectUnauthorized: config.sslRejectUnauthorized } : undefined,
    });
  }
  return runtimeClient;
}

export async function closeRdlDatabaseClient() {
  const current = runtimeClient;
  runtimeClient = undefined;
  if (current) await current.close();
}

export function resetRdlDatabaseClientForTests() {
  runtimeClient = undefined;
}
