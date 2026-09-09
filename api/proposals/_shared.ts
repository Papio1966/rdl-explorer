import { EXTENSION_REVIEWER_ROLE, PACKAGE_CONSUMER_ROLE, authenticateGovernanceIdentity } from "../../server/auth/GovernanceIdentity.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { ExternalStandardsProposalRepository } from "../../server/rdl/ExternalStandardsProposalRepository.ts";
import { ExternalStandardsProposalService } from "../../server/rdl/ExternalStandardsProposalService.ts";
import type { RequestContext } from "../../server/runtime/RequestContext.ts";
import { FixedWindowRateLimiter } from "../../server/runtime/RateLimiter.ts";
import { logRequest } from "../../server/runtime/StructuredLogger.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { GovernanceRateLimitError, handleApiError, parseBody, queryValue, type ApiRequest, type ApiResponse } from "../governance/_shared.ts";

let proposalLimiter: FixedWindowRateLimiter | undefined;
let reviewLimiter: FixedWindowRateLimiter | undefined;

export { handleApiError, parseBody, queryValue };
export type { ApiRequest, ApiResponse };

export function authenticatedProposalContext(request: ApiRequest, context?: RequestContext) {
  assertRuntimeEnvironment();
  const identity = authenticateGovernanceIdentity(request.headers, process.env, Date.now(), PACKAGE_CONSUMER_ROLE);
  proposalLimiter ??= new FixedWindowRateLimiter(120, 60_000);
  const rate = proposalLimiter.consume(identity.reviewer);
  if (!rate.allowed) throw new GovernanceRateLimitError(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)), 120);
  if (context) logRequest("info", "external_proposal.authenticated", context, { consumer: identity.reviewer, rateLimitRemaining: rate.remaining });
  return { identity, service: new ExternalStandardsProposalService(new ExternalStandardsProposalRepository(getRdlDatabaseClient())), rate };
}

export function authenticatedProposalReviewContext(request: ApiRequest, context?: RequestContext) {
  assertRuntimeEnvironment();
  const identity = authenticateGovernanceIdentity(request.headers, process.env, Date.now(), EXTENSION_REVIEWER_ROLE);
  reviewLimiter ??= new FixedWindowRateLimiter(120, 60_000);
  const rate = reviewLimiter.consume(identity.reviewer);
  if (!rate.allowed) throw new GovernanceRateLimitError(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)), 120);
  if (context) logRequest("info", "external_proposal_review.authenticated", context, { reviewer: identity.reviewer, rateLimitRemaining: rate.remaining });
  return { identity, service: new ExternalStandardsProposalService(new ExternalStandardsProposalRepository(getRdlDatabaseClient())), rate };
}
