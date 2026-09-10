import { PROPOSAL_BUNDLE_DECISION_LABELS, type ProposalBundleDecisionAction } from "./proposalBundleGovernanceDecisionService";

type Props = {
  proposalBundleId: number;
  reviewVersion: number;
  canAccept: boolean;
  terminal: boolean;
  failClosedReason?: string;
  onDecision: (action: ProposalBundleDecisionAction) => void;
};

export function ProposalBundleGovernanceActions({ proposalBundleId, reviewVersion, canAccept, terminal, failClosedReason, onDecision }: Props) {
  const decisionDisabled = terminal || !Number.isSafeInteger(proposalBundleId) || proposalBundleId <= 0 || !Number.isSafeInteger(reviewVersion) || reviewVersion < 0;
  return (
    <section aria-label="Proposal bundle governance actions" className="proposal-bundle-governance-actions">
      <p className="proposal-bundle-governance-actions__version">Review version: {reviewVersion}</p>
      {failClosedReason ? <p role="alert" className="proposal-bundle-governance-actions__warning">{failClosedReason}</p> : null}
      <div className="proposal-bundle-governance-actions__buttons">
        <button type="button" disabled={decisionDisabled} onClick={() => onDecision("start_review")}>{PROPOSAL_BUNDLE_DECISION_LABELS.start_review}</button>
        <button type="button" disabled={decisionDisabled || !canAccept} onClick={() => onDecision("accept")}>{PROPOSAL_BUNDLE_DECISION_LABELS.accept}</button>
        <button type="button" disabled={decisionDisabled} onClick={() => onDecision("reject")}>{PROPOSAL_BUNDLE_DECISION_LABELS.reject}</button>
        <button type="button" disabled={decisionDisabled} onClick={() => onDecision("withdraw")}>{PROPOSAL_BUNDLE_DECISION_LABELS.withdraw}</button>
        <button type="button" disabled={decisionDisabled} onClick={() => onDecision("link_publication")}>{PROPOSAL_BUNDLE_DECISION_LABELS.link_publication}</button>
      </div>
    </section>
  );
}
