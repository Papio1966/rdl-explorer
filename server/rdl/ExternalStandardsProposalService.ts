import { createHash } from "node:crypto";
import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { ExternalStandardsProposalRepository } from "./ExternalStandardsProposalRepository.ts";

const LEVELS = new Set(["project", "asset", "company", "industry", "unknown"]);
const TARGET_LEVELS = new Set(["project", "asset", "company", "industry"]);
const CHANGE_KINDS = new Set(["add", "override", "retire", "relationship_delta"]);
const REVIEW_ACTIONS = new Set(["start_review", "accept", "reject", "withdraw", "link_publication"]);

export class ExternalStandardsProposalService {
  constructor(private readonly repository: ExternalStandardsProposalRepository) {}

  submit(identity: GovernanceIdentity, body: Record<string, unknown>) {
    const requestKey = requiredText(body.requestKey, "requestKey");
    const consumerKey = identity.reviewer.trim();
    const proposerKey = text(body.proposerKey) || consumerKey;
    const sourceSystem = requiredText(body.sourceSystem, "sourceSystem");
    const sourceLevel = enumText(body.sourceLevel, LEVELS, "sourceLevel");
    const targetLevel = enumText(body.targetLevel, TARGET_LEVELS, "targetLevel");
    const targetContextKey = requiredText(body.targetContextKey, "targetContextKey");
    const parentPackageId = positiveInteger(body.parentPackageId, "parentPackageId");
    const changeKind = enumText(body.changeKind, CHANGE_KINDS, "changeKind");
    const entityTypeCode = requiredText(body.entityTypeCode, "entityTypeCode");
    const nativeIdentifier = requiredText(body.nativeIdentifier, "nativeIdentifier");
    const deltaPayload = objectValue(body.deltaPayload, "deltaPayload");
    const sourceEvidence = objectValue(body.sourceEvidence, "sourceEvidence");
    const rationale = requiredText(body.rationale, "rationale");
    if (rationale.length < 10) throw new Error("rationale must be at least 10 characters.");
    const promotionTargetLevel = optionalEnumText(body.promotionTargetLevel, TARGET_LEVELS, "promotionTargetLevel");
    const promotionTargetContextKey = text(body.promotionTargetContextKey) || undefined;
    const proposalSha256 = sha256Stable({
      consumerKey,
      requestKey,
      proposerKey,
      sourceSystem,
      sourceLevel,
      targetLevel,
      targetContextKey,
      parentPackageId,
      changeKind,
      entityTypeCode,
      nativeIdentifier,
      deltaPayload,
      sourceEvidence,
      promotionTargetLevel,
      promotionTargetContextKey,
    });

    return this.repository.submit({
      consumerKey,
      requestKey,
      proposalSha256,
      proposerKey,
      sourceSystem,
      sourceLevel,
      targetLevel,
      targetContextKey,
      parentPackageId,
      changeKind,
      entityTypeCode,
      nativeIdentifier,
      deltaPayload,
      sourceEvidence,
      rationale,
      promotionTargetLevel,
      promotionTargetContextKey,
    });
  }

  review(identity: GovernanceIdentity, body: Record<string, unknown>) {
    const proposalId = positiveInteger(body.proposalId, "proposalId");
    const action = enumText(body.action, REVIEW_ACTIONS, "action") as "start_review" | "accept" | "reject" | "withdraw" | "link_publication";
    const rationale = requiredText(body.rationale, "rationale");
    if (rationale.length < 10) throw new Error("rationale must be at least 10 characters.");
    const expectedVersion = nonNegativeInteger(body.expectedVersion, "expectedVersion");
    return this.repository.review({
      proposalId,
      action,
      actorKey: identity.reviewer,
      rationale,
      expectedVersion,
      evidence: objectValue(body.evidence, "evidence"),
      publicationResult: objectValue(body.publicationResult, "publicationResult"),
    });
  }

  status(identity: GovernanceIdentity, requestKey: string) {
    const key = requiredText(requestKey, "requestKey");
    return this.repository.byRequest(identity.reviewer, key);
  }

  list(identity: GovernanceIdentity, limit: number) {
    return this.repository.list(identity.reviewer, limit);
  }
}

function requiredText(value: unknown, label: string) {
  const v = text(value);
  if (!v) throw new Error(`${label} is required.`);
  return v;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function enumText(value: unknown, allowed: Set<string>, label: string) {
  const v = requiredText(value, label);
  if (!allowed.has(v)) throw new Error(`${label} is invalid.`);
  return v;
}

function optionalEnumText(value: unknown, allowed: Set<string>, label: string) {
  const v = text(value);
  if (!v) return undefined;
  if (!allowed.has(v)) throw new Error(`${label} is invalid.`);
  return v;
}

function positiveInteger(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${label} must be a positive integer.`);
  return n;
}

function nonNegativeInteger(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer.`);
  return n;
}

function objectValue(value: unknown, label: string) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function sha256Stable(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}
