import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import { authenticatedExtensionContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";

export default async function handler(
  request:ApiRequest,
  response:ApiResponse
) {
  const context=beginApiRequest(
    request,
    response,
    "company_adoption.pin_package"
  );

  if(request.method!=="POST") {
    completeApiRequest(context,405);
    response.status(405).json({error:"Method not allowed."});
    return;
  }

  try {
    const authenticated=authenticatedExtensionContext(request,context);
    const identity=authenticated.identity;
    const service=authenticated.service;

    const body=(
      request.body&&typeof request.body==="object"
        ?request.body
        :{}
    ) as {
      contextKey?:string;
      packageId?:number;
      precedence?:number;
      reason?:string;
    };

    const item=await service.pinIndustryPackage(
      identity,
      {
        contextKey:String(body.contextKey??""),
        packageId:Number(body.packageId),
        precedence:Number(body.precedence),
        reason:String(body.reason??""),
      }
    );

    completeApiRequest(
      context,
      201,
      {
        contextKey:String(body.contextKey??""),
        packageId:item.packageId,
      }
    );

    response.status(201).json({item});

  } catch(error) {
    handleApiError(response,error,context);
  }
}
