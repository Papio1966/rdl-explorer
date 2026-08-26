import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedContext, handleApiError, queryValue, type ApiRequest, type ApiResponse } from "./_shared.ts";

const STATUSES = new Set(["candidate", "approved", "rejected", "retired"]);

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "governance.queue");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, service, rate } = authenticatedContext(request, context);
    response.setHeader?.("X-RateLimit-Limit", rate.limit);
    response.setHeader?.("X-RateLimit-Remaining", rate.remaining);
    const requestedStatus = queryValue(request.query?.status) || "candidate";
    if (!STATUSES.has(requestedStatus)) throw new Error("Unsupported governance status.");
    const requestedLimit = Number(queryValue(request.query?.limit) || "200");
    const items = await service.listQueue(requestedStatus, requestedLimit);
    completeApiRequest(context, 200, { reviewer: identity.reviewer, status: requestedStatus, itemCount: items.length });
    response.status(200).json({ reviewer: identity.reviewer, status: requestedStatus, items });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
