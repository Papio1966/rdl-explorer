export type ProposalBundleGovernanceDecisionAction = "start_review" | "accept" | "reject" | "withdraw" | "link_publication";
export type ProposalBundleGovernanceTerminalStatus = "accepted" | "rejected" | "withdrawn";

export const PROPOSAL_BUNDLE_GOVERNANCE_ACTIONS: ReadonlySet<string> = new Set([
  "start_review",
  "accept",
  "reject",
  "withdraw",
  "link_publication",
]);

export const PROPOSAL_BUNDLE_TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "accepted",
  "rejected",
  "withdrawn",
]);

export type ProposalBundleDecisionInput = {
  action: ProposalBundleGovernanceDecisionAction;
  rationale: string;
  expectedVersion: number;
  evidence?: unknown;
  publicationResult?: unknown;
};

export type ProposalBundleAcceptanceState = {
  validationStatus: string;
  completenessStatus: string;
  missingDependencyCount: number;
  proposalStatus: string;
};

export function validateProposalBundleDecisionCommand(input: ProposalBundleDecisionInput): void {
  if (!PROPOSAL_BUNDLE_GOVERNANCE_ACTIONS.has(input.action)) throw new Error("Unsupported proposal bundle governance action.");
  const rationale = String(input.rationale ?? "").trim();
  if (rationale.length < 10 || rationale.length > 2000) throw new Error("Review rationale must be between 10 and 2000 characters.");
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw new Error("A valid expectedVersion is required.");
  if (input.evidence !== undefined && !isPlainObject(input.evidence)) throw new Error("evidence must be an object when supplied.");
  if (input.publicationResult !== undefined && !isPlainObject(input.publicationResult)) throw new Error("publicationResult must be an object when supplied.");
}

export function proposalBundleDecisionIsTerminal(status: string): status is ProposalBundleGovernanceTerminalStatus {
  return PROPOSAL_BUNDLE_TERMINAL_STATUSES.has(status);
}

export function proposalBundleAcceptanceFailClosedReason(state: ProposalBundleAcceptanceState): string | undefined {
  if (proposalBundleDecisionIsTerminal(state.proposalStatus)) return `Proposal bundle is terminal (${state.proposalStatus}).`;
  if (state.validationStatus !== "schema_validated") return "Proposal bundle schema validation has not passed.";
  if (state.completenessStatus !== "complete") return "Proposal bundle is an incomplete candidate and must fail closed on accept.";
  if (state.missingDependencyCount > 0) return `Proposal bundle has ${state.missingDependencyCount} unresolved required dependencies.`;
  return undefined;
}

export function proposalBundleCanTransitionToAccepted(state: ProposalBundleAcceptanceState): boolean {
  return proposalBundleAcceptanceFailClosedReason(state) === undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
