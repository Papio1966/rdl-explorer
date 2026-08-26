import type { MappingReviewAction } from "../../server/rdl/CrossRdlGovernanceRepository.ts";
import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedContext, handleApiError, parseBody, type ApiRequest, type ApiResponse } from "./_shared.ts";

type ReviewBody = { mappingId?: number; action?: MappingReviewAction; rationale?: string; expectedVersion?: number; evidence?: Record<string, unknown>; successorMappingId?: number };

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "governance.review");
  if (request.method !== "POST") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, service, rate } = authenticatedContext(request, context);
    response.setHeader?.("X-RateLimit-Limit", rate.limit);
    response.setHeader?.("X-RateLimit-Remaining", rate.remaining);
    const body = parseBody<ReviewBody>(request.body);
    const result = await service.review(identity, {
      mappingId: Number(body.mappingId), action: body.action as MappingReviewAction,
      rationale: String(body.rationale ?? ""), expectedVersion: Number(body.expectedVersion),
      evidence: body.evidence, successorMappingId: body.successorMappingId == null ? undefined : Number(body.successorMappingId),
    });
    completeApiRequest(context, 200, { reviewer: identity.reviewer, mappingId: Number(body.mappingId), action: body.action ?? "unknown" });
    response.status(200).json({ reviewer: identity.reviewer, result });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
