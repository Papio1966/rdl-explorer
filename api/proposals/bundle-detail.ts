import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedProposalReviewContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { ExternalStandardsProposalBundleReadbackService } from "../../server/rdl/ExternalStandardsProposalBundleReadbackService.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.bundle.detail");
  if (request.method !== "GET") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity } = authenticatedProposalReviewContext(request, context);
    const service = new ExternalStandardsProposalBundleReadbackService(getRdlDatabaseClient());
    const proposalBundleId = Number(queryValue(request.query?.proposalBundleId) || "0");
    const requestKey = queryValue(request.query?.requestKey);
    const sourceSystem = queryValue(request.query?.sourceSystem) || "DATAGATE";
    const detail = proposalBundleId > 0 ? await service.detailById(proposalBundleId) : requestKey ? await service.detailByRequest(sourceSystem, requestKey) : undefined;
    if (!detail) { completeApiRequest(context, 404, { reviewer: identity.reviewer }); response.status(404).json({ error: "Proposal bundle not found." }); return; }
    completeApiRequest(context, 200, { reviewer: identity.reviewer, proposalBundleId: detail.proposalBundleId });
    response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-bundle-detail/v1", detail });
  } catch (error) { handleApiError(response, error, context); }
}
