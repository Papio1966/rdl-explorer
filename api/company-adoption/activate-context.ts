import {
  beginApiRequest,
  completeApiRequest,
} from "../_runtime.ts";

import {
  getRdlDatabaseClient,
} from "../../server/db/runtime.ts";

import {
  CompanyContextActivationRepository,
} from "../../server/rdl/CompanyContextActivationRepository.ts";

import {
  CompanyContextActivationService,
} from "../../server/rdl/CompanyContextActivationService.ts";

import {
  authenticatedExtensionContext,
  handleApiError,
  type ApiRequest,
  type ApiResponse,
} from "./_shared.ts";


export default async function handler(
  request:ApiRequest,
  response:ApiResponse
) {
  const context=
    beginApiRequest(
      request,
      response,
      "company_adoption.activate_context"
    );

  if(request.method!=="POST") {
    completeApiRequest(
      context,
      405
    );

    response.status(405).json({
      error:"Method not allowed.",
    });

    return;
  }

  try {
    const authenticated=
      authenticatedExtensionContext(
        request,
        context
      );

    const body=(
      request.body
      &&typeof request.body==="object"
        ?request.body
        :{}
    ) as {
      contextKey?:string;
      effectiveStandardReleaseId?:number;
      rationale?:string;
    };

    const service=
      new CompanyContextActivationService(
        new CompanyContextActivationRepository(
          getRdlDatabaseClient()
        )
      );

    const item=
      await service.activate(
        authenticated.identity,
        {
          contextKey:
            String(body.contextKey??""),

          effectiveStandardReleaseId:
            Number(
              body.effectiveStandardReleaseId
            ),

          rationale:
            String(body.rationale??""),
        }
      );

    completeApiRequest(
      context,
      200,
      {
        contextKey:item.contextKey,
        releaseId:
          item.effectiveStandardReleaseId,
        status:item.status,
        reviewer:
          authenticated.identity.reviewer,
      }
    );

    response.status(200).json({
      item,
    });

  } catch(error) {
    handleApiError(
      response,
      error,
      context
    );
  }
}
