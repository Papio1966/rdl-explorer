import { ArrowRight, Database, GitCompareArrows, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { RDL_SOURCES } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";

export function RdlCataloguePage() {
  const { setScope } = useRdlScope();
  return (
    <div className="content-page rdl-catalogue-page">
      <div className="page-heading"><div><div className="eyebrow">Multi-RDL catalogue</div><h1>Loaded reference data libraries</h1></div><p>Reviewed baselines and candidate extensions can retain multiple releases. Candidate upgrades never overwrite their historical package.</p></div>
      <div className="rdl-source-grid">
        {RDL_SOURCES.map((source) => (
          <article className="rdl-source-card" key={source.key}>
            <div className="rdl-source-card-heading"><Database size={20} /><span>{source.releases.length} release{source.releases.length===1?"":"s"}</span></div>
            <h2>{source.name}</h2><p>{source.description}</p>
            <div className="rdl-release-list">{source.releases.map((release)=><div className="rdl-release-list-row" key={release.key}><div><strong>{release.versionLabel}</strong><span className={`rdl-status-badge rdl-status-${release.status}`}>{release.status}</span><small>{release.description}</small></div><Link to={`/search?source=${encodeURIComponent(source.key)}&release=${encodeURIComponent(release.key)}`} onClick={()=>setScope(source.key)}>Browse <ArrowRight size={15}/></Link></div>)}</div>
            {source.releases.length>1 && <Link className="rdl-compare-link" to={`/rdls/${encodeURIComponent(source.key)}/compare?from=${encodeURIComponent(source.releases.at(-1)?.key??"")}&to=${encodeURIComponent(source.defaultReleaseKey)}`}><GitCompareArrows size={16}/>Compare releases</Link>}
          </article>
        ))}
      </div>
      <div className="rdl-provenance-note"><ShieldCheck size={19} /><div><strong>Release-aware by design</strong><p>Search and detail routes carry an explicit release key. Historical packages remain addressable while current browsing defaults to the selected successor release.</p></div></div>
    </div>
  );
}
