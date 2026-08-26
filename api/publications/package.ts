import { beginApiRequest, completeApiRequest } from "../_runtime.ts";
import { queryValue } from "../governance/_shared.ts";
import { authenticatedPublicationContext,handleApiError,type ApiRequest,type ApiResponse } from "./_shared.ts";
export default async function handler(request:ApiRequest,response:ApiResponse){
  const context=beginApiRequest(request,response,"publications.package");
  if(request.method!=="GET"){completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."});return;}
  try{const {identity,service}=authenticatedPublicationContext(request,context);const releaseId=Number(queryValue(request.query?.id));const release=await service.get(releaseId);if(!release)throw new Error("A valid releaseId is required.");response.setHeader?.("Content-Disposition",`attachment; filename=rdl-effective-${release.releaseKey}-${release.releaseVersion}.json`);completeApiRequest(context,200,{reviewer:identity.reviewer,releaseId});response.status(200).json({schemaVersion:"rdl-effective-standard-package/v1",compositionSha256:release.compositionSha256,manifest:release.packageManifest,payload:release.packagePayload});}
  catch(error){handleApiError(response,error,context);}
}
