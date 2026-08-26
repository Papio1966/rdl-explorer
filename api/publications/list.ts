import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedPublicationContext,handleApiError,type ApiRequest,type ApiResponse } from "./_shared.ts";
export default async function handler(request:ApiRequest,response:ApiResponse){
  const context=beginApiRequest(request,response,"publications.list");
  if(request.method!=="GET"){completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."});return;}
  try{const {identity,service}=authenticatedPublicationContext(request,context);const contextKey=queryValue(request.query?.context);const limit=Number(queryValue(request.query?.limit)||"50");const releases=await service.list(contextKey,limit);completeApiRequest(context,200,{reviewer:identity.reviewer,releaseCount:releases.length});response.status(200).json({reviewer:identity.reviewer,releases});}
  catch(error){handleApiError(response,error,context);}
}
