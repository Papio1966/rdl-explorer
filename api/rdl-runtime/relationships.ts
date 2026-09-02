import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import {
  getRuntimeReadService,
  handleRuntimeReadError,
  queryInteger,
  queryValue,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "rdl-runtime.relationships");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const result = await getRuntimeReadService().relationships({
      sourceKey: queryValue(request.query?.sourceKey),
      releaseKey: queryValue(request.query?.releaseKey),
      relationshipType: queryValue(request.query?.relationshipType),
      sourceEntityType: queryValue(request.query?.sourceEntityType),
      sourceNativeIdentifier: queryValue(request.query?.sourceNativeIdentifier),
      targetEntityType: queryValue(request.query?.targetEntityType),
      targetNativeIdentifier: queryValue(request.query?.targetNativeIdentifier),
      offset: queryInteger(request.query?.offset),
      limit: queryInteger(request.query?.limit),
    });
    completeApiRequest(context, 200, {
      sourceKey: result.sourceKey,
      releaseKey: result.releaseKey,
      total: result.total,
      itemCount: result.items.length,
    });
    response.status(200).json({ schemaVersion: "rdl-runtime-relationships/v1", ...result });
  } catch (error) {
    handleRuntimeReadError(response, error, context);
  }
}
