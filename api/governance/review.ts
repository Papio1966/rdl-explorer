import type { MappingReviewAction } from "../../server/rdl/CrossRdlGovernanceRepository.ts";
import { authenticatedContext, handleApiError, parseBody, type ApiRequest, type ApiResponse } from "./_shared.ts";

type ReviewBody = { mappingId?: number; action?: MappingReviewAction; rationale?: string; expectedVersion?: number; evidence?: Record<string, unknown>; successorMappingId?: number };

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity, service } = authenticatedContext(request);
    const body = parseBody<ReviewBody>(request.body);
    const result = await service.review(identity, {
      mappingId: Number(body.mappingId), action: body.action as MappingReviewAction,
      rationale: String(body.rationale ?? ""), expectedVersion: Number(body.expectedVersion),
      evidence: body.evidence, successorMappingId: body.successorMappingId == null ? undefined : Number(body.successorMappingId),
    });
    response.setHeader?.("Cache-Control", "no-store");
    response.status(200).json({ reviewer: identity.reviewer, result });
  } catch (error) { handleApiError(response, error); }
}
