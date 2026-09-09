import { createHash } from "node:crypto";
import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { ExternalStandardsProposalBundleRepository } from "./ExternalStandardsProposalBundleRepository.ts";

const LEVELS = new Set(["project", "asset", "company", "industry", "unknown"]);
const TARGET_LEVELS = new Set(["project", "asset", "company", "industry"]);
const REVIEW_ACTIONS = new Set(["start_review", "accept", "reject", "withdraw", "link_publication"]);

export class ExternalStandardsProposalBundleService {
  constructor(private readonly repository: ExternalStandardsProposalBundleRepository) {}

  submit(identity: GovernanceIdentity, body: Record<string, unknown>) {
    const requestKey = requiredText(body.requestKey, "requestKey");
    const consumerKey = identity.reviewer.trim();
    const sourceSystem = requiredText(body.sourceSystem ?? "DATAGATE", "sourceSystem");
    const sourceLevel = enumText(body.sourceLevel, LEVELS, "sourceLevel");
    const targetLevel = enumText(body.targetLevel, TARGET_LEVELS, "targetLevel");
    const targetContextKey = requiredText(body.targetContextKey, "targetContextKey");
    const parentPackageId = positiveInteger(body.parentPackageId, "parentPackageId");
    const bundlePayload = objectValue(body.bundlePayload, "bundlePayload");
    const sourceEvidence = objectValue(body.sourceEvidence ?? {}, "sourceEvidence");
    const rationale = requiredText(body.rationale, "rationale");
    const promotionTargetLevel = optionalEnumText(body.promotionTargetLevel, TARGET_LEVELS, "promotionTargetLevel");
    const promotionTargetContextKey = optionalText(body.promotionTargetContextKey);
    const explicitHash = optionalText(body.bundleSha256) ?? optionalText(body.sourcePseContentHash);
    const bundleSha256 = explicitHash ? sha256Text(explicitHash, "bundleSha256") : sha256(stableJson({ requestKey, bundlePayload, sourceEvidence }));
    requireArray(bundlePayload.components, "bundlePayload.components");
    requireArray(bundlePayload.dependencies ?? [], "bundlePayload.dependencies");
    return this.repository.submit({ consumerKey, requestKey, bundleSha256, proposerKey: identity.reviewer, sourceSystem, sourceLevel, targetLevel, targetContextKey, parentPackageId, bundlePayload, sourceEvidence, rationale, promotionTargetLevel, promotionTargetContextKey });
  }

  review(identity: GovernanceIdentity, body: Record<string, unknown>) {
    const proposalBundleId = positiveInteger(body.proposalBundleId, "proposalBundleId");
    const action = enumText(body.action, REVIEW_ACTIONS, "action") as "start_review" | "accept" | "reject" | "withdraw" | "link_publication";
    const rationale = requiredText(body.rationale, "rationale");
    const expectedVersion = nonNegativeInteger(body.expectedVersion, "expectedVersion");
    return this.repository.review({ proposalBundleId, action, actorKey: identity.reviewer, rationale, expectedVersion, evidence: objectValue(body.evidence ?? {}, "evidence"), publicationResult: objectValue(body.publicationResult ?? {}, "publicationResult") });
  }

  status(identity: GovernanceIdentity, requestKey: string) {
    return this.repository.byRequest(identity.reviewer, requiredText(requestKey, "requestKey"));
  }

  list(identity: GovernanceIdentity, limit: number) {
    return this.repository.list(identity.reviewer, Number.isFinite(limit) ? limit : 100);
  }
}

function requiredText(value: unknown, name: string): string { const text = optionalText(value); if (!text) throw new Error(`${name} is required.`); return text; }
function optionalText(value: unknown): string | undefined { if (typeof value !== "string") return undefined; const trimmed = value.trim(); return trimmed.length > 0 ? trimmed : undefined; }
function enumText(value: unknown, allowed: Set<string>, name: string): string { const text = requiredText(value, name); if (!allowed.has(text)) throw new Error(`${name} is not supported.`); return text; }
function optionalEnumText(value: unknown, allowed: Set<string>, name: string): string | undefined { const text = optionalText(value); if (!text) return undefined; if (!allowed.has(text)) throw new Error(`${name} is not supported.`); return text; }
function positiveInteger(value: unknown, name: string): number { const number = Number(value); if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer.`); return number; }
function nonNegativeInteger(value: unknown, name: string): number { const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${name} must be a non-negative integer.`); return number; }
function objectValue(value: unknown, name: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object.`); return value as Record<string, unknown>; }
function requireArray(value: unknown, name: string): void { if (!Array.isArray(value)) throw new Error(`${name} must be an array.`); }
function sha256Text(value: string, name: string): string { const normalized = value.trim().toLowerCase(); if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(`${name} must be a 64 character SHA-256.`); return normalized; }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function stableJson(value: unknown): string { return JSON.stringify(sortJson(value)); }
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJson(entry)]));
}
