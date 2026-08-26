import { createHmac, timingSafeEqual } from "node:crypto";

export const GOVERNANCE_REVIEWER_ROLE = "rdl-mapping-reviewer";
export const EXTENSION_REVIEWER_ROLE = "rdl-extension-reviewer";
export const PACKAGE_CONSUMER_ROLE = "rdl-package-consumer";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type GovernanceIdentity = {
  reviewer: string;
  roles: string[];
  authenticatedAt: string;
};

export type HeaderBag = Record<string, string | string[] | undefined>;

export function signGovernanceIdentity(
  reviewer: string,
  timestamp: string,
  roles: string[],
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(canonicalIdentity(reviewer, timestamp, roles))
    .digest("hex");
}

export function authenticateGovernanceIdentity(
  headers: HeaderBag | undefined,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
  requiredRole = GOVERNANCE_REVIEWER_ROLE,
): GovernanceIdentity {
  const secret = env.RDL_GOVERNANCE_AUTH_SECRET?.trim();
  if (!secret) throw new GovernanceAuthError(503, "Governance authentication is not configured.");

  const reviewer = getHeader(headers, "x-rdl-reviewer").trim();
  const timestamp = getHeader(headers, "x-rdl-auth-timestamp").trim();
  const rawRoles = getHeader(headers, "x-rdl-roles").trim();
  const suppliedSignature = getHeader(headers, "x-rdl-auth-signature").trim().toLowerCase();
  if (!reviewer || !timestamp || !rawRoles || !suppliedSignature) {
    throw new GovernanceAuthError(401, "Authenticated governance identity headers are required.");
  }

  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp) || Math.abs(now - parsedTimestamp) > MAX_CLOCK_SKEW_MS) {
    throw new GovernanceAuthError(401, "Governance identity signature is stale or invalid.");
  }

  const roles = normalizeRoles(rawRoles.split(","));
  const expectedSignature = signGovernanceIdentity(reviewer, timestamp, roles, secret);
  if (!safeEqualHex(suppliedSignature, expectedSignature)) {
    throw new GovernanceAuthError(401, "Governance identity signature is invalid.");
  }
  if (!roles.includes(requiredRole)) {
    throw new GovernanceAuthError(403, `The authenticated user is not authorized for required governance role ${requiredRole}.`);
  }

  return { reviewer, roles, authenticatedAt: timestamp };
}

export class GovernanceAuthError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function canonicalIdentity(reviewer: string, timestamp: string, roles: string[]) {
  return `${reviewer.trim()}\n${timestamp.trim()}\n${normalizeRoles(roles).join(",")}`;
}

function normalizeRoles(roles: string[]) {
  return [...new Set(roles.map((role) => role.trim().toLowerCase()).filter(Boolean))].sort();
}

function safeEqualHex(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function getHeader(headers: HeaderBag | undefined, name: string) {
  if (!headers) return "";
  const direct = headers[name];
  if (direct !== undefined) return Array.isArray(direct) ? direct[0] ?? "" : direct;
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
