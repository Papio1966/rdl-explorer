import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import { authenticatedWorkQueueContext, handleApiError, WORK_QUEUE_COORDINATOR_ROLE, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "work_queue.remind");
  if (request.method !== "POST") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity, service } = authenticatedWorkQueueContext(request, context, WORK_QUEUE_COORDINATOR_ROLE);
    const body = parseBody<Record<string, unknown>>(request.body);
    const item = await service.remind(Number(body.workItemId), identity.reviewer, String(body.rationale ?? ""), Boolean(body.escalate), Number(body.expectedVersion));
    completeApiRequest(context, 200, { workItemId: body.workItemId, escalated: Boolean(body.escalate) }); response.status(200).json({ item });
  } catch (error) { handleApiError(response, error, context); }
}
