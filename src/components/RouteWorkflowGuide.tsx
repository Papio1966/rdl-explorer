import { CircleHelp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { guideForPath } from "../rdl/productBoundaryGuidance";
import "./RouteWorkflowGuide.css";

export function RouteWorkflowGuide() {
  const location = useLocation();
  const guide = guideForPath(location.pathname);
  if (!guide) return null;

  return (
    <details className="route-workflow-guide">
      <summary><CircleHelp size={16} /> How to use this screen</summary>
      <div className="route-workflow-guide-body">
        <p className="route-workflow-guide-summary">{guide.summary}</p>
        <dl>
          <dt>Where this sits in the workflow</dt>
          <dd>{guide.workflowPosition}</dd>
          <dt>Primary users</dt>
          <dd>{guide.primaryUsers.join(", ")}</dd>
        </dl>
        <div className="route-workflow-guide-columns">
          <section>
            <h3>How to use it</h3>
            <ol>{guide.howTo.map((item) => <li key={item}>{item}</li>)}</ol>
          </section>
          <section>
            <h3>Decision guidance</h3>
            <ul>{guide.decisionGuidance.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h3>Consequences to check before confirming</h3>
            <ul>{guide.consequences.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </div>
    </details>
  );
}
