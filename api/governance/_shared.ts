import { GovernanceAuthError, authenticateGovernanceIdentity, type HeaderBag } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { DatabaseRuntimeError } from "../../server/db/PgJsonClient.ts";
import { CrossRdlGovernanceRepository } from "../../server/rdl/CrossRdlGovernanceRepository.ts";
import { GovernanceService } from "../../server/rdl/GovernanceService.ts";

export type ApiRequest = { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined>; headers?: HeaderBag };
export type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void; setHeader?(name: string, value: string | number): void };

export function authenticatedContext(request: ApiRequest) {
  const identity = authenticateGovernanceIdentity(request.headers);
  const repository = new CrossRdlGovernanceRepository(getRdlDatabaseClient());
  return { identity, service: new GovernanceService(repository) };
}

export function handleApiError(response: ApiResponse, error: unknown) {
  if (error instanceof GovernanceAuthError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof DatabaseRuntimeError) {
    console.error("Governance database request failed", { code: error.code });
    response.status(503).json({ error: "The governance database is temporarily unavailable." });
    return;
  }
  const message = error instanceof Error ? error.message : "Unexpected governance service error.";
  if (/required|unsupported|between|valid/i.test(message)) {
    response.status(400).json({ error: message });
    return;
  }
  if (/version conflict/i.test(message)) {
    response.status(409).json({ error: message });
    return;
  }
  console.error("Governance API request failed", { message });
  response.status(500).json({ error: "The governance service could not complete the request." });
}

export function parseBody<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  throw new Error("A JSON request body is required.");
}

export function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
