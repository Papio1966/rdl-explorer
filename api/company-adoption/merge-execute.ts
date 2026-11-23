import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { CompanyMergeWorkbenchRepository } from "../../server/rdl/CompanyMergeWorkbenchRepository.ts";
import { CompanyMergeWorkbenchService } from "../../server/rdl/CompanyMergeWorkbenchService.ts";
import { beginApiRequest,completeApiRequest } from "../_runtime.ts";
import {
  authenticatedExtensionContext,
  handleApiError,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";

type Body={
  contextKey:string;
  mappingId:number;
  targetNativeIdentifier:string;
  targetName:string;
  targetDefinition?:string;
  rationale:string;
  componentDecisions:Array<Record<string,unknown>>;
};

export default async function handler(
  request:ApiRequest,
  response:ApiResponse
){
  const context=
    beginApiRequest(
      request,
      response,
      "company-adoption.merge-execute"
    );

  if(request.method!=="POST"){
    completeApiRequest(context,405);
    response.status(405).json({error:"Method not allowed."});
    return;
  }

  try{
    const authenticated=
      authenticatedExtensionContext(request,context);

    response.setHeader?.(
      "X-RateLimit-Remaining",
      authenticated.rate.remaining
    );

    const service=
      new CompanyMergeWorkbenchService(
        new CompanyMergeWorkbenchRepository(
          getRdlDatabaseClient()
        )
      );

    const body=
      (
        request.body
        &&typeof request.body==="object"
          ?request.body
          :{}
      ) as Body;

    const result=
      await service.execute(
        authenticated.identity,
        body
      );

    completeApiRequest(context,201,{
      mappingId:Number(body.mappingId),
      compositionId:result.compositionId,
    });

    response.status(201).json({
      schemaVersion:"rdl-company-merge-execution/v1",
      result,
    });
  }catch(error){
    handleApiError(response,error,context);
  }
}
