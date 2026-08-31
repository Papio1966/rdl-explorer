import {
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Search,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getRdlRelease, getRdlSource, rdlEntityRoute } from "../rdl/catalog";
import {
  loadRdlRelationshipIndex,
  type RdlRelationshipIndexRecord,
} from "../rdl/entityDetail";
import { loadRdlSearchIndex, type RdlSearchRecord } from "../rdl/search";
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

export function RdlReleaseAwareBrowse({ sourceKey, releaseKey, entityType, title }: Props) {
  const navigate = useNavigate();
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

  const hierarchy = useMemo(() => {
    if (state.status !== "success") return { roots: [], hierarchyRelationshipCount: 0 };
    return buildHierarchy(state.records, state.relationships);
  }, [state]);

  const searchResults = useMemo(() => {
    if (state.status !== "success") return [];
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return state.records
      .filter((record) =>
        [record.nativeIdentifier, record.name, record.definition].some((value) =>
          value.toLocaleLowerCase().includes(query),
        ),
      )
      .sort(compareRecords)
      .slice(0, 100);
  }, [searchQuery, state]);

  const source = getRdlSource(sourceKey);
  const release = getRdlRelease(sourceKey, releaseKey);
  const singularTitle = entityType === "tag_class"
    ? "Tag Class"
    : entityType === "equipment_class"
      ? "Equipment Class"
      : title.endsWith("s")
        ? title.slice(0, -1)
        : title;
  const EmptyIcon = entityType === "equipment_class" ? Boxes : Tags;

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

  return (
    <div className="rdl-release-browse" data-source-key={sourceKey} data-release-key={releaseKey}>
      <aside className="rdl-release-browse-panel">
        <div className="rdl-release-browse-heading">
          <div>
            <div className="rdl-release-browse-eyebrow">Classes</div>
            <h1>{title}</h1>
          </div>
          <div className="rdl-release-browse-count">{state.records.length}</div>
        </div>

        <div className="rdl-release-browse-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Search ${title.toLocaleLowerCase()}...`}
            aria-label={`Search ${title.toLocaleLowerCase()}`}
          />
          {searchQuery && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="rdl-release-browse-tree" role="tree" aria-label={`${title} hierarchy`}>
          {searchQuery.trim() ? (
            <SearchResults results={searchResults} onSelect={openRecord} />
          ) : state.records.length ? (
            hierarchy.roots.map((node) => (
              <BrowseTreeNode
                key={node.record.nativeIdentifier}
                node={node}
                onSelect={openRecord}
              />
            ))
          ) : (
            <div className="rdl-release-browse-search-empty">No {title.toLocaleLowerCase()} in this release.</div>
          )}
        </div>
      </aside>

      <section className="rdl-release-browse-detail-panel">
        <div className="rdl-release-browse-empty-selection">
          <div className="rdl-release-browse-empty-icon"><EmptyIcon size={28} /></div>
          <h2>Select a {singularTitle}</h2>
          <p>
            Browse the release hierarchy or search by engineering name or native identifier.
            Selecting an entity opens its canonical release-aware detail.
          </p>
          <small>
            {source?.shortName ?? sourceKey} · {release?.versionLabel ?? releaseKey} · {release?.status ?? "selected release"}
            {hierarchy.hierarchyRelationshipCount > 0
              ? ` · ${hierarchy.hierarchyRelationshipCount} authoritative parent relationship${hierarchy.hierarchyRelationshipCount === 1 ? "" : "s"}`
              : " · flat release vocabulary"}
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

function SearchResults({ results, onSelect }: { results: RdlSearchRecord[]; onSelect: (record: RdlSearchRecord) => void }) {
  if (!results.length) {
    return <div className="rdl-release-browse-search-empty">No matching entities found.</div>;
  }
  return (
    <div className="rdl-release-browse-search-results">
      {results.map((record) => (
        <button
          key={`${record.packageKey}:${record.entityType}:${record.nativeIdentifier}`}
          type="button"
          className="rdl-release-browse-search-result"
          onClick={() => onSelect(record)}
        >
          <span className="rdl-release-browse-search-result-name">{record.name}</span>
          <span className="rdl-release-browse-search-result-code">{record.nativeIdentifier}</span>
        </button>
      ))}
    </div>
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
