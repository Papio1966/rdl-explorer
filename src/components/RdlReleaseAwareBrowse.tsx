import {
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Database,
  FileText,
  LoaderCircle,
  Ruler,
  Search,
  Shapes,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRdlRelease, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import {
  loadRdlRelationshipIndex,
  type RdlRelationshipIndexRecord,
} from "../rdl/entityDetail";
import {
  loadRdlSearchIndex,
  recordMatchesRdlQuery,
  type RdlBrowseFacetValue,
  type RdlSearchRecord,
} from "../rdl/search";
import "./RdlReleaseAwareBrowse.css";

type Props = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  title: string;
};

type BrowseNode = {
  record: RdlSearchRecord;
  children: BrowseNode[];
};

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      records: RdlSearchRecord[];
      relationships: RdlRelationshipIndexRecord[];
    }
  | { status: "error"; message: string };

type BrowsePresentation = {
  eyebrow: string;
  singularTitle: string;
  searchLabel: string;
  icon: ReactNode;
};

type FacetOption = RdlBrowseFacetValue & { count: number };
type FacetDefinition = {
  key: string;
  label: string;
  options: FacetOption[];
};

function presentationFor(entityType: string, title: string): BrowsePresentation {
  switch (entityType) {
    case "tag_class":
      return { eyebrow: "Classes", singularTitle: "Tag Class", searchLabel: "tag classes", icon: <Tags size={28} /> };
    case "equipment_class":
      return { eyebrow: "Classes", singularTitle: "Equipment Class", searchLabel: "equipment classes", icon: <Boxes size={28} /> };
    case "document_type":
      return { eyebrow: "Information", singularTitle: "Document Type", searchLabel: "document types", icon: <FileText size={28} /> };
    case "property":
      return { eyebrow: "Reference", singularTitle: "Property", searchLabel: "properties", icon: <BookOpen size={28} /> };
    case "source_standard":
      return { eyebrow: "Reference", singularTitle: "Source Standard", searchLabel: "source standards", icon: <Database size={28} /> };
    case "discipline":
      return { eyebrow: "Information", singularTitle: "Discipline", searchLabel: "disciplines", icon: <Shapes size={28} /> };
    case "unit_of_measure":
      return { eyebrow: "Reference", singularTitle: "Unit of Measure", searchLabel: "units of measure", icon: <Ruler size={28} /> };
    default:
      return {
        eyebrow: "Reference",
        singularTitle: title.endsWith("s") ? title.slice(0, -1) : title,
        searchLabel: title.toLocaleLowerCase(),
        icon: <BookOpen size={28} />,
      };
  }
}

function compareRecords(a: RdlSearchRecord, b: RdlSearchRecord) {
  return (
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
    a.nativeIdentifier.localeCompare(b.nativeIdentifier)
  );
}

function buildHierarchy(
  records: RdlSearchRecord[],
  relationships: RdlRelationshipIndexRecord[],
): { roots: BrowseNode[]; hierarchyRelationshipCount: number } {
  const recordsById = new Map(records.map((record) => [record.nativeIdentifier, record]));
  const childrenByParent = new Map<string, string[]>();
  const parentByChild = new Map<string, string>();

  const hierarchyRows = relationships.filter(
    (relationship) =>
      relationship.relationshipType === "entity_parent" &&
      relationship.sourceEntityType === records[0]?.entityType &&
      relationship.targetEntityType === records[0]?.entityType &&
      recordsById.has(relationship.sourceNativeIdentifier) &&
      recordsById.has(relationship.targetNativeIdentifier),
  );

  for (const relationship of hierarchyRows) {
    const childId = relationship.sourceNativeIdentifier;
    const parentId = relationship.targetNativeIdentifier;
    if (childId === parentId || parentByChild.has(childId)) continue;
    parentByChild.set(childId, parentId);
    const children = childrenByParent.get(parentId) ?? [];
    children.push(childId);
    childrenByParent.set(parentId, children);
  }

  const visited = new Set<string>();
  const buildNode = (record: RdlSearchRecord, lineage: Set<string>): BrowseNode => {
    if (lineage.has(record.nativeIdentifier)) return { record, children: [] };
    const nextLineage = new Set(lineage);
    nextLineage.add(record.nativeIdentifier);
    visited.add(record.nativeIdentifier);
    const children = (childrenByParent.get(record.nativeIdentifier) ?? [])
      .map((id) => recordsById.get(id))
      .filter((item): item is RdlSearchRecord => Boolean(item))
      .sort(compareRecords)
      .map((child) => buildNode(child, nextLineage));
    return { record, children };
  };

  const rootRecords = records
    .filter((record) => !parentByChild.has(record.nativeIdentifier))
    .sort(compareRecords);

  const roots = rootRecords.map((record) => buildNode(record, new Set()));

  // Malformed or cyclic source hierarchy must never hide entities. Any entity that
  // could not be reached from an authoritative root is shown as a safe flat root.
  for (const record of [...records].sort(compareRecords)) {
    if (!visited.has(record.nativeIdentifier)) roots.push({ record, children: [] });
  }

  return { roots, hierarchyRelationshipCount: hierarchyRows.length };
}

