import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedProposalContext, handleApiError, queryValue, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.status");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, service } = authenticatedProposalContext(request, context);
    const requestKey = queryValue(request.query?.requestKey);
    const limit = Number(queryValue(request.query?.limit) || "100");
    if (requestKey) {
      const proposal = await service.status(identity, requestKey);
      if (!proposal) {
        completeApiRequest(context, 404, { consumer: identity.reviewer });
        response.status(404).json({ error: "Proposal not found." });
        return;
      }
      completeApiRequest(context, 200, { consumer: identity.reviewer, proposalId: proposal.externalProposalId });
      response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-status/v1", proposal });
      return;
    }
    const proposals = await service.list(identity, limit);
    completeApiRequest(context, 200, { consumer: identity.reviewer, proposalCount: proposals.length });
    response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-list/v1", proposals });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
