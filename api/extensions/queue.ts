import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedExtensionContext, handleApiError, type ApiRequest, type ApiResponse } from "./_shared.ts";
const STATUSES=new Set(["draft","candidate","in_review","approved","rejected","retired","all"]);
export default async function handler(request:ApiRequest,response:ApiResponse){
  const context=beginApiRequest(request,response,"extensions.queue");
  if(request.method!=="GET"){completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."});return;}
  try{const {identity,service,rate}=authenticatedExtensionContext(request,context);const status=queryValue(request.query?.status)||"in_review";if(!STATUSES.has(status))throw new Error("Unsupported extension status.");const contextKey=queryValue(request.query?.context);const limit=Number(queryValue(request.query?.limit)||"200");const items=await service.list(status,contextKey,limit);response.setHeader?.("X-RateLimit-Remaining",rate.remaining);completeApiRequest(context,200,{reviewer:identity.reviewer,itemCount:items.length});response.status(200).json({reviewer:identity.reviewer,status,items});}
  catch(error){handleApiError(response,error,context);}
}
