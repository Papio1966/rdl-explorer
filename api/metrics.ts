import { getRuntimeMetrics } from "../server/observability/RuntimeMetrics.ts";
import { getBuildMetadata } from "../server/runtime/BuildMetadata.ts";
import { beginApiRequest, completeApiRequest, type RuntimeRequest, type RuntimeResponse } from "./_runtime.ts";

export default async function handler(request: RuntimeRequest, response: RuntimeResponse) {
  const context = beginApiRequest(request, response, "metrics");
  if (request.method && request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  const snapshot = getRuntimeMetrics().snapshot();
  completeApiRequest(context, 200);
  response.status(200).json({
    ok: true,
    build: getBuildMetadata(),
    metrics: snapshot,
    scope: "process-local",
    note: "Use the hosting platform or telemetry backend for distributed production metrics aggregation.",
  });
}
