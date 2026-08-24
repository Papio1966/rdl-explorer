import { Link } from "react-router-dom";
import { ArrowRight, Bot, ClipboardList, Database, GitBranch, Mail, Search, ShieldCheck } from "lucide-react";
import "./AboutPage.css";

const PILOT_FEEDBACK_EMAIL = "alessandro@papioconsulting.eu";

const capabilities = [
  { icon: Search, title: "Explore CFIHOS", text: "Browse Tag Classes, Equipment Classes, Document Types, disciplines, lifecycle requirements, properties, standards and units of measure.", to: "/classes/tag", action: "Explore classes" },
  { icon: GitBranch, title: "Understand the model", text: "Follow class relationships, property provenance, document requirements and the reference-data structures that connect the CFIHOS model.", to: "/model", action: "Open Data Model" },
  { icon: ShieldCheck, title: "Validate the data", text: "Review validation evidence, upstream observations and reproducible diagnostics against the reviewed CFIHOS 2.0 source snapshot.", to: "/validation", action: "Open Validation" },
  { icon: ClipboardList, title: "Build a Contract Information Specification", text: "Define project scope, generate a locked CFIHOS baseline, review provenance, record Owner/Operator deviations and export an EPC-facing CIS.", to: "/cis", action: "Open CIS Builder" },
  { icon: Bot, title: "Ask the CFIHOS Assistant", text: "Ask grounded questions about CFIHOS and the Explorer. Retrieved evidence remains visible so AI-interpreted answers can be verified.", to: "/assistant", action: "Open AI Assistant" },
  { icon: Database, title: "Trace the evidence", text: "Keep CFIHOS identifiers, source standards, requirement mappings and provenance visible as you move from reference data to contractual decisions.", to: "/standards", action: "Browse standards" },
];

export function AboutPage() {
  return (
    <div className="about-page help-doc-page">
      <section className="help-hero">
        <div className="help-eyebrow">ABOUT THE APPLICATION</div>
        <h1>About RDL Explorer</h1>
        <p className="help-lead">RDL Explorer is the multi-RDL platform that starts with the proven CFIHOS 2.0 Explorer experience. In this bootstrap release, CFIHOS remains the only active RDL source while the product boundary is prepared for future RDL packages, provenance, versioning and database-backed services.</p>
        <div className="about-flow" aria-label="Explorer workflow"><span>Explore</span><ArrowRight size={16} /><span>Understand</span><ArrowRight size={16} /><span>Validate</span><ArrowRight size={16} /><span>Build CIS</span><ArrowRight size={16} /><span>Ask AI</span></div>
      </section>

      <section className="pilot-notice" aria-labelledby="pilot-status-heading">
        <div><div className="help-eyebrow">PILOT STATUS</div><h2 id="pilot-status-heading">Built for controlled evaluation</h2></div>
        <div className="pilot-notice-copy">
          <p>This deployment is the RDL Explorer bootstrap pilot, using CFIHOS 2.0 as its initial reference RDL. It is intended for demonstration, evaluation and structured user feedback rather than production or contractual reliance.</p>
          <p>The application uses a reviewed CFIHOS 2.0 workbook snapshot committed with the application. CFIHOS identifiers and provenance are retained so users can trace results back to the reference data.</p>
          <a href={`mailto:${PILOT_FEEDBACK_EMAIL}?subject=RDL%20Explorer%20pilot%20feedback`}><Mail size={16} />Send pilot feedback</a>
        </div>
      </section>

      <section className="help-section">
        <div className="help-section-heading"><div className="help-eyebrow">WHAT IT DOES</div><h2>One workspace from reference data to contract requirements</h2><p>The Explorer keeps the CFIHOS evidence visible while adding practical workflows around it.</p></div>
        <div className="about-capability-grid">
          {capabilities.map(({ icon: Icon, title, text, to, action }) => <article className="about-capability-card" key={title}><div className="about-icon"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p><Link to={to}>{action} <ArrowRight size={15} /></Link></article>)}
        </div>
      </section>

      <section className="help-section about-principles">
        <div className="help-section-heading"><div className="help-eyebrow">DESIGN PRINCIPLES</div><h2>Traceable by design</h2></div>
        <div className="about-principle-grid"><div><strong>CFIHOS first</strong><p>Reference-data identities and provenance are retained rather than hidden behind application logic.</p></div><div><strong>Baseline stays visible</strong><p>The CIS Builder separates the CFIHOS baseline from deliberate Owner/Operator contractual deviations.</p></div><div><strong>AI is grounded</strong><p>The Assistant retrieves CFIHOS or Explorer capability evidence before generative synthesis and shows that evidence for verification.</p></div></div>
      </section>

      <section className="help-section about-principles">
        <div className="help-section-heading"><div className="help-eyebrow">AI & DATA BOUNDARY</div><h2>Know what the Assistant is doing</h2></div>
        <div className="about-principle-grid"><div><strong>Evidence before generation</strong><p>The browser retrieves bounded CFIHOS/Explorer evidence and sends the question plus that evidence to the server-side Assistant endpoint.</p></div><div><strong>No browser API key</strong><p>The OpenAI credential remains server-side. The model is not given direct access to the raw workbook or to the public web.</p></div><div><strong>Verify important answers</strong><p>AI-generated interpretation can be wrong. Use the visible evidence cards and CFIHOS source identifiers before relying on an answer.</p></div></div>
      </section>

      <section className="about-next-card"><div><div className="help-eyebrow">NEW TO THE EXPLORER?</div><h2>Start with the User Guide</h2><p>Learn the navigation, current search limitations, major pages and common end-to-end workflows.</p></div><Link className="help-primary-link" to="/help">Open User Guide <ArrowRight size={16} /></Link></section>
    </div>
  );
}
