import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedProposalContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { ExternalStandardsProposalBundleRepository } from "../../server/rdl/ExternalStandardsProposalBundleRepository.ts";
import { ExternalStandardsProposalBundleService } from "../../server/rdl/ExternalStandardsProposalBundleService.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.bundle.status");
  if (request.method !== "GET") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity } = authenticatedProposalContext(request, context);
    const service = new ExternalStandardsProposalBundleService(new ExternalStandardsProposalBundleRepository(getRdlDatabaseClient()));
    const requestKey = queryValue(request.query?.requestKey);
    if (requestKey) {
      const bundle = await service.status(identity, requestKey);
      if (!bundle) { completeApiRequest(context, 404, { consumer: identity.reviewer }); response.status(404).json({ error: "Proposal bundle not found." }); return; }
      completeApiRequest(context, 200, { consumer: identity.reviewer, proposalBundleId: bundle.proposalBundleId });
      response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-bundle-status/v1", bundle });
      return;
    }
    const limit = Number(queryValue(request.query?.limit) || "100");
    const bundles = await service.list(identity, limit);
    completeApiRequest(context, 200, { consumer: identity.reviewer, bundleCount: bundles.length });
    response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-bundle-list/v1", bundles });
  } catch (error) { handleApiError(response, error, context); }
}
