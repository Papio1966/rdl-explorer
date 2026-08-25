import { ArrowRight, Database, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { RDL_SOURCES } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";

export function RdlCataloguePage() {
  const { setScope } = useRdlScope();
  return (
    <div className="content-page rdl-catalogue-page">
      <div className="page-heading">
        <div><div className="eyebrow">Multi-RDL catalogue</div><h1>Loaded reference data libraries</h1></div>
        <p>Browse the RDL packages currently available to global search. Provenance and release status remain visible for every source.</p>
      </div>
      <div className="rdl-source-grid">
        {RDL_SOURCES.map((source) => (
          <article className="rdl-source-card" key={source.key}>
            <div className="rdl-source-card-heading"><Database size={20} /><span className={`rdl-status-badge rdl-status-${source.status}`}>{source.status}</span></div>
            <h2>{source.name}</h2>
            <div className="rdl-source-version">Release {source.versionLabel}</div>
            <p>{source.description}</p>
            <Link to={`/search?source=${encodeURIComponent(source.key)}`} onClick={() => setScope(source.key)}>Search this RDL <ArrowRight size={16} /></Link>
          </article>
        ))}
      </div>
      <div className="rdl-provenance-note"><ShieldCheck size={19} /><div><strong>Source-aware by design</strong><p>Search results retain source, release, package and typed entity identity. Candidate extensions are never presented as part of the reviewed CFIHOS baseline.</p></div></div>
    </div>
  );
}
