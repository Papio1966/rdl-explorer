import { Boxes, BookOpen, Database, FileText, GitBranch, Layers3, ListChecks, Ruler, Shapes, Tags, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDefaultReleaseKey, getRdlRelease, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import { loadRdlRelationshipIndex, type RdlRelationshipIndexRecord } from "../rdl/entityDetail";
import { useRdlScope } from "../rdl/rdlScopeContextValue";
import { loadRdlSearchIndex, type RdlSearchRecord } from "../rdl/search";
import "./RdlSelectedDataModelPage.css";

const MODEL_ENTITIES = [
  { type: "tag_class", label: "Tag Classes", icon: Tags },
  { type: "equipment_class", label: "Equipment Classes", icon: Boxes },
  { type: "property", label: "Properties", icon: BookOpen },
  { type: "controlled_value", label: "Controlled Values", icon: ListChecks },
  { type: "discipline", label: "Disciplines", icon: Shapes },
  { type: "document_type", label: "Document Types", icon: FileText },
  { type: "source_standard", label: "Source Standards", icon: Database },
  { type: "unit_of_measure", label: "Units of Measure", icon: Ruler },
  { type: "handover_event", label: "Lifecycle Events", icon: Workflow },
  { type: "information_requirement", label: "Information Requirements", icon: Layers3 },
] as const;

type ModelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; sourceKey: string; releaseKey: string; entities: RdlSearchRecord[]; relationships: RdlRelationshipIndexRecord[] };

