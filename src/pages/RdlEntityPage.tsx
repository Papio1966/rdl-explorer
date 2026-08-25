import { ArrowLeft, Database, FileSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { entityTypeLabel, getRdlSource } from "../rdl/catalog";
import { loadRdlSearchIndex, type RdlSearchRecord } from "../rdl/search";

export function RdlEntityPage() {
  const { sourceKey, entityType, nativeIdentifier } = useParams();
  const [record, setRecord] = useState<RdlSearchRecord | null | undefined>(undefined);
  useEffect(() => {
    loadRdlSearchIndex().then((records) => setRecord(records.find((item) => item.sourceKey === sourceKey && item.entityType === entityType && item.nativeIdentifier === nativeIdentifier) ?? null)).catch(() => setRecord(null));
  }, [sourceKey, entityType, nativeIdentifier]);
  const source = getRdlSource(sourceKey);

  if (record === undefined) return <div className="content-page"><div role="status">Loading RDL entity…</div></div>;
  if (!record || !source) return <div className="content-page"><div className="rdl-search-state"><strong>RDL entity not found</strong><Link to="/search">Return to global search</Link></div></div>;

  return <div className="content-page rdl-entity-page">
    <Link className="rdl-back-link" to={`/search?source=${encodeURIComponent(record.sourceKey)}&q=${encodeURIComponent(record.nativeIdentifier)}`}><ArrowLeft size={16} />Back to search</Link>
    <div className="rdl-entity-hero">
      <div><div className="eyebrow">{entityTypeLabel(record.entityType)}</div><h1>{record.name || record.nativeIdentifier}</h1><code>{record.nativeIdentifier}</code></div>
      <div className="rdl-entity-source"><Database size={19} /><div><small>RDL SOURCE</small><strong>{source.name}</strong><span>{source.versionLabel} · {source.status}</span></div></div>
    </div>
    <div className="rdl-entity-layout">
      <section className="rdl-entity-panel"><h2>Definition</h2><p>{record.definition || "No definition is supplied for this source record."}</p></section>
      <aside className="rdl-entity-panel"><h2>Provenance</h2><dl><dt>Source</dt><dd>{record.sourceName}</dd><dt>Release</dt><dd>{record.versionLabel}</dd><dt>Package</dt><dd><code>{record.packageKey}</code></dd><dt>Source sheet</dt><dd>{record.sourceSheet}</dd><dt>Entity type</dt><dd>{entityTypeLabel(record.entityType)}</dd></dl></aside>
    </div>
    <div className="rdl-provenance-note"><FileSearch size={19} /><div><strong>RDL-009 generic detail</strong><p>This package-aware view provides safe navigation for all loaded RDLs. Deep CFIHOS relationship views remain available in the existing specialist Explorer pages.</p></div></div>
  </div>;
}
