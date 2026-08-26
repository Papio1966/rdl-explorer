import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedPublicationContext,handleApiError,type ApiRequest,type ApiResponse } from "./_shared.ts";
export default async function handler(request:ApiRequest,response:ApiResponse){
  const context=beginApiRequest(request,response,"publications.compare");
  if(request.method!=="GET"){completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."});return;}
  try{const {identity,service}=authenticatedPublicationContext(request,context);const contextKey=queryValue(request.query?.context);const comparison=await service.compare(contextKey);completeApiRequest(context,200,{reviewer:identity.reviewer,contextKey,changeCount:comparison.summary.totalChanges});response.status(200).json({reviewer:identity.reviewer,comparison});}
  catch(error){handleApiError(response,error,context);}
}
