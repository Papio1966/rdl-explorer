import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { RdlSchemaDictionaryRepository } from "../../server/rdl/RdlSchemaDictionaryRepository.ts";
import {
  RdlSchemaDictionaryInputError,
  RdlSchemaDictionaryReleaseNotFoundError,
  RdlSchemaDictionaryService,
} from "../../server/rdl/RdlSchemaDictionaryService.ts";
import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import {
  handleRuntimeReadError,
  queryValue,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";

let service: RdlSchemaDictionaryService | undefined;
function getService() {
  service ??= new RdlSchemaDictionaryService(new RdlSchemaDictionaryRepository(getRdlDatabaseClient()));
  return service;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "rdl-runtime.schema-dictionary");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  try {
    const result = await getService().list({
      sourceKey: queryValue(request.query?.sourceKey),
      releaseKey: queryValue(request.query?.releaseKey),
      conceptKind: queryValue(request.query?.conceptKind),
      q: queryValue(request.query?.q),
      offset: Number(queryValue(request.query?.offset) || 0),
      limit: Number(queryValue(request.query?.limit) || 100),
    });
    completeApiRequest(context, 200, { sourceKey: result.sourceKey, releaseKey: result.releaseKey, total: result.total });
    response.status(200).json({ schemaVersion: "rdl-schema-dictionary/v1", ...result });
  } catch (error) {
    if (error instanceof RdlSchemaDictionaryInputError) {
      completeApiRequest(context, 400);
      response.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RdlSchemaDictionaryReleaseNotFoundError) {
      completeApiRequest(context, 404);
      response.status(404).json({ error: error.message });
      return;
    }
    handleRuntimeReadError(response, error, context);
  }
}
