import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getRdlRelease, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";
import { loadRdlSearchIndex, type RdlSearchRecord } from "../rdl/search";
import { RdlReleaseAwareBrowse } from "./RdlReleaseAwareBrowse";

type Props = { children?: ReactNode; entityType?: string; title: string; specialized?: boolean };

const SHARED_BROWSE_ENTITY_TYPES = new Set(["tag_class", "equipment_class", "document_type", "property", "source_standard", "discipline", "unit_of_measure"]);

export function RdlScopedLegacyGuard({ children, entityType, title, specialized = false }: Props) {
  const { scope, releaseKey } = useRdlScope();
  const usesSharedBrowse = !specialized && Boolean(entityType && SHARED_BROWSE_ENTITY_TYPES.has(entityType));
  const [records, setRecords] = useState<RdlSearchRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (scope === "cfihos" || scope === "all" || usesSharedBrowse) return;
    let active = true;
    setRecords(null);
    setFailed(false);
    loadRdlSearchIndex()
      .then((items) => active && setRecords(items.filter((item) => item.sourceKey === scope && item.releaseKey === releaseKey && (!entityType || item.entityType === entityType))))
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [scope, releaseKey, entityType, usesSharedBrowse]);

  if (scope === "all") {
    return (
      <div className="content-page rdl-scope-guard-page">
        <section className="enterprise-section-card rdl-scope-empty">
          <h2>Select an RDL source</h2>
          <p>{title} browsing is release-specific. Select an RDL source and release before browsing this vocabulary. Cross-source discovery remains available through global search.</p>
          <Link className="enterprise-link-button" to="/rdls">Open RDL Catalogue</Link>
        </section>
      </div>
    );
  }

  const source = getRdlSource(scope);
  const release = getRdlRelease(scope, releaseKey ?? undefined);

  if (usesSharedBrowse && entityType) {
    if (!releaseKey) {
      return (
        <div className="content-page rdl-scope-guard-page">
          <section className="enterprise-section-card rdl-scope-empty">
            <h2>No release selected</h2>
            <p>Select an explicit RDL release before browsing {title.toLocaleLowerCase()}.</p>
          </section>
        </div>
      );
    }
    return (
      <RdlReleaseAwareBrowse
        key={`${scope}:${releaseKey}:${entityType}`}
        sourceKey={scope}
        releaseKey={releaseKey}
        entityType={entityType}
        title={title}
      />
    );
  }

  // Non-shared CFIHOS specialist capabilities remain available until separately converged.
  if (scope === "cfihos") return <>{children}</>;

  return (
    <div className="content-page rdl-scope-guard-page">
      <header className="page-heading">
        <div><span className="eyebrow">Selected RDL · {source?.shortName ?? scope}</span><h1>{title}</h1></div>
        <p>Content is restricted to the active RDL release. CFIHOS data is never used as a silent fallback.</p>
      </header>
      <div className="rdl-scope-integrity-banner" role="status">
        <strong>{source?.name ?? scope}</strong><span>{release?.versionLabel ?? releaseKey} · {release?.status ?? "selected release"}</span>
      </div>
      {specialized ? (
        <section className="enterprise-section-card rdl-scope-empty">
          <h2>This specialized view is not available for the selected RDL</h2>
          <p>{title} currently depends on CFIHOS-specific relationship structures. RDL Explorer will not substitute CFIHOS content while {source?.shortName} is selected.</p>
          <Link className="enterprise-link-button" to="/rdls">Open RDL Catalogue</Link>
        </section>
      ) : failed ? (
        <section className="enterprise-section-card rdl-scope-empty"><h2>Unable to load selected RDL release</h2><p>The release-aware search index could not be loaded. No fallback data has been displayed.</p></section>
      ) : records === null ? (
        <div className="rdl-search-state">Loading {source?.shortName} {release?.versionLabel}…</div>
      ) : records.length ? (
        <section className="enterprise-section-card">
          <div className="enterprise-section-heading"><div><h2>{records.length} entities in {source?.shortName} {release?.versionLabel}</h2><p>Package-native identifiers and release provenance are preserved.</p></div></div>
          <div className="rdl-scoped-record-grid">
            {records.slice(0, 250).map((record) => <Link className="rdl-scoped-record" key={`${record.releaseKey}-${record.entityType}-${record.nativeIdentifier}`} to={rdlEntityRoute(record.sourceKey, record.releaseKey, record.entityType, record.nativeIdentifier)}><span>{record.name}</span><code>{record.nativeIdentifier}</code><small>{record.definition || record.sourceSheet}</small></Link>)}
          </div>
          {records.length > 250 && <p className="rdl-intelligence-copy">Showing the first 250 records. Use global search to narrow the selected release.</p>}
        </section>
      ) : (
        <section className="enterprise-section-card rdl-scope-empty"><h2>No {title.toLowerCase()} in {source?.shortName} {release?.versionLabel}</h2><p>The selected release contains no records of this type. CFIHOS content has intentionally not been substituted.</p></section>
      )}
    </div>
  );
}
