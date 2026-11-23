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
    "company_adoption.entities"
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

    const packageId=Number(
      request.query?.packageId
    );

    const query=String(
      request.query?.q??""
    );

    const limit=Number(
      request.query?.limit??100
    );

    const items=
      await service.listPublishedPackageEntities(
        packageId,
        query,
        limit
      );

    completeApiRequest(
      context,
      200,
      {count:items.length,packageId}
    );

    response.status(200).json({items});

  } catch(error) {
    handleApiError(response,error,context);
  }
}
