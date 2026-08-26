import { PACKAGE_CONSUMER_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { ConsumerIntegrationRepository } from "../../server/rdl/ConsumerIntegrationRepository.ts";
import { ConsumerIntegrationService } from "../../server/rdl/ConsumerIntegrationService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";
let limiter:FixedWindowRateLimiter|undefined;
export function authenticatedIntegrationContext(request:ApiRequest,context?:RequestContext){assertRuntimeEnvironment();const identity=authenticateGovernanceIdentity(request.headers,process.env,Date.now(),PACKAGE_CONSUMER_ROLE);limiter??=new FixedWindowRateLimiter(300,60_000);const rate=limiter.consume(identity.reviewer);if(!rate.allowed)throw new GovernanceRateLimitError(Math.max(1,Math.ceil((rate.resetAt-Date.now())/1000)),300);if(context)logRequest("info","integration.authenticated",context,{consumer:identity.reviewer,rateLimitRemaining:rate.remaining});return {identity,service:new ConsumerIntegrationService(new ConsumerIntegrationRepository(getRdlDatabaseClient())),rate};}
export {handleApiError};export type {ApiRequest,ApiResponse};
