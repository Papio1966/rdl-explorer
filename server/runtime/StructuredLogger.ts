import type { RequestContext } from "./RequestContext.ts";
import { requestDurationMs } from "./RequestContext.ts";

export type LogLevel = "info" | "warn" | "error";

export function logRequest(
  level: LogLevel,
  event: string,
  context: RequestContext,
  fields: Record<string, unknown> = {},
) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "rdl-explorer",
    event,
    requestId: context.requestId,
    route: context.route,
    method: context.method,
    durationMs: requestDurationMs(context),
    ...sanitizeFields(fields),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function sanitizeFields(fields: Record<string, unknown>) {
  const blocked = new Set([
    "authorization",
    "cookie",
    "password",
    "secret",
    "signature",
    "rdl_database_url",
    "rdl_governance_auth_secret",
  ]);
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      blocked.has(key.toLowerCase()) ? "[redacted]" : safeValue(value),
    ]),
  );
}

function safeValue(value: unknown): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map(safeValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, nested]) => [key, safeValue(nested)]),
    );
  }
  return String(value);
}
