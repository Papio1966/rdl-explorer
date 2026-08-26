import { GOVERNANCE_REVIEWER_ROLE, WORK_QUEUE_COORDINATOR_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { EnterpriseWorkQueueRepository } from "../../server/rdl/EnterpriseWorkQueueRepository.ts";
import { EnterpriseWorkQueueService } from "../../server/rdl/EnterpriseWorkQueueService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";

let limiter: FixedWindowRateLimiter | undefined;

export function authenticatedWorkQueueContext(request: ApiRequest, context?: RequestContext, requiredRole = GOVERNANCE_REVIEWER_ROLE) {
  assertRuntimeEnvironment();
  const identity = authenticateGovernanceIdentity(request.headers, process.env, Date.now(), requiredRole);
  limiter ??= new FixedWindowRateLimiter(300, 60_000);
  const rate = limiter.consume(identity.reviewer);
  if (!rate.allowed) throw new GovernanceRateLimitError(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)), 300);
  if (context) logRequest("info", "work_queue.authenticated", context, { reviewer: identity.reviewer, requiredRole, rateLimitRemaining: rate.remaining });
  return {
    identity,
    service: new EnterpriseWorkQueueService(new EnterpriseWorkQueueRepository(getRdlDatabaseClient())),
    rate,
  };
}

export { handleApiError, GOVERNANCE_REVIEWER_ROLE, WORK_QUEUE_COORDINATOR_ROLE };
export type { ApiRequest, ApiResponse };
