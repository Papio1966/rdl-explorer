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
    "company_adoption.create_composition"
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
      compositionKind?:
        |"multi_source_merge"
        |"derived_copy"
        |"promotion";
      targetEntityType?:string;
      targetNativeIdentifier?:string;
      targetName?:string;
      targetDefinition?:string;
      rationale?:string;
      contributors?:Array<{
        sourceEntityId:number;
        contributionRole:
          |"primary"
          |"contributor"
          |"reference";
      }>;
      componentDecisions?:Array<{
        componentKind:string;
        componentKey:string;
        resolution:string;
        selectedSourceEntityId?:number;
        resolvedPayload?:Record<string,unknown>;
        rationale:string;
      }>;
    };

    const item=await service.createComposition(
      identity,
      {
        contextKey:String(body.contextKey??""),
        compositionKind:
          body.compositionKind??"derived_copy",
        targetEntityType:
          String(body.targetEntityType??""),
        targetNativeIdentifier:
          String(body.targetNativeIdentifier??""),
        targetName:
          String(body.targetName??""),
        targetDefinition:
          body.targetDefinition==null
            ?undefined
            :String(body.targetDefinition),
        rationale:
          String(body.rationale??""),
        contributors:
          Array.isArray(body.contributors)
            ?body.contributors
            :[],
        componentDecisions:
          Array.isArray(body.componentDecisions)
            ?body.componentDecisions
            :[],
      }
    );

    completeApiRequest(
      context,
      201,
      {
        extensionChangeId:item.extensionChangeId,
        compositionId:item.compositionId,
      }
    );

    response.status(201).json({item});

  } catch(error) {
    handleApiError(response,error,context);
  }
}
