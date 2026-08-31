import { AlertTriangle, BellRing, CheckCircle2, Clock3, Inbox, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WORK_QUEUE_DEMO } from "../rdl/workQueueDemo";
import { loadWorkQueueInbox, loadWorkQueueSession, type WorkQueueItem, type WorkQueuePayload, type WorkQueueSession } from "../rdl/workQueueService";

export function RdlWorkQueuePage() {
  const [session, setSession] = useState<WorkQueueSession | null>(null);
  const [live, setLive] = useState<WorkQueuePayload | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadWorkQueueSession(), loadWorkQueueInbox()]).then(([nextSession, payload]) => {
      if (!active) return;
      setSession(nextSession);
      setLive(nextSession && payload ? payload : null);
    });
    return () => { active = false; };
  }, []);

  const payload = live ?? WORK_QUEUE_DEMO;
  const demo = !live;
  const metrics = useMemo(() => summarize(payload.items), [payload.items]);

  return <div className="page rdl-hierarchy-page">
    <header className="page-header"><div>
      <span className="eyebrow">Operational governance</span>
      <h1>Enterprise notifications & work queue</h1>
      <p>Turn governance signals into assigned, acknowledged and time-bound work without moving the authoritative standards lifecycle automatically.</p>
    </div></header>

    <section className="rdl-hierarchy-callout" aria-labelledby="work-queue-boundary-heading">
      <Inbox size={24}/><div>
        <h2 id="work-queue-boundary-heading">Personal inbox, not an approval engine</h2>
        <p>{demo ? "Read-only work queue demonstration" : `Authenticated reviewer: ${session?.reviewer}`}. Assignment, reminders and SLA indicators orchestrate attention only; approvals, publication, staging, activation and migration remain in their governed workflows.</p>
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="workload-heading">
      <h2 id="workload-heading">My workload</h2>
      <div className="rdl-publication-summary-grid">
        <article><Inbox/><strong>{metrics.open} active items</strong><span>{metrics.inProgress} currently in progress</span></article>
        <article><Clock3/><strong>{metrics.overdue} overdue</strong><span>{metrics.dueSoon} due within 24 hours</span></article>
        <article><AlertTriangle/><strong>{metrics.critical} critical</strong><span>{metrics.escalated} escalated items</span></article>
        <article><BellRing/><strong>{metrics.reminders} reminders</strong><span>Recorded as durable operational events</span></article>
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="inbox-heading">
      <h2 id="inbox-heading">Reviewer inbox</h2>
      <p className="rdl-intelligence-copy">Items are ordered for attention by priority and SLA state. Every row drills through to the workflow that owns the actual decision.</p>
      <div className="rdl-table-scroll" tabIndex={0} aria-label="Enterprise standards reviewer work queue">
        <table aria-label="Enterprise standards reviewer work queue">
          <thead><tr><th>Priority</th><th>Work item</th><th>Assignee</th><th>Status</th><th>SLA</th><th>Reminders</th><th>Action</th></tr></thead>
          <tbody>{payload.items.length ? payload.items.map(item => <tr key={item.work_item_id}>
            <td><Priority item={item}/></td>
            <th scope="row">{item.title}<br/><small>{human(item.source_type)} · {item.scope_key || item.source_record_key}</small></th>
            <td>{item.assignee_key || "Unassigned"}</td>
            <td>{human(item.status)}</td>
            <td>{human(item.sla_state)}{item.due_at ? <><br/><small>{formatDate(item.due_at)}</small></> : null}</td>
            <td>{item.reminder_count}{item.escalation_level ? ` · L${item.escalation_level}` : ""}</td>
            <td><Link to={item.drill_through_path}>Open governed workflow</Link></td>
          </tr>) : <tr><td colSpan={7}>No active work items assigned to this reviewer.</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="workflow-heading">
      <h2 id="workflow-heading">Operational workflow</h2>
      <div className="rdl-composition-rules">
        <div><UserCheck/><span><strong>Assign.</strong> A coordinator can assign accountable ownership without changing the underlying governance decision.</span></div>
        <div><CheckCircle2/><span><strong>Acknowledge and work.</strong> Reviewers explicitly acknowledge, start and complete operational work items.</span></div>
        <div><BellRing/><span><strong>Remind and escalate.</strong> Reminders and escalation levels are durable events; they never auto-approve the source workflow.</span></div>
        <div><ShieldCheck/><span><strong>Fail closed.</strong> Invalid, unauthorized, malformed or SPA-fallback API responses cannot create a live work queue session.</span></div>
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="control-tower-link-heading">
      <h2 id="control-tower-link-heading">Enterprise oversight</h2>
      <p className="rdl-intelligence-copy">Use the Control Tower for portfolio-level workload and this inbox for individual accountability.</p>
      <div className="rdl-publication-actions"><Link to="/control-tower">Open Standards Control Tower</Link><Link to="/extensions">Extension governance</Link><Link to="/migration">Migration planning</Link></div>
    </section>
  </div>;
}

function summarize(items: WorkQueueItem[]) {
  return {
    open: items.filter(i => !["completed","dismissed"].includes(i.status)).length,
    inProgress: items.filter(i => i.status === "in_progress").length,
    overdue: items.filter(i => i.sla_state === "overdue").length,
    dueSoon: items.filter(i => i.sla_state === "due_soon").length,
    critical: items.filter(i => i.priority === "critical").length,
    escalated: items.filter(i => i.escalation_level > 0).length,
    reminders: items.reduce((sum, i) => sum + i.reminder_count, 0),
  };
}
function human(value: string) { return value.replaceAll("_", " "); }
function formatDate(value: string) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString() : value; }
function Priority({ item }: { item: WorkQueueItem }) { return item.priority === "critical" || item.sla_state === "overdue" ? <><AlertTriangle size={15}/> {human(item.priority)}</> : <><CheckCircle2 size={15}/> {human(item.priority)}</>; }
