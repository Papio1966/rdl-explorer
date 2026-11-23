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

export default async function handler(
  request:ApiRequest,
  response:ApiResponse
){
  const context=
    beginApiRequest(
      request,
      response,
      "company-adoption.merge-preview"
    );

  if(request.method!=="GET"){
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

    const query=
      (request as ApiRequest&{
        query?:Record<string,string|string[]|undefined>
      }).query??{};

    const value=(input:string|string[]|undefined)=>
      Array.isArray(input)
        ?String(input[0]??"").trim()
        :String(input??"").trim();

    const service=
      new CompanyMergeWorkbenchService(
        new CompanyMergeWorkbenchRepository(
          getRdlDatabaseClient()
        )
      );

    const preview=
      await service.preview(
        value(query.context),
        Number(value(query.mappingId))
      );

    completeApiRequest(context,200,{
      mappingId:preview.mappingId,
      contextKey:preview.contextKey,
    });

    response.status(200).json(preview);
  }catch(error){
    handleApiError(response,error,context);
  }
}
