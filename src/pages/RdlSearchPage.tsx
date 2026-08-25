import { Database, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { entityTypeLabel, getRdlSource, rdlEntityRoute, RDL_SOURCES, type RdlScopeKey } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";
import { loadRdlSearchIndex, searchRdlRecords, type RdlSearchRecord } from "../rdl/search";

export function RdlSearchPage() {
  const [params, setParams] = useSearchParams();
  const { scope, setScope } = useRdlScope();
  const [index, setIndex] = useState<RdlSearchRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const query = params.get("q") ?? "";
  const requestedSource = params.get("source") ?? scope;
  const source: RdlScopeKey = requestedSource === "all" || RDL_SOURCES.some((item) => item.key === requestedSource) ? requestedSource as RdlScopeKey : "all";

  useEffect(() => {
    loadRdlSearchIndex().then((records) => { setIndex(records); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(() => { setScope(source); }, [setScope, source]);

  const results = useMemo(() => searchRdlRecords(index, query, source), [index, query, source]);

  function search(value: string) {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value.trim()); else next.delete("q");
    next.set("source", source);
    setParams(next);
  }

  return (
    <div className="content-page rdl-search-page">
      <div className="page-heading"><div><div className="eyebrow">Global search</div><h1>Search across RDLs</h1></div><p>Results are package-aware and preserve their source, release and entity type.</p></div>
      <form className="rdl-search-form" onSubmit={(event) => { event.preventDefault(); search(new FormData(event.currentTarget).get("q")?.toString() ?? ""); }}>
        <Search size={19} /><input name="q" type="search" defaultValue={query} placeholder="Class, property, document, identifier…" aria-label="Global RDL search query" /><button type="submit">Search</button>
      </form>
      <div className="rdl-search-toolbar">
        <label>Source <select value={source} onChange={(event) => { const next = new URLSearchParams(params); next.set("source", event.target.value); setParams(next); }}><option value="all">All RDLs</option>{RDL_SOURCES.map((item) => <option value={item.key} key={item.key}>{item.shortName}</option>)}</select></label>
        {state === "ready" && query && <span>{results.length} result{results.length === 1 ? "" : "s"}{results.length === 80 ? " (first 80)" : ""}</span>}
      </div>
      {state === "loading" && <div className="rdl-search-state" role="status">Loading RDL search index…</div>}
      {state === "error" && <div className="rdl-search-state" role="alert">The RDL search index could not be loaded.</div>}
      {state === "ready" && !query && <div className="rdl-search-state"><Search size={24} /><strong>Search the loaded libraries</strong><span>Try a class name, property, document type or native identifier.</span></div>}
      {state === "ready" && query && !results.length && <div className="rdl-search-state"><strong>No matching RDL entities</strong><span>Try a broader term or switch the source scope.</span></div>}
      <div className="rdl-search-results">
        {results.map((result) => {
          const sourceDefinition = getRdlSource(result.sourceKey);
          return <Link className="rdl-search-result" key={`${result.packageKey}:${result.entityType}:${result.nativeIdentifier}`} to={rdlEntityRoute(result.sourceKey, result.entityType, result.nativeIdentifier)}>
            <div className="rdl-search-result-top"><span className="rdl-entity-type">{entityTypeLabel(result.entityType)}</span><span className="rdl-source-badge"><Database size={13} />{sourceDefinition?.shortName ?? result.sourceName} · {result.versionLabel}</span></div>
            <h2>{result.name || result.nativeIdentifier}</h2><code>{result.nativeIdentifier}</code>
            {result.definition && <p>{result.definition}</p>}
          </Link>;
        })}
      </div>
    </div>
  );
}
