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
    "company_adoption.collision_decision"
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
      mappingId?:number;
      decisionType?:
        |"merge"
        |"keep_separate"
        |"rename"
        |"exclude"
        |"defer";
      targetName?:string;
      rationale?:string;
      expectedVersion?:number;
    };

    const item=
      await service.recordCollisionDecision(
        identity,
        {
          contextKey:String(body.contextKey??""),
          mappingId:Number(body.mappingId),
          decisionType:
            body.decisionType??"defer",
          targetName:
            body.targetName==null
              ?undefined
              :String(body.targetName),
          rationale:String(body.rationale??""),
          expectedVersion:Number(
            body.expectedVersion??0
          ),
        }
      );

    completeApiRequest(
      context,
      200,
      {
        collisionDecisionId:
          item.collisionDecisionId,
        decisionType:item.decisionType,
      }
    );

    response.status(200).json({item});

  } catch(error) {
    handleApiError(response,error,context);
  }
}
