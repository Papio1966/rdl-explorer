import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedWorkQueueContext, handleApiError, WORK_QUEUE_COORDINATOR_ROLE, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "work_queue.session");
  if (request.method !== "GET") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity, rate } = authenticatedWorkQueueContext(request, context);
    response.setHeader?.("X-RateLimit-Remaining", rate.remaining);
    completeApiRequest(context, 200, { reviewer: identity.reviewer });
    response.status(200).json({
      authenticated: true,
      reviewer: identity.reviewer,
      roles: identity.roles,
      authenticatedAt: identity.authenticatedAt,
      contract: "rdl-enterprise-work-queue/v1",
      canCoordinate: identity.roles.includes(WORK_QUEUE_COORDINATOR_ROLE),
    });
  } catch (error) { handleApiError(response, error, context); }
}
