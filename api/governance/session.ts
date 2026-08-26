import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { authenticatedContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "governance.session");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const { identity, rate } = authenticatedContext(request, context);
    response.setHeader?.("X-RateLimit-Limit", rate.limit);
    response.setHeader?.("X-RateLimit-Remaining", rate.remaining);
    completeApiRequest(context, 200, { reviewer: identity.reviewer });
    response.status(200).json({ authenticated: true, reviewer: identity.reviewer, roles: identity.roles, authenticatedAt: identity.authenticatedAt });
  } catch (error) {
    handleApiError(response, error, context);
  }
}
