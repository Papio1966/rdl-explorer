import { Layers3 } from "lucide-react";
import { getRdlSource, RDL_SOURCES, type RdlScopeKey } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";

export function RdlScopeSelector({ mode = "scope" }: { mode?: "scope" | "filter" }) {
  const { scope, setScope, releaseKey, setReleaseKey } = useRdlScope();

  if (mode === "filter") {
    return (
      <label className="rdl-scope-selector rdl-scope-selector-filter" title="Enterprise workflow pages currently aggregate all loaded RDLs.">
        <Layers3 size={16} aria-hidden="true" />
        <span className="rdl-scope-copy"><small>RDL VIEW</small></span>
        <select aria-label="Enterprise workflow RDL view" value="all" disabled><option value="all">All RDLs</option></select>
      </label>
    );
  }

  const source = scope === "all" ? undefined : getRdlSource(scope);
  return (
    <div className="rdl-scope-selector-group">
      <label className="rdl-scope-selector rdl-scope-selector-scope">
        <Layers3 size={16} aria-hidden="true" />
        <span className="rdl-scope-copy"><small>RDL SCOPE</small></span>
        <select aria-label="Active RDL search scope" value={scope} onChange={(event) => setScope(event.target.value as RdlScopeKey)}>
          <option value="all">All current RDLs</option>
          {RDL_SOURCES.map((item) => <option value={item.key} key={item.key}>{item.shortName}</option>)}
        </select>
      </label>
      {source && releaseKey && (
        <label className="rdl-scope-selector rdl-release-selector">
          <span className="rdl-scope-copy"><small>RELEASE</small></span>
          <select aria-label="Active RDL release" value={releaseKey} onChange={(event) => setReleaseKey(event.target.value)}>
            {source.releases.map((release) => <option key={release.key} value={release.key}>{release.versionLabel} · {release.status}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
