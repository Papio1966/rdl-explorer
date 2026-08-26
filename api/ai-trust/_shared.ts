import { AI_STANDARDS_ANALYST_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { AiTrustControlsRepository } from "../../server/rdl/AiTrustControlsRepository.ts";
import { AiTrustControlsService } from "../../server/rdl/AiTrustControlsService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";
let limiter:FixedWindowRateLimiter|undefined;
export function authenticatedTrustContext(request:ApiRequest,context?:RequestContext){assertRuntimeEnvironment();const identity=authenticateGovernanceIdentity(request.headers,process.env,Date.now(),AI_STANDARDS_ANALYST_ROLE);limiter??=new FixedWindowRateLimiter(60,60_000);const rate=limiter.consume(identity.reviewer);if(!rate.allowed)throw new GovernanceRateLimitError(Math.max(1,Math.ceil((rate.resetAt-Date.now())/1000)),60);if(context)logRequest("info","ai_trust.authenticated",context,{reviewer:identity.reviewer,rateLimitRemaining:rate.remaining});return{identity,rate,service:new AiTrustControlsService(new AiTrustControlsRepository(getRdlDatabaseClient()))};}
export {handleApiError}; export type {ApiRequest,ApiResponse};
