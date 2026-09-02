import { DatabaseRuntimeError } from "../../server/db/PgJsonClient.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import {
  RdlRuntimeReadInputError,
  RdlRuntimeReadService,
  RdlRuntimeReleaseNotFoundError,
} from "../../server/rdl/RdlRuntimeReadService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { completeApiRequest, type RuntimeRequest, type RuntimeResponse } from "../_runtime.ts";

export type ApiRequest = RuntimeRequest & {
  query?: Record<string, string | string[] | undefined>;
};
export type ApiResponse = RuntimeResponse;

let service: RdlRuntimeReadService | undefined;

export function getRuntimeReadService() {
  service ??= new RdlRuntimeReadService(getRdlDatabaseClient());
  return service;
}

export function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
}

export function queryInteger(value: string | string[] | undefined) {
  const raw = queryValue(value);
  return raw ? Number(raw) : undefined;
}

export function handleRuntimeReadError(response: ApiResponse, error: unknown, context: RequestContext) {
  if (error instanceof RdlRuntimeReadInputError) {
    completeApiRequest(context, 400, { errorType: "input" });
    response.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof RdlRuntimeReleaseNotFoundError) {
    completeApiRequest(context, 404, { errorType: "release-not-found" });
    response.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof DatabaseRuntimeError) {
    completeApiRequest(context, 503, { errorType: "database" });
    response.status(503).json({ error: "PostgreSQL runtime read is not available." });
    return;
  }
  completeApiRequest(context, 500, { errorType: "unexpected" });
  response.status(500).json({ error: "RDL runtime read failed." });
}
