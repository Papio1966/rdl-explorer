import { EXTENSION_REVIEWER_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { EffectiveStandardPublicationRepository } from "../../server/rdl/EffectiveStandardPublicationRepository.ts";
import { EffectiveStandardPublicationService } from "../../server/rdl/EffectiveStandardPublicationService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";

let limiter:FixedWindowRateLimiter|undefined;
export function authenticatedPublicationContext(request:ApiRequest,context?:RequestContext){
  assertRuntimeEnvironment();
  const identity=authenticateGovernanceIdentity(request.headers,process.env,Date.now(),EXTENSION_REVIEWER_ROLE);
  limiter ??= new FixedWindowRateLimiter(120,60_000);
  const rate=limiter.consume(identity.reviewer);
  if(!rate.allowed)throw new GovernanceRateLimitError(Math.max(1,Math.ceil((rate.resetAt-Date.now())/1000)),120);
  if(context)logRequest("info","publication.authenticated",context,{reviewer:identity.reviewer,rateLimitRemaining:rate.remaining});
  return {identity,service:new EffectiveStandardPublicationService(new EffectiveStandardPublicationRepository(getRdlDatabaseClient())),rate};
}
export {handleApiError};
export type {ApiRequest,ApiResponse};
