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
    "company_adoption.packages"
  );

  if(request.method!=="GET") {
    completeApiRequest(context,405);
    response.status(405).json({error:"Method not allowed."});
    return;
  }

  try {
    const authenticated=authenticatedExtensionContext(request,context);
    const identity=authenticated.identity;
    const service=authenticated.service;

    void identity;

    const packages=await service.listPublishedIndustryPackages();

    completeApiRequest(
      context,
      200,
      {count:packages.length}
    );

    response.status(200).json({packages});

  } catch(error) {
    handleApiError(response,error,context);
  }
}
