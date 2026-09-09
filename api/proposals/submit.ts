import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedProposalContext, handleApiError, parseBody, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.submit");
  if (request.method !== "POST") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, service } = authenticatedProposalContext(request, context);
    const body = parseBody<Record<string, unknown>>(request.body);
    const proposal = await service.submit(identity, body);
    completeApiRequest(context, 201, { consumer: identity.reviewer, proposalId: proposal.externalProposalId });
    response.status(201).json({ schemaVersion: "rdl-external-standards-proposal/v1", proposal });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
