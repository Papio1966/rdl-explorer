import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import type { CreateExtensionCommand } from "../../server/rdl/EnterpriseExtensionService.ts";
import { authenticatedExtensionContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";
export default async function handler(request:ApiRequest,response:ApiResponse){
  const context=beginApiRequest(request,response,"extensions.create");
  if(request.method!=="POST"){completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."});return;}
  try{const {identity,service}=authenticatedExtensionContext(request,context);const body=parseBody<Partial<CreateExtensionCommand>>(request.body);const item=await service.create(identity,{contextKey:String(body.contextKey??""),changeKind:body.changeKind as any,entityType:String(body.entityType??""),nativeIdentifier:String(body.nativeIdentifier??""),baseEntityId:body.baseEntityId==null?undefined:Number(body.baseEntityId),proposedName:body.proposedName==null?undefined:String(body.proposedName),proposedDefinition:body.proposedDefinition==null?undefined:String(body.proposedDefinition),rationale:String(body.rationale??""),provenance:body.provenance});completeApiRequest(context,201,{reviewer:identity.reviewer,extensionChangeId:item.extensionChangeId});response.status(201).json({reviewer:identity.reviewer,item});}
  catch(error){handleApiError(response,error,context);}
}
