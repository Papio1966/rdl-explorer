import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedProposalReviewContext, handleApiError, parseBody, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.review");
  if (request.method !== "POST") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, service } = authenticatedProposalReviewContext(request, context);
    const body = parseBody<Record<string, unknown>>(request.body);
    const proposal = await service.review(identity, body);
    completeApiRequest(context, 200, { reviewer: identity.reviewer, proposalId: proposal.externalProposalId });
    response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-review/v1", proposal });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
