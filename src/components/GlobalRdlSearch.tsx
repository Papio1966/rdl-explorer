import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useRdlScope } from "../rdl/RdlScopeContext";

export function GlobalRdlSearch() {
  const navigate = useNavigate();
  const { scope, releaseKey } = useRdlScope();
  const [query, setQuery] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault(); const trimmed=query.trim(); if(!trimmed)return;
    const params = new URLSearchParams({ q: trimmed, source: scope });
    if (releaseKey) params.set("release", releaseKey);
    navigate(`/search?${params.toString()}`);
  }
  return <form className="global-search" role="search" aria-label="Global RDL search" onSubmit={submit}><Search size={18} aria-hidden="true"/><input value={query} onChange={(event)=>setQuery(event.target.value)} type="search" placeholder="Search all loaded RDLs" aria-label="Search RDL classes, properties, documents and reference data"/><button type="submit" disabled={!query.trim()}>Search</button></form>;
}
