import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import { authenticatedWorkQueueContext, handleApiError, WORK_QUEUE_COORDINATOR_ROLE, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "work_queue.transition");
  if (request.method !== "POST") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const body = parseBody<Record<string, unknown>>(request.body);
    const action = String(body.action ?? "");
    const requiredRole = action === "dismiss" || action === "reopen" ? WORK_QUEUE_COORDINATOR_ROLE : undefined;
    const { identity, service } = authenticatedWorkQueueContext(request, context, requiredRole);
    const item = await service.transition(Number(body.workItemId), action as any, identity.reviewer, String(body.rationale ?? ""), Number(body.expectedVersion));
    completeApiRequest(context, 200, { workItemId: body.workItemId, action: body.action }); response.status(200).json({ item });
  } catch (error) { handleApiError(response, error, context); }
}
