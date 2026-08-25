export const DEFAULT_LOCAL_RDL_DATABASE_URL =
  "postgresql://localhost:5432/rdl_explorer";

export type RdlDatabaseConfig = {
  connectionString: string;
};

export function getRdlDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): RdlDatabaseConfig {
  return {
    connectionString:
      env.RDL_DATABASE_URL?.trim() || DEFAULT_LOCAL_RDL_DATABASE_URL,
  };
}
