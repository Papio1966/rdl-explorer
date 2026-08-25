export const DEFAULT_LOCAL_RDL_DATABASE_URL =
  "postgresql://localhost:5432/rdl_explorer";

export type RdlDatabaseConfig = {
  connectionString: string;
  poolMax: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
};

export function getRdlDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): RdlDatabaseConfig {
  return {
    connectionString:
      env.RDL_DATABASE_URL?.trim() || DEFAULT_LOCAL_RDL_DATABASE_URL,
    poolMax: integerSetting(env.RDL_DATABASE_POOL_MAX, 10, 1, 50),
    idleTimeoutMs: integerSetting(env.RDL_DATABASE_IDLE_TIMEOUT_MS, 30_000, 1_000, 300_000),
    connectionTimeoutMs: integerSetting(env.RDL_DATABASE_CONNECTION_TIMEOUT_MS, 5_000, 500, 60_000),
    ssl: booleanSetting(env.RDL_DATABASE_SSL, false),
    sslRejectUnauthorized: booleanSetting(env.RDL_DATABASE_SSL_REJECT_UNAUTHORIZED, true),
  };
}

function integerSetting(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function booleanSetting(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}
