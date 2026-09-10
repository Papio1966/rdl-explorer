export type ProposalBundleDecisionAction = "start_review" | "accept" | "reject" | "withdraw" | "link_publication";
export type ProposalBundleDecisionCommand = {
  action: ProposalBundleDecisionAction;
  rationale: string;
  expectedVersion: number;
  evidence?: Record<string, unknown>;
  publicationResult?: Record<string, unknown>;
};

export type ProposalBundleDecisionResult = {
  proposalBundleId?: number;
  proposalStatus?: string;
  reviewVersion?: number;
  [key: string]: unknown;
};

export const PROPOSAL_BUNDLE_DECISION_LABELS: Record<ProposalBundleDecisionAction, string> = {
  start_review: "Start review",
  accept: "Accept",
  reject: "Reject",
  withdraw: "Withdraw",
  link_publication: "Link publication",
};

export function proposalBundleDecisionIsTerminal(status: string): boolean {
  return status === "accepted" || status === "rejected" || status === "withdrawn";
}

export function proposalBundleDecisionRationaleIsValid(rationale: string): boolean {
  const length = rationale.trim().length;
  return length >= 10 && length <= 2000;
}

export async function submitProposalBundleDecision(proposalBundleId: number, command: ProposalBundleDecisionCommand): Promise<ProposalBundleDecisionResult> {
  if (!Number.isSafeInteger(proposalBundleId) || proposalBundleId <= 0) throw new Error("A valid proposalBundleId is required.");
  if (!proposalBundleDecisionRationaleIsValid(command.rationale)) throw new Error("Review rationale must be between 10 and 2000 characters.");
  if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0) throw new Error("A valid expectedVersion is required.");
  const response = await fetch("/api/proposals/bundle-review", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ proposalBundleId, ...command }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Proposal bundle decision failed.");
  return payload as ProposalBundleDecisionResult;
}
