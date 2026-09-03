import { Database, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { entityTypeLabel, getDefaultReleaseKey, getRdlRelease, getRdlSource, rdlEntityRoute, RDL_SOURCES, type RdlScopeKey } from "../rdl/catalog";
import { useRdlScope } from "../rdl/RdlScopeContext";
import { loadRdlGlobalSearchRuntime } from "../rdl/runtimeSearch";
import type { RdlSearchRecord } from "../rdl/search";

export function RdlSearchPage() {
  const [params, setParams] = useSearchParams();
  const { scope, setScope, releaseKey: contextReleaseKey, setReleaseKey } = useRdlScope();
  const [results, setResults] = useState<RdlSearchRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("ready");
  const query = params.get("q") ?? "";
  const requestedSource = params.get("source") ?? scope;
  const source: RdlScopeKey = requestedSource === "all" || RDL_SOURCES.some((item) => item.key === requestedSource) ? requestedSource as RdlScopeKey : "all";
  const sourceDefinition = source === "all" ? undefined : getRdlSource(source);
  const requestedRelease = params.get("release");
  const releaseKey = source === "all" ? null : (
    getRdlRelease(source, requestedRelease ?? undefined)?.key ??
    getRdlRelease(source, contextReleaseKey ?? undefined)?.key ??
    getDefaultReleaseKey(source) ?? null
  );

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      setState("ready");
      return () => { active = false; };
    }
    setState("loading");
    loadRdlGlobalSearchRuntime({ query, source, releaseKey })
      .then((runtime) => {
        if (!active) return;
        setResults(runtime.results);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        setResults([]);
        setState("error");
      });
    return () => { active = false; };
  }, [query, source, releaseKey]);

  useEffect(() => {
    setScope(source);
    if (source !== "all" && releaseKey) setReleaseKey(releaseKey);
  }, [setScope, setReleaseKey, source, releaseKey]);

  function search(value: string) {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value.trim()); else next.delete("q");
    next.set("source", source);
    if (releaseKey) next.set("release", releaseKey); else next.delete("release");
    setParams(next);
  }

  function changeSource(nextSource: string) {
    const next = new URLSearchParams(params);
    next.set("source", nextSource);
    if (nextSource === "all") next.delete("release");
    else next.set("release", getDefaultReleaseKey(nextSource) ?? "");
    setParams(next);
  }

  return (
    <div className="content-page rdl-search-page">
      <div className="page-heading"><div><div className="eyebrow">Global search</div><h1>Search across RDLs</h1></div><p>Results are release-aware and preserve source, release, package and entity identity.</p></div>
      <form className="rdl-search-form" onSubmit={(event) => { event.preventDefault(); search(new FormData(event.currentTarget).get("q")?.toString() ?? ""); }}>
        <Search size={19} /><input name="q" type="search" defaultValue={query} placeholder="Class, property, document, identifier…" aria-label="Global RDL search query" /><button type="submit">Search</button>
      </form>
      <div className="rdl-search-toolbar">
        <label>Source <select aria-label="Source" value={source} onChange={(event) => changeSource(event.target.value)}><option value="all">All current RDLs</option>{RDL_SOURCES.map((item) => <option value={item.key} key={item.key}>{item.shortName}</option>)}</select></label>
        {sourceDefinition && releaseKey && <label>Release <select aria-label="Release" value={releaseKey} onChange={(event) => { const next = new URLSearchParams(params); next.set("release", event.target.value); setParams(next); }}>{sourceDefinition.releases.map((release) => <option key={release.key} value={release.key}>{release.versionLabel} · {release.status}</option>)}</select></label>}
        {state === "ready" && query && <span>{results.length} result{results.length === 1 ? "" : "s"}{results.length === 80 ? " (first 80)" : ""}</span>}
      </div>
      {state === "loading" && <div className="rdl-search-state" role="status">Searching RDL libraries…</div>}
      {state === "error" && <div className="rdl-search-state" role="alert">The RDL runtime search could not be loaded.</div>}
      {state === "ready" && !query && <div className="rdl-search-state"><Search size={24} /><strong>Search the loaded libraries</strong><span>Choose a source and release, then search by engineering name or native identifier.</span></div>}
      {state === "ready" && query && !results.length && <div className="rdl-search-state"><strong>No matching RDL entities</strong><span>Try a broader term, release or source scope.</span></div>}
      <div className="rdl-search-results">
        {results.map((result) => {
          const sourceInfo = getRdlSource(result.sourceKey);
          return <Link className="rdl-search-result" key={`${result.packageKey}:${result.entityType}:${result.nativeIdentifier}`} to={rdlEntityRoute(result.sourceKey, result.releaseKey, result.entityType, result.nativeIdentifier)}>
            <div className="rdl-search-result-top"><span className="rdl-entity-type">{entityTypeLabel(result.entityType)}</span><span className="rdl-source-badge"><Database size={13} />{sourceInfo?.shortName ?? result.sourceName} · {result.versionLabel} · {result.releaseStatus}</span></div>
            <h2>{result.name || result.nativeIdentifier}</h2><code>{result.nativeIdentifier}</code>
            {result.definition && <p>{result.definition}</p>}
          </Link>;
        })}
      </div>
    </div>
  );
}
