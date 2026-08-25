import { Layers3 } from "lucide-react";
import { RDL_SOURCES, type RdlScopeKey } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";

export function RdlScopeSelector() {
  const { scope, setScope } = useRdlScope();
  return (
    <label className="rdl-scope-selector">
      <Layers3 size={16} aria-hidden="true" />
      <span className="rdl-scope-copy"><small>RDL SCOPE</small></span>
      <select aria-label="Active RDL search scope" value={scope} onChange={(event) => setScope(event.target.value as RdlScopeKey)}>
        <option value="all">All RDLs</option>
        {RDL_SOURCES.map((source) => <option value={source.key} key={source.key}>{source.shortName} {source.versionLabel}</option>)}
      </select>
    </label>
  );
}
