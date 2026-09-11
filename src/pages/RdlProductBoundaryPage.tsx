import { CIS_BOUNDARY_DECISION, MAPPING_GOVERNANCE_DECISIONS, ROUTE_WORKFLOW_GUIDES } from "../rdl/productBoundaryGuidance";

export function RdlProductBoundaryPage() {
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <p className="eyebrow">Product boundary</p>
        <h1>RDL Explorer and DataGate responsibilities</h1>
        <p>{CIS_BOUNDARY_DECISION.statement}</p>
      </header>

      <section className="panel-grid two-column">
        <article className="panel-card">
          <h2>RDL Explorer owns</h2>
          <ul>{CIS_BOUNDARY_DECISION.rdlExplorerOwns.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="panel-card">
          <h2>DataGate owns</h2>
          <ul>{CIS_BOUNDARY_DECISION.dataGateOwns.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </section>

      <section className="panel-card">
        <h2>CIS decision</h2>
        <p>
          Project CIS authoring, CIS preview, project tailoring, EPC validation, findings and resubmission workflows belong to DataGate.
          RDL Explorer may keep standards-reference information, but CIS execution is not a primary RDL Explorer capability.
        </p>
      </section>

      <section className="panel-card">
        <h2>Governance decision language</h2>
        <p>Mapping decisions should not be framed only as Approve, Reject or Supersede. Use decision language that explains the consequence before confirmation.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Decision</th><th>Meaning</th><th>Consequence</th></tr></thead>
            <tbody>
              {MAPPING_GOVERNANCE_DECISIONS.map((decision) => (
                <tr key={decision.action}><td>{decision.action}</td><td>{decision.meaning}</td><td>{decision.consequence}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-card">
        <h2>Guided screens</h2>
        <p>Operate and Govern screens show helper guidance describing purpose, workflow position, usage steps, decision semantics and consequences.</p>
        <ul>
          {ROUTE_WORKFLOW_GUIDES.map((entry) => <li key={entry.paths.join(",")}>{entry.guide.title}: {entry.paths.join(", ")}</li>)}
        </ul>
      </section>
    </div>
  );
}
