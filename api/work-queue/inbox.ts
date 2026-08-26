import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedWorkQueueContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "work_queue.inbox");
  if (request.method !== "GET") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity, service } = authenticatedWorkQueueContext(request, context);
    const limit = Number(queryValue(request.query?.limit) || "100");
    const items = await service.inbox(identity.reviewer, limit);
    completeApiRequest(context, 200, { reviewer: identity.reviewer, itemCount: items.length });
    response.status(200).json({ schemaVersion: "rdl-enterprise-work-queue/v1", generatedAt: new Date().toISOString(), reviewer: identity.reviewer, items });
  } catch (error) { handleApiError(response, error, context); }
}
