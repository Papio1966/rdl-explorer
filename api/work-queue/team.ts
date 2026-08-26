import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedWorkQueueContext, handleApiError, WORK_QUEUE_COORDINATOR_ROLE, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "work_queue.team");
  if (request.method !== "GET") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { service } = authenticatedWorkQueueContext(request, context, WORK_QUEUE_COORDINATOR_ROLE);
    const limit = Number(queryValue(request.query?.limit) || "100");
    const items = await service.team(limit);
    completeApiRequest(context, 200, { itemCount: items.length });
    response.status(200).json({ schemaVersion: "rdl-enterprise-work-queue/v1", generatedAt: new Date().toISOString(), items });
  } catch (error) { handleApiError(response, error, context); }
}
