import { ArrowDown, Boxes, CheckCircle2, GitBranch, LockKeyhole, ShieldCheck } from "lucide-react";
import { ENTERPRISE_COMPOSITION_RULES, ENTERPRISE_LAYER_DEMO } from "../rdl/enterpriseHierarchy";

export function RdlHierarchyPage() {
  return <div className="content-page rdl-hierarchy-page">
    <div className="page-heading">
      <div><span className="eyebrow">Enterprise standards</span><h1>RDL hierarchy & effective context</h1></div>
      <p>Compose Industry, Company, Asset and Project/CIS layers without silently changing the upstream standard.</p>
    </div>

    <div className="rdl-intelligence-warning">
      <ShieldCheck size={20}/><div><strong>Governance boundary</strong><p>This page demonstrates the RDL-016 composition model. The Company, Asset and Project labels below are illustrative and are not presented as authoritative customer standards.</p></div>
    </div>

    <section className="rdl-hierarchy-section" aria-labelledby="hierarchy-heading">
      <h2 id="hierarchy-heading">Four-layer enterprise hierarchy</h2>
      <p className="rdl-intelligence-copy">Each lower layer inherits an exact upstream baseline and adds only explicit governed changes. An active Project/CIS context does not auto-migrate when an upstream standard changes.</p>
      <div className="rdl-hierarchy-stack">
        {ENTERPRISE_LAYER_DEMO.map((layer,index)=><div key={layer.level} className="rdl-hierarchy-stack-item">
          <article className="rdl-hierarchy-card">
            <div className="rdl-hierarchy-level">{layer.level}</div>
            <div className="rdl-hierarchy-card-copy"><small>{layer.subtitle}</small><h3>{layer.title}</h3><p>{layer.source}</p></div>
            <div className="rdl-hierarchy-status"><LockKeyhole size={14}/>{layer.status.replaceAll("-"," ")}</div>
            <ul>{layer.examples.map(item=><li key={item}>{item}</li>)}</ul>
          </article>
          {index<ENTERPRISE_LAYER_DEMO.length-1 && <ArrowDown className="rdl-hierarchy-arrow" aria-hidden="true"/>}
        </div>)}
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="composition-heading">
      <h2 id="composition-heading">Effective composition rules</h2>
      <div className="rdl-composition-rules">
        {ENTERPRISE_COMPOSITION_RULES.map((rule,index)=><div key={rule}><CheckCircle2 size={18}/><span><strong>{index+1}.</strong> {rule}</span></div>)}
      </div>
    </section>

    <section className="rdl-hierarchy-section" aria-labelledby="promotion-heading">
      <h2 id="promotion-heading">Extension lifecycle</h2>
      <div className="rdl-extension-flow" aria-label="Extension promotion flow">
        <span><GitBranch size={16}/>Project need</span><b>→</b><span><ShieldCheck size={16}/>Review & approve</span><b>→</b><span><Boxes size={16}/>Project extension</span><b>→</b><span>Optional promotion to Asset / Company / upstream</span>
      </div>
      <p className="rdl-intelligence-copy">Promotion creates a new governed layer/version. It does not rewrite the frozen package used by an active project.</p>
    </section>
  </div>;
}
