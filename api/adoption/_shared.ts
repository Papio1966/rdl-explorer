import { MIGRATION_APPROVER_ROLE, PACKAGE_CONSUMER_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { MigrationPlanningRepository } from "../../server/rdl/MigrationPlanningRepository.ts";
import { MigrationPlanningService } from "../../server/rdl/MigrationPlanningService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";
let limiter:FixedWindowRateLimiter|undefined;
export function authenticatedMigrationContext(request:ApiRequest,context?:RequestContext,requiredRole=PACKAGE_CONSUMER_ROLE){assertRuntimeEnvironment();const identity=authenticateGovernanceIdentity(request.headers,process.env,Date.now(),requiredRole);limiter??=new FixedWindowRateLimiter(300,60_000);const rate=limiter.consume(identity.reviewer);if(!rate.allowed)throw new GovernanceRateLimitError(Math.max(1,Math.ceil((rate.resetAt-Date.now())/1000)),300);if(context)logRequest("info","adoption.authenticated",context,{consumer:identity.reviewer,requiredRole,rateLimitRemaining:rate.remaining});return {identity,service:new MigrationPlanningService(new MigrationPlanningRepository(getRdlDatabaseClient())),rate};}
export {handleApiError,MIGRATION_APPROVER_ROLE,PACKAGE_CONSUMER_ROLE};export type {ApiRequest,ApiResponse};
