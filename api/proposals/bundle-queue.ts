import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedProposalReviewContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { ExternalStandardsProposalBundleReadbackService } from "../../server/rdl/ExternalStandardsProposalBundleReadbackService.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.bundle.queue");
  if (request.method !== "GET") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity } = authenticatedProposalReviewContext(request, context);
    const service = new ExternalStandardsProposalBundleReadbackService(getRdlDatabaseClient());
    const bundles = await service.list({
      sourceSystem: queryValue(request.query?.sourceSystem),
      proposalStatus: queryValue(request.query?.proposalStatus),
      completenessStatus: completenessStatus(queryValue(request.query?.completenessStatus)),
      targetContextKey: queryValue(request.query?.targetContextKey),
      limit: Number(queryValue(request.query?.limit) || "100"),
    });
    completeApiRequest(context, 200, { reviewer: identity.reviewer, bundleCount: bundles.length });
    response.status(200).json({ schemaVersion: "rdl-external-standards-proposal-bundle-queue/v1", governanceAuthority: "RDL_EXPLORER_ONLY", bundles });
  } catch (error) { handleApiError(response, error, context); }
}

function completenessStatus(value: string | undefined): "complete" | "incomplete_candidate" | undefined {
  if (!value) return undefined;
  if (value !== "complete" && value !== "incomplete_candidate") throw new Error("completenessStatus is not supported.");
  return value;
}
