import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { CfihosSourceWorkbookService } from "../../server/rdl/CfihosSourceWorkbookService.ts";
import { RdlRuntimeReadInputError } from "../../server/rdl/RdlRuntimeReadService.ts";
import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import {
  handleRuntimeReadError,
  queryValue,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";

let service: CfihosSourceWorkbookService | undefined;

function getService() {
  service ??= new CfihosSourceWorkbookService(getRdlDatabaseClient());
  return service;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const context = beginApiRequest(request, response, "rdl-runtime.cfihos-workbook");
  if (request.method !== "GET") {
    completeApiRequest(context, 405);
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const sourceKey = queryValue(request.query?.sourceKey);
    const releaseKey = queryValue(request.query?.releaseKey);
    const packageKey = queryValue(request.query?.packageKey);
    const sheetName = queryValue(request.query?.sheetName);

    if (Boolean(packageKey) !== Boolean(sheetName)) {
      throw new RdlRuntimeReadInputError(
        "packageKey and sheetName must be supplied together for a worksheet read.",
      );
    }

    if (packageKey && sheetName) {
      const result = await getService().sheet({
        sourceKey,
        releaseKey,
        packageKey,
        sheetName,
      });
      completeApiRequest(context, 200, {
        sourceKey: result.sourceKey,
        releaseKey: result.releaseKey,
        packageKey: result.packageKey,
        sheetName: result.sheetName,
        rowCount: result.rowCount,
      });
      response.status(200).json({
        schemaVersion: "rdl-cfihos-workbook-sheet/v1",
        ...result,
      });
      return;
    }

    const result = await getService().manifest({ sourceKey, releaseKey });
    completeApiRequest(context, 200, {
      sourceKey: result.sourceKey,
      releaseKey: result.releaseKey,
      packageKey: result.packageKey,
      sheetCount: result.sheets.length,
    });
    response.status(200).json({
      schemaVersion: "rdl-cfihos-workbook-manifest/v1",
      ...result,
    });
  } catch (error) {
    handleRuntimeReadError(response, error, context);
  }
}
