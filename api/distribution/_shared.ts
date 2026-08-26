import { PACKAGE_CONSUMER_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { PublishedPackageDistributionRepository } from "../../server/rdl/PublishedPackageDistributionRepository.ts";
import { PublishedPackageDistributionService } from "../../server/rdl/PublishedPackageDistributionService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";
let limiter:FixedWindowRateLimiter|undefined;
export function authenticatedDistributionContext(request:ApiRequest,context?:RequestContext){
  assertRuntimeEnvironment();
  const identity=authenticateGovernanceIdentity(request.headers,process.env,Date.now(),PACKAGE_CONSUMER_ROLE);
  limiter ??= new FixedWindowRateLimiter(300,60_000);
  const rate=limiter.consume(identity.reviewer);
  if(!rate.allowed)throw new GovernanceRateLimitError(Math.max(1,Math.ceil((rate.resetAt-Date.now())/1000)),300);
  if(context)logRequest("info","distribution.authenticated",context,{consumer:identity.reviewer,rateLimitRemaining:rate.remaining});
  return {identity,service:new PublishedPackageDistributionService(new PublishedPackageDistributionRepository(getRdlDatabaseClient())),rate};
}
export {handleApiError}; export type {ApiRequest,ApiResponse};
