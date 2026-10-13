import {createHash} from "node:crypto";
import {beginApiRequest,completeApiRequest} from "../_runtime.ts";
import {queryValue} from "../governance/_shared.ts";
import {
  authenticatedDistributionContext,
  handleApiError,
  type ApiRequest,
  type ApiResponse
} from "./_shared.ts";

export default async function handler(
  request:ApiRequest,
  response:ApiResponse
){
  const context=
    beginApiRequest(
      request,
      response,
      "distribution.entities"
    );

  if(request.method!=="GET"){
    completeApiRequest(context,405);

    response.status(405).json({
      error:"Method not allowed."
    });

    return;
  }

  try{
    const {service}=
      authenticatedDistributionContext(
        request,
        context
      );

    const releaseId=
      Number(
        queryValue(request.query?.id)
      );

    const entityType=
      queryValue(request.query?.type);

    const q=
      queryValue(request.query?.q);

    const detail=
      ["1","true","yes"].includes(
        queryValue(
          request.query?.detail
        ).trim().toLowerCase()
      );

    if(!detail){
      const items=
        await service.entities(
          releaseId,
          entityType,
          q
        );

      completeApiRequest(
        context,
        200,
        {
          releaseId,
          itemCount:items.length
        }
      );

      response.status(200).json({
        schemaVersion:
          "rdl-distribution-entities/v1",
        releaseId,
        items
      });

      return;
    }

    const items=
      await service.entityDetails(
        releaseId,
        entityType,
        q
      );

    const body={
      schemaVersion:
        "rdl-distribution-entity-details/v1",
      releaseId,
      items
    };

    const detailsSha256=
      createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");

    response.setHeader?.(
      "ETag",
      `"sha256-${detailsSha256}"`
    );

    completeApiRequest(
      context,
      200,
      {
        releaseId,
        itemCount:items.length,
        detailsSha256
      }
    );

    response.status(200).json({
      ...body,
      detailsSha256
    });

  }catch(error){
    handleApiError(
      response,
      error,
      context
    );
  }
}
