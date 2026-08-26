import type { HeaderBag } from "../server/auth/GovernanceIdentity.ts";
import { recordRequestMetric } from "../server/observability/RuntimeMetrics.ts";
import { createRequestContext, type RequestContext } from "../server/runtime/RequestContext.ts";
import { logRequest } from "../server/runtime/StructuredLogger.ts";

export type RuntimeRequest = { method?: string; headers?: HeaderBag };
export type RuntimeResponse = {
  status(code: number): RuntimeResponse;
  json(value: unknown): void;
  setHeader?(name: string, value: string | number): void;
};

export function beginApiRequest(
  request: RuntimeRequest,
  response: RuntimeResponse,
  route: string,
): RequestContext {
  const context = createRequestContext(request.headers, route, request.method ?? "UNKNOWN");
  response.setHeader?.("X-Request-ID", context.requestId);
  response.setHeader?.("Cache-Control", "no-store");
  return context;
}

export function completeApiRequest(context: RequestContext, statusCode: number, fields: Record<string, unknown> = {}) {
  recordRequestMetric(context, statusCode);
  logRequest(statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info", "api.request", context, {
    statusCode,
    ...fields,
  });
}
