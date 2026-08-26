import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { parseBody } from "../governance/_shared.ts";
import { authenticatedPublicationContext,handleApiError,type ApiRequest,type ApiResponse } from "./_shared.ts";
type Body={contextKey?:string;releaseKey?:string;releaseVersion?:string};
export default async function handler(request:ApiRequest,response:ApiResponse){
  const context=beginApiRequest(request,response,"publications.publish");
  if(request.method!=="POST"){completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."});return;}
  try{const {identity,service}=authenticatedPublicationContext(request,context);const body=parseBody<Body>(request.body);const release=await service.publish(identity,{contextKey:String(body.contextKey??""),releaseKey:String(body.releaseKey??""),releaseVersion:String(body.releaseVersion??"")});completeApiRequest(context,201,{reviewer:identity.reviewer,releaseId:release.releaseId});response.status(201).json({reviewer:identity.reviewer,release});}
  catch(error){handleApiError(response,error,context);}
}