function facetLabel(key: string): string {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function buildFacetDefinitions(records: RdlSearchRecord[]): FacetDefinition[] {
  const facets = new Map<string, Map<string, FacetOption>>();

  for (const record of records) {
    for (const [key, facet] of Object.entries(record.facets ?? {})) {
      if (!facet.value.trim()) continue;
      const options = facets.get(key) ?? new Map<string, FacetOption>();
      const existing = options.get(facet.value);
      if (existing) {
        existing.count += 1;
        if (!existing.label && facet.label) existing.label = facet.label;
      } else {
        options.set(facet.value, { ...facet, count: 1 });
      }
      facets.set(key, options);
    }
  }

  return [...facets.entries()]
    .map(([key, options]) => ({
      key,
      label: facetLabel(key),
      options: [...options.values()].sort((a, b) =>
        (a.label ?? a.value).localeCompare(b.label ?? b.value, undefined, { sensitivity: "base", numeric: true }),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function RdlReleaseAwareBrowse({ sourceKey, releaseKey, entityType, title }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    Promise.all([loadRdlSearchIndex(), loadRdlRelationshipIndex()])
      .then(([allRecords, allRelationships]) => {
        if (!active) return;
        const records = allRecords.filter(
          (item) =>
            item.sourceKey === sourceKey &&
            item.releaseKey === releaseKey &&
            item.entityType === entityType,
        );
        const packageKeys = new Set(records.map((item) => item.packageKey));
        const relationships = allRelationships.filter(
          (item) =>
            item.sourceKey === sourceKey &&
            item.releaseKey === releaseKey &&
            packageKeys.has(item.packageKey),
        );
        setState({ status: "success", records, relationships });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the selected RDL release.",
        });
      });
    return () => {
      active = false;
    };
  }, [sourceKey, releaseKey, entityType]);

  const facetDefinitions = useMemo(
    () => state.status === "success" ? buildFacetDefinitions(state.records) : [],
    [state],
  );
  const searchParamKey = searchParams.toString();

  const facetFilteredRecords = useMemo(() => {
    if (state.status !== "success") return [];
    if (!facetDefinitions.length) return state.records;
    return state.records.filter((record) =>
      facetDefinitions.every((facet) => {
        const requested = searchParams.get(facet.key);
        if (!requested || !facet.options.some((option) => option.value === requested)) return true;
        return record.facets?.[facet.key]?.value === requested;
      }),
    );
  }, [state, facetDefinitions, searchParamKey]);

  const hierarchy = useMemo(() => {
    if (state.status !== "success") return { roots: [], hierarchyRelationshipCount: 0 };
    return buildHierarchy(facetFilteredRecords, state.relationships);
  }, [state, facetFilteredRecords]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];
    return facetFilteredRecords
      .filter((record) => recordMatchesRdlQuery(record, query))
      .sort(compareRecords)
      .slice(0, 100);
  }, [searchQuery, facetFilteredRecords]);

  const source = getRdlSource(sourceKey);
  const release = getRdlRelease(sourceKey, releaseKey);
  const presentation = presentationFor(entityType, title);

  function openRecord(record: RdlSearchRecord) {
    navigate(
      rdlEntityRoute(
        record.sourceKey,
        record.releaseKey,
        record.entityType,
        record.nativeIdentifier,
      ),
    );
  }

  function selectedFacetValue(facet: FacetDefinition): string {
    const requested = searchParams.get(facet.key);
    return requested && facet.options.some((option) => option.value === requested) ? requested : "all";
  }

  function setFacetValue(facet: FacetDefinition, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(facet.key);
    else next.set(facet.key, value);
    setSearchParams(next, { replace: true });
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={<LoaderCircle className="rdl-release-browse-spinner" size={24} />}
        title={`Loading ${title}`}
        message={`Building the ${source?.shortName ?? sourceKey} ${release?.versionLabel ?? releaseKey} browse view from the release-aware indexes…`}
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusScreen
        icon={<CircleAlert size={24} />}
        title={`Unable to load ${title}`}
        message={state.message}
      />
    );
  }

  const hasHierarchy = hierarchy.hierarchyRelationshipCount > 0;
  const searching = Boolean(searchQuery.trim());
  const navigationRole = searching || !hasHierarchy ? "list" : "tree";
  const navigationLabel = searching
    ? `${title} search results`
    : hasHierarchy
      ? `${title} hierarchy`
      : `${title} vocabulary`;
  const flatRecords = [...facetFilteredRecords].sort(compareRecords);
  const activeFacetCount = facetDefinitions.filter((facet) => selectedFacetValue(facet) !== "all").length;

  return (
    <div
      className="rdl-release-browse"
      data-source-key={sourceKey}
      data-release-key={releaseKey}
      data-browse-mode={hasHierarchy ? "hierarchy" : "flat"}
      data-filtered-record-count={facetFilteredRecords.length}
    >
      <aside className="rdl-release-browse-panel">
        <div className="rdl-release-browse-heading">
          <div>
            <div className="rdl-release-browse-eyebrow">{presentation.eyebrow}</div>
            <h1>{title}</h1>
          </div>
          <div className="rdl-release-browse-count">
            {facetFilteredRecords.length === state.records.length
              ? state.records.length
              : `${facetFilteredRecords.length}/${state.records.length}`}
          </div>
        </div>

        <div className="rdl-release-browse-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Search ${presentation.searchLabel}...`}
            aria-label={`Search ${presentation.searchLabel}`}
          />
          {searchQuery && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")}>
              <X size={15} />
            </button>
          )}
        </div>

        {facetDefinitions.length > 0 && (
          <div className="rdl-release-browse-facets" role="group" aria-label={`${title} filters`}>
            {facetDefinitions.map((facet) => (
              <label className="rdl-release-browse-facet" key={facet.key}>
                <span>{facet.label}</span>
                <select
                  aria-label={`Filter ${title} by ${facet.label}`}
                  value={selectedFacetValue(facet)}
                  onChange={(event) => setFacetValue(facet, event.target.value)}
                >
                  <option value="all">All {facet.label.toLocaleLowerCase()} values</option>
                  {facet.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label ?? option.value} ({option.count})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <div
          className="rdl-release-browse-navigation"
          role={navigationRole}
          aria-label={navigationLabel}
        >
          {searching ? (
            <RecordList records={searchResults} onSelect={openRecord} />
          ) : facetFilteredRecords.length ? (
            hasHierarchy ? (
              hierarchy.roots.map((node) => (
                <BrowseTreeNode
                  key={node.record.nativeIdentifier}
                  node={node}
                  onSelect={openRecord}
                />
              ))
            ) : (
              <RecordList records={flatRecords} onSelect={openRecord} />
            )
          ) : activeFacetCount ? (
            <div className="rdl-release-browse-search-empty">No {title.toLocaleLowerCase()} match the selected filters.</div>
          ) : (
            <div className="rdl-release-browse-search-empty">No {title.toLocaleLowerCase()} in this release.</div>
          )}
        </div>
      </aside>

      <section className="rdl-release-browse-detail-panel">
        <div className="rdl-release-browse-empty-selection">
          <div className="rdl-release-browse-empty-icon">{presentation.icon}</div>
          <h2>Select a {presentation.singularTitle}</h2>
          <p>
            {hasHierarchy ? "Browse the release hierarchy" : "Browse the release vocabulary"} or search by engineering name, native identifier or projected metadata.
            Selecting an entity opens its canonical release-aware detail.
          </p>
          <small>
            {source?.shortName ?? sourceKey} · {release?.versionLabel ?? releaseKey} · {release?.status ?? "selected release"}
            {hasHierarchy
              ? ` · ${hierarchy.hierarchyRelationshipCount} authoritative parent relationship${hierarchy.hierarchyRelationshipCount === 1 ? "" : "s"}`
              : " · flat release vocabulary"}
            {activeFacetCount ? ` · ${activeFacetCount} active filter${activeFacetCount === 1 ? "" : "s"}` : ""}
          </small>
        </div>
      </section>
    </div>
  );
}

type BrowseTreeNodeProps = {
  node: BrowseNode;
  onSelect: (record: RdlSearchRecord) => void;
  depth?: number;
};

function BrowseTreeNode({ node, onSelect, depth = 0 }: BrowseTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <div className="rdl-release-browse-tree-node" role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div className="rdl-release-browse-tree-row" style={{ paddingLeft: 8 + depth * 17 }}>
        {hasChildren ? (
          <button
            type="button"
            className="rdl-release-browse-tree-toggle"
            onClick={() => setExpanded((current) => !current)}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.record.name}`}
          >
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span
            className="rdl-release-browse-tree-toggle rdl-release-browse-tree-toggle-static"
            aria-hidden="true"
          >
            <span className="rdl-release-browse-tree-dot" />
          </span>
        )}
        <button
          type="button"
          className="rdl-release-browse-tree-label"
          onClick={() => onSelect(node.record)}
        >
          <span>{node.record.name}</span>
          <RecordBadges record={node.record} compact />
        </button>
      </div>
      {expanded && node.children.length > 0 && (
        <div role="group">
          {node.children.map((child) => (
            <BrowseTreeNode
              key={child.record.nativeIdentifier}
              node={child}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecordList({ records, onSelect }: { records: RdlSearchRecord[]; onSelect: (record: RdlSearchRecord) => void }) {
  if (!records.length) {
    return <div className="rdl-release-browse-search-empty">No matching entities found.</div>;
  }
  return <>
    {records.map((record) => (
      <div
        key={`${record.packageKey}:${record.entityType}:${record.nativeIdentifier}`}
        className="rdl-release-browse-list-item"
        role="listitem"
      >
        <button
          type="button"
          className="rdl-release-browse-search-result"
          onClick={() => onSelect(record)}
        >
          <span className="rdl-release-browse-search-result-heading">
            <span className="rdl-release-browse-search-result-name">{record.name}</span>
            <RecordBadges record={record} />
          </span>
          {(record.secondaryLabel || record.tertiaryLabel) && (
            <span className="rdl-release-browse-search-result-meta">
              {[record.secondaryLabel, record.tertiaryLabel].filter(Boolean).join(" · ")}
            </span>
          )}
          <span className="rdl-release-browse-search-result-code">{record.nativeIdentifier}</span>
        </button>
      </div>
    ))}
  </>;
}

function RecordBadges({ record, compact = false }: { record: RdlSearchRecord; compact?: boolean }) {
  if (!record.badges?.length) return null;
  return (
    <span className={compact ? "rdl-release-browse-badges rdl-release-browse-badges-compact" : "rdl-release-browse-badges"}>
      {record.badges.map((badge) => (
        <span className="rdl-release-browse-badge" key={badge}>{compact && badge === "Abstract" ? "A" : badge}</span>
      ))}
    </span>
  );
}

function StatusScreen({ icon, title, message }: { icon: ReactNode; title: string; message: string }) {
  return (
    <div className="rdl-release-browse-status-screen">
      <div className="rdl-release-browse-status-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
