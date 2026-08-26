import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import { authenticatedWorkQueueContext, handleApiError, WORK_QUEUE_COORDINATOR_ROLE, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "work_queue.create");
  if (request.method !== "POST") { completeApiRequest(context, 405); response.status(405).json({ error: "Method not allowed." }); return; }
  try {
    const { identity, service } = authenticatedWorkQueueContext(request, context, WORK_QUEUE_COORDINATOR_ROLE);
    const body = parseBody<Record<string, unknown>>(request.body);
    const item = await service.create({
      workKey: String(body.workKey ?? ""), sourceType: String(body.sourceType ?? ""), sourceRecordKey: String(body.sourceRecordKey ?? ""),
      scopeKey: body.scopeKey ? String(body.scopeKey) : undefined, title: String(body.title ?? ""), summary: body.summary ? String(body.summary) : undefined,
      drillThroughPath: String(body.drillThroughPath ?? ""), assigneeKey: body.assigneeKey ? String(body.assigneeKey) : undefined,
      priority: body.priority ? String(body.priority) : "normal", dueAt: body.dueAt ? String(body.dueAt) : undefined, createdBy: identity.reviewer,
    });
    completeApiRequest(context, 201, { workItemId: item.work_item_id }); response.status(201).json({ item });
  } catch (error) { handleApiError(response, error, context); }
}
