import { proposalBundleBadge, proposalBundleCanBeAccepted, type ProposalBundleQueueItem } from "../rdl/proposalBundleReviewService";
import "./RdlProposalBundleReviewPage.css";

const EMPTY_QUEUE: ProposalBundleQueueItem[] = [];

export function RdlProposalBundleReviewPage({ bundles = EMPTY_QUEUE }: { bundles?: ProposalBundleQueueItem[] }) {
  const ready = bundles.filter(proposalBundleCanBeAccepted).length;
  const incomplete = bundles.filter((bundle) => bundle.reviewState === "incomplete_fail_closed").length;
  return (
    <main className="rdl-proposal-bundle-review-page" aria-labelledby="proposal-bundle-review-title">
      <header className="rdl-proposal-bundle-review-page__header">
        <p className="rdl-proposal-bundle-review-page__eyebrow">RDL Explorer governance</p>
        <h1 id="proposal-bundle-review-title">Proposal bundle review</h1>
        <p>
          Review atomic multi-component standards proposals without giving DataGate publication or promotion authority.
        </p>
      </header>

      <section className="rdl-proposal-bundle-review-page__summary" aria-label="Proposal bundle review summary">
        <article><strong>{bundles.length}</strong><span>Total bundles</span></article>
        <article><strong>{ready}</strong><span>Ready for review</span></article>
        <article><strong>{incomplete}</strong><span>Fail-closed incomplete</span></article>
      </section>

      <section className="rdl-proposal-bundle-review-page__queue" aria-label="Proposal bundle queue">
        {bundles.length === 0 ? (
          <p className="rdl-proposal-bundle-review-page__empty">No proposal bundles are currently loaded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Target</th>
                <th>Components</th>
                <th>Dependencies</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((bundle) => (
                <tr key={bundle.proposalBundleId}>
                  <td>{bundle.sourceSystem} / {bundle.requestKey}</td>
                  <td>{bundle.targetLevel} / {bundle.targetContextKey}</td>
                  <td>{bundle.componentCount}</td>
                  <td>{bundle.missingDependencyCount} missing of {bundle.dependencyCount}</td>
                  <td>{proposalBundleBadge(bundle)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <aside className="rdl-proposal-bundle-review-page__boundary" aria-label="Governance boundary">
        <strong>Governance boundary:</strong> acceptance does not publish, promotion remains RDL Explorer only, and direct DataGate database mutation is prohibited.
      </aside>
    </main>
  );
}

export default RdlProposalBundleReviewPage;
