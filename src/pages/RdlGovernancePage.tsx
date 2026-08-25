import { CheckCircle2, Clock3, Database, History, LockKeyhole, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { entityTypeLabel, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import { loadGovernanceProjection, type GovernanceProjection, type ReviewQueueItem } from "../rdl/governance";
import {
  loadGovernanceSession,
  loadLiveGovernanceQueue,
  submitGovernanceReview,
  type GovernanceReviewAction,
  type GovernanceSession,
  type LiveGovernanceQueueItem,
} from "../rdl/governanceService";

type DisplayItem = {
  key: string;
  mappingId?: number;
  mappingType: string;
  provenanceMethod: string;
  confidence: number;
  status: string;
  reviewVersion: number;
  reviewedBy?: string;
  reviewRationale?: string;
  left: { sourceKey: string; entityType: string; nativeIdentifier: string; name: string };
  right: { sourceKey: string; entityType: string; nativeIdentifier: string; name: string };
};

export function RdlGovernancePage() {
  const [projection, setProjection] = useState<GovernanceProjection>();
  const [session, setSession] = useState<GovernanceSession | null>();
  const [liveItems, setLiveItems] = useState<LiveGovernanceQueueItem[]>();
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState("candidate");
  const [activeMappingId, setActiveMappingId] = useState<number>();
  const [action, setAction] = useState<GovernanceReviewAction>("approve");
  const [rationale, setRationale] = useState("");
  const [successorMappingId, setSuccessorMappingId] = useState("");
  const [submitState, setSubmitState] = useState<{ kind: "idle" | "saving" | "success" | "error"; message?: string }>({ kind: "idle" });

  useEffect(() => {
    loadGovernanceProjection().then(setProjection).catch(() => setLoadError(true));
    loadGovernanceSession().then(setSession).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!session || status === "all") { setLiveItems(undefined); return; }
    loadLiveGovernanceQueue(status).then(setLiveItems).catch(() => setLiveItems(undefined));
  }, [session, status]);

  const items = useMemo<DisplayItem[]>(() => {
    if (session && liveItems) return liveItems.map(fromLiveItem);
    return (projection?.items ?? []).filter((item) => status === "all" || item.status === status).map(fromProjectionItem);
  }, [session, liveItems, projection, status]);

  const summary = projection?.summary;
  const activeItem = items.find((item) => item.mappingId === activeMappingId);

  function beginReview(item: DisplayItem, nextAction: GovernanceReviewAction) {
    if (!item.mappingId) return;
    setActiveMappingId(item.mappingId);
    setAction(nextAction);
    setRationale("");
    setSuccessorMappingId("");
    setSubmitState({ kind: "idle" });
  }

  async function submitReview() {
    if (!activeItem?.mappingId) return;
    setSubmitState({ kind: "saving" });
    try {
      await submitGovernanceReview({
        mappingId: activeItem.mappingId,
        action,
        rationale,
        expectedVersion: activeItem.reviewVersion,
        successorMappingId: action === "supersede" ? Number(successorMappingId) : undefined,
      });
      setSubmitState({ kind: "success", message: `${action} decision recorded.` });
      setActiveMappingId(undefined);
      if (status !== "all") setLiveItems(await loadLiveGovernanceQueue(status));
    } catch (error) {
      setSubmitState({ kind: "error", message: error instanceof Error ? error.message : "Review failed." });
    }
  }

  return <div className="content-page rdl-governance-page">
    <div className="page-heading"><div><div className="eyebrow">Cross-RDL governance</div><h1>Mapping review queue</h1></div><p>Review state, evidence and auditability are explicit. Candidate generation never grants approval.</p></div>

    <div className="rdl-intelligence-warning"><ShieldCheck size={19}/><div><strong>Authenticated governance service boundary</strong><p>Review writes run through the server-side governance service. Reviewer identity comes from a signed upstream identity assertion; the browser never receives the signing secret or PostgreSQL credentials.</p></div></div>

    <div className={`rdl-governance-session ${session ? "rdl-governance-session-live" : ""}`} role="status">
      {session ? <><UserCheck size={18}/><div><strong>Authenticated reviewer</strong><span>{session.reviewer} · live governed actions enabled</span></div></> : <><LockKeyhole size={18}/><div><strong>Read-only mode</strong><span>No trusted governance identity is present. Static review projection remains available.</span></div></>}
    </div>

    {summary && <div className="rdl-governance-summary" aria-label="Mapping governance status summary">
      <div><Clock3 size={17}/><strong>{summary.candidate ?? 0}</strong><span>Candidate</span></div><div><CheckCircle2 size={17}/><strong>{summary.approved ?? 0}</strong><span>Approved</span></div><div><XCircle size={17}/><strong>{summary.rejected ?? 0}</strong><span>Rejected</span></div><div><History size={17}/><strong>{summary.retired ?? 0}</strong><span>Retired</span></div>
    </div>}

    <div className="rdl-governance-toolbar"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="candidate">Candidate</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="retired">Retired</option><option value="all">All</option></select></label><span>{items.length} review items{session && liveItems ? " · live repository" : " · projection"}</span></div>

    {loadError && <div role="alert" className="rdl-search-state">Mapping governance projection could not be loaded.</div>}
    {!projection && !loadError && <div role="status" className="rdl-search-state">Loading mapping governance…</div>}
    {submitState.kind === "success" && <div role="status" className="rdl-governance-feedback">{submitState.message}</div>}
    {submitState.kind === "error" && <div role="alert" className="rdl-governance-feedback rdl-governance-feedback-error">{submitState.message}</div>}

    <div className="rdl-governance-list">{items.slice(0, 100).map((item) => <article className="rdl-governance-card" key={item.key}>
      <div className="rdl-governance-card-head"><span className="rdl-mapping-type">{item.mappingType.replaceAll("_", " ")}</span><span className={`rdl-review-status rdl-review-status-${item.status}`}>{item.status}</span><span>v{item.reviewVersion}</span></div>
      <div className="rdl-mapping-entities"><Link to={rdlEntityRoute(item.left.sourceKey, item.left.entityType, item.left.nativeIdentifier)}><small>{getRdlSource(item.left.sourceKey)?.shortName} · {entityTypeLabel(item.left.entityType)}</small><strong>{item.left.name}</strong><code>{item.left.nativeIdentifier}</code></Link><span aria-hidden="true">↔</span><Link to={rdlEntityRoute(item.right.sourceKey, item.right.entityType, item.right.nativeIdentifier)}><small>{getRdlSource(item.right.sourceKey)?.shortName} · {entityTypeLabel(item.right.entityType)}</small><strong>{item.right.name}</strong><code>{item.right.nativeIdentifier}</code></Link></div>
      <div className="rdl-mapping-meta"><span><Database size={13}/>{item.provenanceMethod.replaceAll("_", " ")}</span><span>Confidence {(item.confidence * 100).toFixed(0)}%</span>{item.reviewedBy && <span>Reviewed by {item.reviewedBy}</span>}</div>
      <div className="rdl-review-actions" aria-label={`Review actions for ${item.left.name}`}>
        <button type="button" disabled={!session || item.status !== "candidate" || !item.mappingId} onClick={() => beginReview(item, "approve")}>Approve</button>
        <button type="button" disabled={!session || item.status !== "candidate" || !item.mappingId} onClick={() => beginReview(item, "reject")}>Reject</button>
        <button type="button" disabled={!session || item.status !== "approved" || !item.mappingId} onClick={() => beginReview(item, "supersede")}>Supersede</button>
        <span>{session && item.mappingId ? "Governed service available" : "Read-only projection"}</span>
      </div>
      {activeMappingId === item.mappingId && <div className="rdl-review-editor" aria-label={`Governed ${action} review`}>
        <strong>{action === "approve" ? "Approve mapping" : action === "reject" ? "Reject mapping" : "Supersede mapping"}</strong>
        <label>Rationale<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} minLength={10} maxLength={2000} rows={3} placeholder="Explain the engineering or standards rationale for this decision."/></label>
        {action === "supersede" && <label>Successor mapping ID<input type="number" min="1" value={successorMappingId} onChange={(event) => setSuccessorMappingId(event.target.value)}/></label>}
        <div><button type="button" onClick={submitReview} disabled={submitState.kind === "saving" || rationale.trim().length < 10 || (action === "supersede" && Number(successorMappingId) <= 0)}>{submitState.kind === "saving" ? "Saving…" : "Record governed decision"}</button><button type="button" onClick={() => setActiveMappingId(undefined)}>Cancel</button></div>
      </div>}
    </article>)}</div>
  </div>;
}

function fromLiveItem(item: LiveGovernanceQueueItem): DisplayItem {
  return {
    key: `mapping-${item.mappingId}`, mappingId: item.mappingId, mappingType: item.mappingType, provenanceMethod: item.provenanceMethod,
    confidence: item.confidence, status: item.status, reviewVersion: item.reviewVersion, reviewedBy: item.reviewedBy, reviewRationale: item.reviewRationale,
    left: { sourceKey: item.sourceKey, entityType: item.sourceEntityType, nativeIdentifier: item.sourceNativeIdentifier, name: item.sourceName },
    right: { sourceKey: item.targetKey, entityType: item.targetEntityType, nativeIdentifier: item.targetNativeIdentifier, name: item.targetName },
  };
}

function fromProjectionItem(item: ReviewQueueItem): DisplayItem {
  return {
    key: item.queueKey, mappingType: item.mappingType, provenanceMethod: item.provenanceMethod, confidence: item.confidence, status: item.status,
    reviewVersion: item.reviewVersion, reviewedBy: item.reviewedBy ?? undefined, reviewRationale: item.reviewRationale ?? undefined,
    left: item.left, right: item.right,
  };
}
