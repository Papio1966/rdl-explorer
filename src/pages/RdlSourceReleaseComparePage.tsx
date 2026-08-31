import { ArrowRight, GitCompareArrows, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { entityTypeLabel, getRdlRelease, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import { compareIndexedReleaseEntities, loadSourceReleaseAudit, type EntityDelta, type SourceReleaseAudit } from "../rdl/sourceReleaseDelta";

function auditKey(sourceKey:string){return sourceKey === "water-desalination" ? "Water" : sourceKey === "ccus" ? "CCUS" : "";}

export function RdlSourceReleaseComparePage(){
  const { sourceKey }=useParams(); const [params,setParams]=useSearchParams(); const source=getRdlSource(sourceKey);
  const from=params.get("from") ?? source?.releases.at(-1)?.key ?? ""; const to=params.get("to") ?? source?.defaultReleaseKey ?? "";
  const [audit,setAudit]=useState<SourceReleaseAudit>(); const [deltas,setDeltas]=useState<EntityDelta[]>([]); const [error,setError]=useState(false);
  useEffect(()=>{if(!source)return;Promise.all([loadSourceReleaseAudit(),compareIndexedReleaseEntities(source.key,from,to)]).then(([a,d])=>{setAudit(a);setDeltas(d);}).catch(()=>setError(true));},[source,from,to]);
  const summary=useMemo(()=>audit?.continuity[auditKey(source?.key??"")],[audit,source]);
  if(!source)return <div className="content-page"><div className="rdl-search-state"><strong>Unknown RDL source</strong></div></div>;
  const fromRelease=getRdlRelease(source.key,from),toRelease=getRdlRelease(source.key,to);
  const set=(key:string,value:string)=>{const next=new URLSearchParams(params);next.set(key,value);setParams(next);};
  return <div className="content-page rdl-release-compare-page">
    <div className="page-heading"><div><div className="eyebrow">Source release comparison</div><h1>{source.shortName}: release delta</h1></div><p>Compare two immutable source releases using native identifiers. Renames remain the same entity; new identifiers are additions.</p></div>
    <div className="rdl-search-toolbar rdl-release-compare-toolbar"><label>From <select value={from} onChange={e=>set("from",e.target.value)}>{source.releases.map(r=><option key={r.key} value={r.key}>{r.versionLabel} · {r.status}</option>)}</select></label><ArrowRight size={18}/><label>To <select value={to} onChange={e=>set("to",e.target.value)}>{source.releases.map(r=><option key={r.key} value={r.key}>{r.versionLabel} · {r.status}</option>)}</select></label></div>
    {error && <div className="rdl-search-state" role="alert">Release comparison data could not be loaded.</div>}
    {summary && <>
      <section className="enterprise-section-card"><div className="enterprise-section-heading"><div><h2>Audited semantic delta</h2><p>{fromRelease?.versionLabel} → {toRelease?.versionLabel}</p></div><GitCompareArrows size={22}/></div>
        <div className="rdl-release-delta-grid">{Object.entries(summary.entities).map(([name,count])=><div key={name}><strong>{count.added}</strong><span>{name} added</span><small>{count.retained} retained · {count.removed} retired</small></div>)}</div>
      </section>
      <section className="enterprise-section-card"><h2>Relationship enrichment</h2><div className="rdl-release-delta-grid">{Object.entries(summary.relationships).map(([name,count])=><div key={name}><strong>{count.added}</strong><span>{name} added</span><small>{count.retained} retained · {count.removed} retired</small></div>)}</div></section>
    </>}
    <section className="enterprise-section-card"><div className="enterprise-section-heading"><div><h2>Changed entities</h2><p>{deltas.length} additions, retirements or canonical-name changes in the browsable entity index.</p></div></div>
      <div className="rdl-release-delta-list">{deltas.slice(0,180).map(d=><div key={`${d.kind}:${d.entityType}:${d.nativeIdentifier}`} className="rdl-release-delta-row"><span className={`rdl-review-status rdl-review-status-${d.kind}`}>{d.kind}</span><span>{entityTypeLabel(d.entityType)}</span><code>{d.nativeIdentifier}</code><div>{d.kind==="modified"?<><span>{d.fromName}</span><ArrowRight size={14}/><strong>{d.toName}</strong></>:<strong>{d.toName??d.fromName}</strong>}</div>{d.toName && <Link to={rdlEntityRoute(source.key,to,d.entityType,d.nativeIdentifier)}>Open</Link>}</div>)}</div>
    </section>
    <div className="rdl-provenance-note"><ShieldCheck size={19}/><div><strong>Governed identity evidence</strong><p>The release-safety audit is fingerprinted as <code>{audit?.auditSha256.slice(0,16)}…</code>. Database ingestion independently rejects cross-release entity-type reuse and unaudited canonical identity changes.</p></div></div>
  </div>;
}
