import { authenticatedContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "GET") { response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity } = authenticatedContext(request);
    response.setHeader?.("Cache-Control", "no-store");
    response.status(200).json({ authenticated: true, reviewer: identity.reviewer, roles: identity.roles, authenticatedAt: identity.authenticatedAt });
  } catch (error) { handleApiError(response, error); }
}
