import { authenticatedContext, handleApiError, queryValue, type ApiRequest, type ApiResponse } from "./_shared.ts";

const STATUSES = new Set(["candidate", "approved", "rejected", "retired"]);

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "GET") { response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity, service } = authenticatedContext(request);
    const requestedStatus = queryValue(request.query?.status) || "candidate";
    if (!STATUSES.has(requestedStatus)) throw new Error("Unsupported governance status.");
    const requestedLimit = Number(queryValue(request.query?.limit) || "200");
    const items = await service.listQueue(requestedStatus, requestedLimit);
    response.setHeader?.("Cache-Control", "no-store");
    response.status(200).json({ reviewer: identity.reviewer, status: requestedStatus, items });
  } catch (error) { handleApiError(response, error); }
}
