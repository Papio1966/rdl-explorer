import { CheckCircle2, Clock3, Database, History, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { entityTypeLabel, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import { loadGovernanceProjection, type GovernanceProjection } from "../rdl/governance";

export function RdlGovernancePage(){
  const [data,setData]=useState<GovernanceProjection>();const [error,setError]=useState(false);const [status,setStatus]=useState("candidate");
  useEffect(()=>{loadGovernanceProjection().then(setData).catch(()=>setError(true));},[]);
  const items=useMemo(()=>data?.items.filter(x=>status==="all"||x.status===status)??[],[data,status]);
  return <div className="content-page rdl-governance-page">
    <div className="page-heading"><div><div className="eyebrow">Cross-RDL governance</div><h1>Mapping review queue</h1></div><p>Review state, evidence and auditability are explicit. Candidate generation never grants approval.</p></div>
    <div className="rdl-intelligence-warning"><ShieldCheck size={19}/><div><strong>Governed write boundary</strong><p>Approve, reject and supersede are server-governed database actions with reviewer, rationale, optimistic version checks and append-only audit history. The pilot browser queue is intentionally read-only.</p></div></div>
    {data&&<div className="rdl-governance-summary" aria-label="Mapping governance status summary">
      <div><Clock3 size={17}/><strong>{data.summary.candidate??0}</strong><span>Candidate</span></div><div><CheckCircle2 size={17}/><strong>{data.summary.approved??0}</strong><span>Approved</span></div><div><XCircle size={17}/><strong>{data.summary.rejected??0}</strong><span>Rejected</span></div><div><History size={17}/><strong>{data.summary.retired??0}</strong><span>Retired</span></div>
    </div>}
    <div className="rdl-governance-toolbar"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="candidate">Candidate</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="retired">Retired</option><option value="all">All</option></select></label><span>{items.length} review items</span></div>
    {error&&<div role="alert" className="rdl-search-state">Mapping governance projection could not be loaded.</div>}{!data&&!error&&<div role="status" className="rdl-search-state">Loading mapping governance…</div>}
    <div className="rdl-governance-list">{items.slice(0,100).map(item=><article className="rdl-governance-card" key={item.queueKey}>
      <div className="rdl-governance-card-head"><span className="rdl-mapping-type">{item.mappingType.replaceAll('_',' ')}</span><span className={`rdl-review-status rdl-review-status-${item.status}`}>{item.status}</span><span>v{item.reviewVersion}</span></div>
      <div className="rdl-mapping-entities"><Link to={rdlEntityRoute(item.left.sourceKey,item.left.entityType,item.left.nativeIdentifier)}><small>{getRdlSource(item.left.sourceKey)?.shortName} · {entityTypeLabel(item.left.entityType)}</small><strong>{item.left.name}</strong><code>{item.left.nativeIdentifier}</code></Link><span aria-hidden="true">↔</span><Link to={rdlEntityRoute(item.right.sourceKey,item.right.entityType,item.right.nativeIdentifier)}><small>{getRdlSource(item.right.sourceKey)?.shortName} · {entityTypeLabel(item.right.entityType)}</small><strong>{item.right.name}</strong><code>{item.right.nativeIdentifier}</code></Link></div>
      <div className="rdl-mapping-meta"><span><Database size={13}/>{item.provenanceMethod.replaceAll('_',' ')}</span><span>Confidence {(item.confidence*100).toFixed(0)}%</span>{item.reviewedBy&&<span>Reviewed by {item.reviewedBy}</span>}</div>
      <div className="rdl-review-actions" aria-label={`Review actions for ${item.normalizedName}`}><button type="button" disabled title="Requires governed server review service">Approve</button><button type="button" disabled title="Requires governed server review service">Reject</button><button type="button" disabled title="Requires governed server review service">Supersede</button><span>Read-only pilot projection</span></div>
    </article>)}</div>
  </div>;
}
