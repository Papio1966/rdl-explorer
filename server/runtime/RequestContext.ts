import { randomUUID } from "node:crypto";
import type { HeaderBag } from "../auth/GovernanceIdentity.ts";

export type RequestContext = {
  requestId: string;
  route: string;
  method: string;
  startedAt: number;
};

export function createRequestContext(
  headers: HeaderBag | undefined,
  route: string,
  method = "UNKNOWN",
  now = Date.now(),
): RequestContext {
  const supplied = headerValue(headers, "x-request-id").trim();
  const requestId = isSafeRequestId(supplied) ? supplied : randomUUID();
  return { requestId, route, method: method || "UNKNOWN", startedAt: now };
}

export function requestDurationMs(context: RequestContext, now = Date.now()) {
  return Math.max(0, now - context.startedAt);
}

function isSafeRequestId(value: string) {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function headerValue(headers: HeaderBag | undefined, name: string) {
  if (!headers) return "";
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
