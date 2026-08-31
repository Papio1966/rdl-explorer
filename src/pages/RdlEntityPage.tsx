import { ArrowLeft, Database, FileSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { entityTypeLabel, getDefaultReleaseKey, getRdlRelease, getRdlSource } from "../rdl/catalog";
import { loadRdlSearchIndex, type RdlSearchRecord } from "../rdl/search";

export function RdlEntityPage() {
  const { sourceKey, releaseKey: routeReleaseKey, entityType, nativeIdentifier } = useParams();
  const releaseKey = routeReleaseKey ?? getDefaultReleaseKey(sourceKey);
  const [record, setRecord] = useState<RdlSearchRecord | null | undefined>(undefined);
  useEffect(() => {
    loadRdlSearchIndex().then((records) => setRecord(records.find((item) => item.sourceKey === sourceKey && item.releaseKey === releaseKey && item.entityType === entityType && item.nativeIdentifier === nativeIdentifier) ?? null)).catch(() => setRecord(null));
  }, [sourceKey, releaseKey, entityType, nativeIdentifier]);
  const source = getRdlSource(sourceKey);
  const release = getRdlRelease(sourceKey, releaseKey);

  if (record === undefined) return <div className="content-page"><div role="status">Loading RDL entity…</div></div>;
  if (!record || !source || !release) return <div className="content-page"><div className="rdl-search-state"><strong>RDL entity not found in this release</strong><Link to="/search">Return to global search</Link></div></div>;

  return <div className="content-page rdl-entity-page">
    <Link className="rdl-back-link" to={`/search?source=${encodeURIComponent(record.sourceKey)}&release=${encodeURIComponent(record.releaseKey)}&q=${encodeURIComponent(record.nativeIdentifier)}`}><ArrowLeft size={16} />Back to search</Link>
    <div className="rdl-entity-hero">
      <div><div className="eyebrow">{entityTypeLabel(record.entityType)}</div><h1>{record.name || record.nativeIdentifier}</h1><code>{record.nativeIdentifier}</code></div>
      <div className="rdl-entity-source"><Database size={19} /><div><small>RDL SOURCE</small><strong>{source.name}</strong><span>{release.versionLabel} · {release.status}</span></div></div>
    </div>
    <div className="rdl-entity-layout">
      <section className="rdl-entity-panel"><h2>Definition</h2><p>{record.definition || "No definition is supplied for this source record."}</p></section>
      <aside className="rdl-entity-panel"><h2>Provenance</h2><dl><dt>Source</dt><dd>{record.sourceName}</dd><dt>Release</dt><dd>{record.versionLabel} · {record.releaseStatus}</dd><dt>Release key</dt><dd><code>{record.releaseKey}</code></dd><dt>Package</dt><dd><code>{record.packageKey}</code></dd><dt>Source sheet</dt><dd>{record.sourceSheet}</dd><dt>Entity type</dt><dd>{entityTypeLabel(record.entityType)}</dd></dl></aside>
    </div>
    <div className="rdl-provenance-note"><FileSearch size={19} /><div><strong>Release-isolated generic detail</strong><p>This page resolves the entity only inside the explicitly selected release. Historical and successor packages cannot silently leak into this view.</p></div></div>
  </div>;
}
