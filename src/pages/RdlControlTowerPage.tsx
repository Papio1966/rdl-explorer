import { AlertTriangle, BellRing, CheckCircle2, CircleGauge, ClipboardList, GitBranch, LibraryBig, Network, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CONTROL_TOWER_DEMO } from "../rdl/controlTowerDemo";
import { loadControlTowerDashboard, loadControlTowerSession, type ControlTowerDashboard, type ControlTowerSession } from "../rdl/controlTowerService";

export function RdlControlTowerPage() {
  const [session, setSession] = useState<ControlTowerSession | null>(null);
  const [liveDashboard, setLiveDashboard] = useState<ControlTowerDashboard | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadControlTowerSession(), loadControlTowerDashboard()]).then(([nextSession, dashboard]) => {
      if (!active) return;
      setSession(nextSession);
      setLiveDashboard(nextSession && dashboard ? dashboard : null);
    });
    return () => { active = false; };
  }, []);

  const dashboard = liveDashboard ?? CONTROL_TOWER_DEMO;
  const demo = !liveDashboard;
  const k = dashboard.kpis;
  const attentionCount = k.pending_extension_review_count + k.unacknowledged_notification_count + k.open_migration_plan_count;

  return <div className="page rdl-hierarchy-page">
    <header className="page-header">
      <div>
        <span className="eyebrow">RDL-023 · Enterprise operations</span>
        <h1>Enterprise standards dashboard & control tower</h1>
        <p>See standards health, governance workload, release adoption and migration readiness across the governed RDL lifecycle, then drill through to the authoritative workflow that owns each decision.</p>
      </div>
    </header>

    <section className="rdl-hierarchy-callout" aria-labelledby="control-tower-boundary-heading">
      <CircleGauge size={24}/>
      <div>
        <h2 id="control-tower-boundary-heading">Operational control plane, not a second system of record</h2>
        <p>{demo ? "Read-only control tower demonstration" : `Authenticated standards reviewer: ${session?.reviewer}`}. Dashboard metrics are projections over governed lifecycle state; the control tower never edits release, extension, consumer or migration state directly.</p>
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="health-heading">
      <h2 id="health-heading">Portfolio health</h2>
      <div className="rdl-publication-summary-grid">
        <article><LibraryBig/><strong>{k.active_context_count} active contexts</strong><span>{k.published_release_count} published releases</span></article>
        <article><ShieldCheck/><strong>{k.pending_extension_review_count} extension reviews</strong><span>{attentionCount} total attention items</span></article>
        <article><Users/><strong>{k.enabled_consumer_count} enabled consumers</strong><span>{k.pending_consumer_adoption_count} releases awaiting adoption</span></article>
        <article><ClipboardList/><strong>{k.open_migration_plan_count} open migrations</strong><span>{k.blocked_migration_plan_count} blocked · {k.overdue_migration_action_count} overdue actions</span></article>
      </div>
      <p className="rdl-intelligence-copy">Overall health: <strong>{dashboard.health}</strong>. Breaking-change and overdue indicators are attention signals only; they do not bypass the governed review and adoption workflows.</p>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="queue-heading">
      <h2 id="queue-heading">Governance & adoption queue</h2>
      <p className="rdl-intelligence-copy">One operational queue brings together extension reviews, consumer notifications and migration plans while preserving drill-through to the authoritative workflow.</p>
      <div className="rdl-table-scroll" tabIndex={0} aria-label="Enterprise standards governance and adoption queue">
        <table aria-label="Enterprise standards governance and adoption queue">
          <thead><tr><th>Priority</th><th>Work item</th><th>Scope</th><th>Status</th><th>Owner</th><th>Action</th></tr></thead>
          <tbody>{dashboard.queue.length ? dashboard.queue.map((item) => <tr key={`${item.queue_type}-${item.queue_item_id}`}>
            <td><PriorityIcon priority={item.priority}/> {human(item.priority)}</td>
            <th scope="row">{item.title}<br/><small>{human(item.queue_type)}</small></th>
            <td>{item.scope_name || item.scope_key}</td>
            <td>{human(item.status)}</td>
            <td>{item.owner_key || "Unassigned"}</td>
            <td><Link to={item.drill_through_path}>Open workflow</Link></td>
          </tr>) : <tr><td colSpan={6}>No queued governance or adoption items.</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="release-health-heading">
      <h2 id="release-health-heading">Published release health</h2>
      <div className="rdl-table-scroll" tabIndex={0} aria-label="Published release health and consumer adoption">
        <table>
          <thead><tr><th>Release</th><th>Context</th><th>Distribution</th><th>Consumers</th><th>Discovered</th><th>Staged</th><th>Activated</th><th>Unacknowledged</th></tr></thead>
          <tbody>{dashboard.releases.length ? dashboard.releases.map((release) => <tr key={release.release_id}>
            <th scope="row">{release.release_key}<br/><code>{release.release_version}</code></th>
            <td>{release.context_name}</td><td>{human(release.lifecycle_status || "not_distributed")}</td><td>{release.subscribed_consumer_count}</td><td>{release.discovered_consumer_count}</td><td>{release.staged_consumer_count}</td><td>{release.activated_consumer_count}</td><td>{release.unacknowledged_notification_count}</td>
          </tr>) : <tr><td colSpan={8}>No published releases yet.</td></tr>}</tbody>
        </table>
      </div>
      <div className="rdl-publication-actions"><Link to="/publication">Publication</Link><Link to="/distribution">Distribution</Link><Link to="/integration">Consumer integration</Link></div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="migration-readiness-heading">
      <h2 id="migration-readiness-heading">Migration readiness</h2>
      <div className="rdl-publication-summary-grid">
        <article><GitBranch/><strong>{k.release_analysis_count} release analyses</strong><span>Impact intelligence available for governed migration decisions</span></article>
        <article><AlertTriangle/><strong>{k.open_breaking_action_count} open breaking actions</strong><span>Require remediation or explicit waiver</span></article>
        <article><BellRing/><strong>{k.unacknowledged_notification_count} notifications awaiting acknowledgement</strong><span>Consumer pull and staging remain explicit</span></article>
      </div>
      <div className="rdl-table-scroll" tabIndex={0} aria-label="Migration readiness portfolio">
        <table>
          <thead><tr><th>Subject</th><th>Release transition</th><th>Readiness</th><th>Lifecycle</th><th>Actions open</th><th>Breaking</th></tr></thead>
          <tbody>{dashboard.migrations.length ? dashboard.migrations.map((plan) => <tr key={plan.migration_plan_id}>
            <th scope="row">{plan.subject_key}<br/><small>{plan.title}</small></th>
            <td>{plan.from_release_version} → {plan.to_release_version}</td><td>{human(plan.readiness_status)}</td><td>{human(plan.lifecycle_status)}</td><td>{plan.open_action_count} / {plan.action_count}</td><td>{plan.breaking_action_count}</td>
          </tr>) : <tr><td colSpan={6}>No open migration plans.</td></tr>}</tbody>
        </table>
      </div>
      <div className="rdl-publication-actions"><Link to="/impact">Release impact</Link><Link to="/migration">Migration planning</Link></div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="principles-heading">
      <h2 id="principles-heading">Control tower principles</h2>
      <div className="rdl-composition-rules">
        <div><CheckCircle2/><span><strong>Read-only aggregation.</strong> Authoritative state remains in the existing governance, publication, integration and migration models.</span></div>
        <div><Network/><span><strong>Drill-through, not duplication.</strong> Every queue item links back to the workflow that owns the decision.</span></div>
        <div><ShieldCheck/><span><strong>Fail closed.</strong> Invalid, unauthorized, malformed or SPA-fallback API responses never produce a live enterprise dashboard.</span></div>
        <div><GitBranch/><span><strong>No automatic adoption.</strong> Health signals never auto-approve, stage or activate a new standards release.</span></div>
      </div>
    </section>
  </div>;
}

function human(value: string) { return value.replaceAll("_", " "); }
function PriorityIcon({ priority }: { priority: string }) {
  return priority === "blocked" || priority === "overdue" || priority === "review_required" ? <AlertTriangle size={15}/> : <CheckCircle2 size={15}/>;
}