export function RdlSelectedDataModelPage() {
  const { scope, releaseKey } = useRdlScope();
  const selectedReleaseKey = scope === "all" ? null : releaseKey ?? getDefaultReleaseKey(scope) ?? null;
  const [state, setState] = useState<ModelState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    if (scope === "all" || !selectedReleaseKey) {
      setState({ status: "error", message: "Select an RDL source and release to view its data model." });
      return () => { active = false; };
    }

    setState({ status: "loading" });
    Promise.all([loadRdlSearchIndex(), loadRdlRelationshipIndex()])
      .then(([allEntities, allRelationships]) => {
        if (!active) return;
        const entities = allEntities.filter((item) => item.sourceKey === scope && item.releaseKey === selectedReleaseKey);
        const packageKeys = new Set(entities.map((item) => item.packageKey));
        const relationships = allRelationships.filter((item) =>
          item.sourceKey === scope && item.releaseKey === selectedReleaseKey && packageKeys.has(item.packageKey),
        );
        setState({ status: "success", sourceKey: scope, releaseKey: selectedReleaseKey, entities, relationships });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load the selected release data model." });
      });

    return () => { active = false; };
  }, [scope, selectedReleaseKey]);

  const entities = state.status === "success" && state.sourceKey === scope && state.releaseKey === selectedReleaseKey ? state.entities : [];
  const relationships = state.status === "success" && state.sourceKey === scope && state.releaseKey === selectedReleaseKey ? state.relationships : [];
  const entityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of entities) counts.set(entity.entityType, (counts.get(entity.entityType) ?? 0) + 1);
    return counts;
  }, [entities]);
  const examples = useMemo(() => {
    const first = new Map<string, RdlSearchRecord>();
    for (const entity of entities) if (!first.has(entity.entityType)) first.set(entity.entityType, entity);
    return first;
  }, [entities]);
  const relationshipRows = useMemo(() => {
    const groups = new Map<string, { from: string; type: string; to: string; count: number }>();
    for (const row of relationships) {
      const key = `${row.sourceEntityType}\u0000${row.relationshipType}\u0000${row.targetEntityType}`;
      const group = groups.get(key) ?? { from: row.sourceEntityType, type: row.relationshipType, to: row.targetEntityType, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.from.localeCompare(b.from) || a.type.localeCompare(b.type) || a.to.localeCompare(b.to));
  }, [relationships]);

  if (scope === "all") {
    return <ModelMessage title="Select an RDL source" message="The Data Model is release-specific. Select a standard and release in the scope selector to view its entities and relationships." />;
  }
  if (!selectedReleaseKey) {
    return <ModelMessage title="No release selected" message="Choose a release for the selected standard to view its data model." />;
  }
  if (state.status === "loading" || (state.status === "success" && (state.sourceKey !== scope || state.releaseKey !== selectedReleaseKey))) {
    return <ModelMessage title="Loading Data Model" message={`Loading ${getRdlSource(scope)?.name ?? scope} ${getRdlRelease(scope, selectedReleaseKey)?.versionLabel ?? selectedReleaseKey}…`} />;
  }
  if (state.status === "error") return <ModelMessage title="Unable to load Data Model" message={state.message} />;

  const source = getRdlSource(scope);
  const release = getRdlRelease(scope, selectedReleaseKey);
  const totalEntities = entities.length;
  const typeCount = MODEL_ENTITIES.filter((item) => (entityCounts.get(item.type) ?? 0) > 0).length;

  return (
    <main className="selected-data-model">
      <div className="selected-data-model-inner">
        <header className="selected-data-model-header">
          <div className="selected-data-model-eyebrow">Data Model · {source?.shortName ?? scope}</div>
          <h1>{source?.name ?? scope} Information Model</h1>
          <p>Entities and relationships in the selected release. The model structure is shared across standards; its relationship set and counts reflect this release.</p>
          <div className="selected-data-model-release"><GitBranch size={16} />{release?.versionLabel ?? selectedReleaseKey} · {release?.status ?? "selected release"}</div>
        </header>

        <section className="selected-data-model-summary" aria-label="Model summary">
          <SummaryMetric label="Entities" value={totalEntities} />
          <SummaryMetric label="Entity types present" value={typeCount} />
          <SummaryMetric label="Relationships" value={relationships.length} />
          <SummaryMetric label="Relationship patterns" value={relationshipRows.length} />
        </section>

        <section className="selected-data-model-section">
          <div className="selected-data-model-section-heading"><span>Shared structure</span><h2>Entity types</h2><p>Each count comes from the selected source and release. A card links to an example entity in that release.</p></div>
          <div className="selected-data-model-entity-grid">
            {MODEL_ENTITIES.map(({ type, label, icon: Icon }) => {
              const example = examples.get(type);
              const count = entityCounts.get(type) ?? 0;
              const card = <><div className="selected-data-model-card-top"><Icon size={19} /><strong>{count}</strong></div><h3>{label}</h3><span>{count === 1 ? "1 entity" : `${count} entities`}</span><small>{example ? "Open an example" : "No records in this release"}</small></>;
              return example ? (
                <Link className="selected-data-model-entity-card" key={type} to={rdlEntityRoute(scope, selectedReleaseKey, type, example.nativeIdentifier)}>{card}</Link>
              ) : (
                <div className="selected-data-model-entity-card selected-data-model-entity-card-empty" key={type}>{card}</div>
              );
            })}
          </div>
        </section>

        <section className="selected-data-model-section">
          <div className="selected-data-model-section-heading"><span>Release-specific structure</span><h2>Relationships</h2><p>Relationship patterns and counts are read from this release’s indexed data. No CFIHOS fallback is used.</p></div>
          {relationshipRows.length ? (
            <div className="selected-data-model-table-scroll"><table className="selected-data-model-table"><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Records</th></tr></thead><tbody>
              {relationshipRows.map((row) => <tr key={`${row.from}|${row.type}|${row.to}`}><td>{humanize(row.from)}</td><td>{humanize(row.type)}</td><td>{humanize(row.to)}</td><td>{row.count.toLocaleString()}</td></tr>)}
            </tbody></table></div>
          ) : <p className="selected-data-model-empty">No relationships are indexed for this release.</p>}
        </section>
      </div>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div className="selected-data-model-metric"><strong>{value.toLocaleString()}</strong><span>{label}</span></div>;
}

function ModelMessage({ title, message }: { title: string; message: string }) {
  return <main className="selected-data-model"><div className="selected-data-model-inner"><section className="selected-data-model-message" role="status"><h1>{title}</h1><p>{message}</p></section></div></main>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
