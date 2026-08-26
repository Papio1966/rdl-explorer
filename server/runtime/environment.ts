import { DEFAULT_LOCAL_RDL_DATABASE_URL } from "../db/config.ts";

export type RuntimeEnvironmentReport = {
  production: boolean;
  errors: string[];
  warnings: string[];
};

export function inspectRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironmentReport {
  const production = env.VERCEL_ENV === "production" || env.RDL_RUNTIME_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const databaseUrl = env.RDL_DATABASE_URL?.trim();
  const authSecret = env.RDL_GOVERNANCE_AUTH_SECRET?.trim();

  if (production) {
    if (!databaseUrl || databaseUrl === DEFAULT_LOCAL_RDL_DATABASE_URL) {
      errors.push("RDL_DATABASE_URL must be explicitly configured for production.");
    }
    if (!authSecret || authSecret.length < 32) {
      errors.push("RDL_GOVERNANCE_AUTH_SECRET must contain at least 32 characters in production.");
    }
    if (env.RDL_DATABASE_SSL?.trim().toLowerCase() !== "true") {
      warnings.push("RDL_DATABASE_SSL is not enabled for production; verify the hosting network guarantees transport security.");
    }
  }

  const rateLimit = Number(env.RDL_GOVERNANCE_RATE_LIMIT_PER_MINUTE ?? "120");
  if (!Number.isInteger(rateLimit) || rateLimit < 10 || rateLimit > 10_000) {
    errors.push("RDL_GOVERNANCE_RATE_LIMIT_PER_MINUTE must be an integer between 10 and 10000.");
  }

  return { production, errors, warnings };
}

export function assertRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const report = inspectRuntimeEnvironment(env);
  if (report.errors.length) {
    throw new RuntimeConfigurationError(report.errors.join(" "));
  }
  return report;
}

export class RuntimeConfigurationError extends Error {
  readonly code = "RDL_RUNTIME_CONFIGURATION";
}
