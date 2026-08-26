import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedControlTowerContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "control_tower.dashboard");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, service } = authenticatedControlTowerContext(request, context);
    const limit = Number(queryValue(request.query?.limit) || "25");
    const dashboard = await service.dashboard(limit);
    completeApiRequest(context, 200, { reviewer: identity.reviewer, queueCount: dashboard.queue.length });
    response.status(200).json(dashboard);
  } catch (error) {
    handleApiError(response, error, context);
  }
}
