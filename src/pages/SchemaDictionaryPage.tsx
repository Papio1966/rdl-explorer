import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, ShieldCheck } from "lucide-react";
import {
  loadRdlSchemaDictionary,
  type RdlSchemaDictionaryItem,
  type RdlSchemaDictionaryPayload,
} from "../rdl/schemaDictionary";
import "./SchemaDictionaryPage.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; payload: RdlSchemaDictionaryPayload };

export function SchemaDictionaryPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    loadRdlSchemaDictionary().then((payload) => {
      if (!active) return;
      setState({ status: "success", payload });
      setSelectedId(payload.items[0]?.schemaDefinitionId ?? null);
    }).catch((error) => {
      if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load schema dictionary." });
    });
    return () => { active = false; };
  }, []);

  const items = useMemo(() => {
    if (state.status !== "success") return [];
    const q = query.trim().toLowerCase();
    return state.payload.items.filter((item) => {
      if (kind && item.conceptKind !== kind) return false;
      if (!q) return true;
      return [item.nativeIdentifier, item.entityName, item.propertyName, item.entityAttributeName, item.definition, item.formatSpecification]
        .some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [state, query, kind]);

  const selected = items.find((item) => item.schemaDefinitionId === selectedId) ?? items[0] ?? null;

  if (state.status === "loading") return <main className="schema-dictionary-page"><p>Loading governed schema dictionary…</p></main>;
  if (state.status === "error") return <main className="schema-dictionary-page"><h1>Schema Dictionary</h1><p>{state.message}</p></main>;

  return (
    <main className="schema-dictionary-page">
      <header className="schema-dictionary-header">
        <div>
          <div className="schema-dictionary-eyebrow"><ShieldCheck size={15}/> Governed information model</div>
          <h1>Schema Dictionary</h1>
          <p>Information-model semantics are projected from immutable source records and remain separate from ordinary RDL reference entities.</p>
        </div>
        <div className="schema-dictionary-release">
          <strong>{state.payload.sourceName}</strong>
          <span>{state.payload.releaseKey} · {state.payload.packageKey}</span>
        </div>
      </header>

      <section className="schema-dictionary-controls" aria-label="Schema dictionary filters">
        <label><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schema concepts…" /></label>
        <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Concept kind">
          <option value="">All concepts</option>
          <option value="entity">Entities</option>
          <option value="attribute">Attributes</option>
          <option value="relationship">Relationships</option>
          <option value="constraint">Constraints</option>
          <option value="unknown">Unclassified</option>
        </select>
        <span>{items.length} of {state.payload.total}</span>
      </section>

      <div className="schema-dictionary-layout">
        <section className="schema-dictionary-list" aria-label="Schema concepts">
          {items.map((item) => (
            <button key={item.schemaDefinitionId} type="button" className={item.schemaDefinitionId === selected?.schemaDefinitionId ? "selected" : ""} onClick={() => setSelectedId(item.schemaDefinitionId)}>
              <BookOpen size={15}/>
              <span><strong>{displayName(item)}</strong><small>{item.conceptKind} · {item.nativeIdentifier}</small></span>
            </button>
          ))}
        </section>
        <section className="schema-dictionary-detail" aria-live="polite">
          {selected ? <SchemaDetail item={selected} /> : <p>No schema concept matches the current filters.</p>}
        </section>
      </div>
    </main>
  );
}

function displayName(item: RdlSchemaDictionaryItem) {
  return item.propertyName ?? item.entityAttributeName ?? item.entityName ?? item.nativeIdentifier;
}

function SchemaDetail({ item }: { item: RdlSchemaDictionaryItem }) {
  return <>
    <div className="schema-dictionary-eyebrow">{item.conceptKind}</div>
    <h2>{displayName(item)}</h2>
    <code>{item.nativeIdentifier}</code>
    {item.definition && <p className="schema-dictionary-definition">{item.definition}</p>}
    <dl>
      <Row label="Entity" value={item.entityName}/>
      <Row label="Property" value={item.propertyName}/>
      <Row label="Entity attribute" value={item.entityAttributeName}/>
      <Row label="Requirement" value={item.requirementStatus}/>
      <Row label="Data type hint" value={item.dataTypeHint}/>
      <Row label="Format" value={item.formatSpecification}/>
      <Row label="Presence constraint" value={item.presenceConstraint}/>
      <Row label="Relationship" value={item.relationshipVerb}/>
      <Row label="Source row" value={String(item.sourceRowNumber)}/>
      <Row label="Row SHA-256" value={item.rowSha256}/>
    </dl>
  </>;
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value ?? "Not specified"}</dd></div>;
}
