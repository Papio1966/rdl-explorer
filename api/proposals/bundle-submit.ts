import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import { authenticatedProposalContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { ExternalStandardsProposalBundleRepository } from "../../server/rdl/ExternalStandardsProposalBundleRepository.ts";
import { ExternalStandardsProposalBundleService } from "../../server/rdl/ExternalStandardsProposalBundleService.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "proposals.bundle.submit");
  if (request.method !== "POST") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity } = authenticatedProposalContext(request, context);
    const service = new ExternalStandardsProposalBundleService(new ExternalStandardsProposalBundleRepository(getRdlDatabaseClient()));
    const bundle = await service.submit(identity, parseBody<Record<string, unknown>>(request.body));
    completeApiRequest(context, 201, { consumer: identity.reviewer, proposalBundleId: bundle.proposalBundleId });
    response.status(201).json({ schemaVersion: "rdl-external-standards-proposal-bundle/v1", bundle });
  } catch (error) { handleApiError(response, error, context); }
}
