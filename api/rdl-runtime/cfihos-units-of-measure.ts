import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { CfihosRuntimeCompatibilityService } from "../../server/rdl/CfihosRuntimeCompatibilityService.ts";
import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import {
  handleRuntimeReadError,
  queryValue,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";

let service: CfihosRuntimeCompatibilityService | undefined;

function getService() {
  service ??= new CfihosRuntimeCompatibilityService(getRdlDatabaseClient());
  return service;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "rdl-runtime.cfihos-units-of-measure");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const result = await getService().unitsOfMeasure({
      sourceKey: queryValue(request.query?.sourceKey),
      releaseKey: queryValue(request.query?.releaseKey),
    });
    completeApiRequest(context, 200, {
      sourceKey: result.sourceKey,
      releaseKey: result.releaseKey,
      total: result.items.length,
    });
    response.status(200).json({
      schemaVersion: "rdl-cfihos-units-of-measure/v1",
      ...result,
    });
  } catch (error) {
    handleRuntimeReadError(response, error, context);
  }
}
