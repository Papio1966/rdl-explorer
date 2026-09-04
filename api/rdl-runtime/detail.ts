import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import {
  getRuntimeReadService,
  handleRuntimeReadError,
  queryValue,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "rdl-runtime.detail");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const result = await getRuntimeReadService().detail({
      sourceKey: queryValue(request.query?.sourceKey),
      releaseKey: queryValue(request.query?.releaseKey),
      entityType: queryValue(request.query?.entityType),
      nativeIdentifier: queryValue(request.query?.nativeIdentifier),
    });
    completeApiRequest(context, 200, {
      sourceKey: result.sourceKey,
      releaseKey: result.releaseKey,
      entityType: queryValue(request.query?.entityType),
      found: Boolean(result.detail),
    });
    response.status(200).json({ schemaVersion: "rdl-runtime-detail/v1", ...result });
  } catch (error) {
    handleRuntimeReadError(response, error, context);
  }
}
