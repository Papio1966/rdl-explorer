import {
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  cfihosEquipmentRepository,
} from "../cfihos/repository/CfihosEquipmentRepository";
import type {
  CfihosEquipmentClass,
  CfihosEquipmentClassTreeNode,
} from "../cfihos/model/equipmentClass";
import "./EquipmentClassesPage.css";

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      equipmentClasses: CfihosEquipmentClass[];
      tree: CfihosEquipmentClassTreeNode[];
    }
  | { status: "error"; message: string };

export function EquipmentClassesPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [equipmentClasses, tree] = await Promise.all([
          cfihosEquipmentRepository.getEquipmentClasses(),
          cfihosEquipmentRepository.getEquipmentClassTree(),
        ]);

        if (!active) return;
        setState({ status: "success", equipmentClasses, tree });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS Equipment Classes.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const searchResults = useMemo(() => {
    if (state.status !== "success") return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return state.equipmentClasses
      .filter((equipmentClass) => {
        const values = [
          equipmentClass.id,
          equipmentClass.name,
          equipmentClass.definition,
          equipmentClass.parentName,
          equipmentClass.existenceReason,
          ...equipmentClass.synonyms,
        ];
        return values.some((value) => value?.toLowerCase().includes(query));
      })
      .sort(compareEquipmentClasses)
      .slice(0, 100);
  }, [searchQuery, state]);

  function openEquipmentClass(equipmentClass: CfihosEquipmentClass) {
    navigate(`/classes/equipment/${encodeURIComponent(equipmentClass.id)}`);
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={<LoaderCircle className="equipment-spinner" size={24} />}
        title="Loading Equipment Classes"
        message="Building the CFIHOS Equipment Class hierarchy and property indexes…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusScreen
        icon={<CircleAlert size={24} />}
        title="Unable to load Equipment Classes"
        message={state.message}
      />
    );
  }

  return (
    <div className="equipment-explorer">
      <aside className="equipment-browser-panel">
        <div className="equipment-browser-heading">
          <div>
            <div className="equipment-page-eyebrow">Classes</div>
            <h1>Equipment Classes</h1>
          </div>
          <div className="equipment-class-count">
            {state.equipmentClasses.length}
          </div>
        </div>

        <div className="equipment-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search equipment classes..."
            aria-label="Search Equipment Classes"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="equipment-tree">
          {searchQuery.trim() ? (
            <SearchResults results={searchResults} onSelect={openEquipmentClass} />
          ) : (
            state.tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                onSelect={openEquipmentClass}
              />
            ))
          )}
        </div>
      </aside>

      <section className="equipment-detail-panel">
        <EmptySelection />
      </section>
    </div>
  );
}

type TreeNodeProps = {
  node: CfihosEquipmentClassTreeNode;
  onSelect: (equipmentClass: CfihosEquipmentClass) => void;
  depth?: number;
};

function TreeNode({ node, onSelect, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <div className="equipment-tree-node">
      <div
        className="equipment-tree-row"
        style={{ paddingLeft: 8 + depth * 17 }}
      >
        <button
          type="button"
          className="equipment-tree-toggle"
          onClick={() => {
            if (hasChildren) setExpanded((current) => !current);
          }}
          aria-label={
            hasChildren
              ? expanded
                ? "Collapse class"
                : "Expand class"
              : undefined
          }
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronRight size={15} />
            )
          ) : (
            <span className="equipment-tree-dot" />
          )}
        </button>

        <button
          type="button"
          className="equipment-tree-label"
          onClick={() => onSelect(node)}
        >
          <span>{node.name}</span>
          {node.abstract && <span className="equipment-tree-abstract">A</span>}
        </button>
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

type SearchResultsProps = {
  results: CfihosEquipmentClass[];
  onSelect: (equipmentClass: CfihosEquipmentClass) => void;
};

function SearchResults({ results, onSelect }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="equipment-search-empty">
        No matching Equipment Classes found.
      </div>
    );
  }

  return (
    <div className="equipment-search-results">
      {results.map((equipmentClass) => (
        <button
          key={equipmentClass.id}
          type="button"
          className="equipment-search-result"
          onClick={() => onSelect(equipmentClass)}
        >
          <span className="equipment-search-result-name">
            {equipmentClass.name}
          </span>
          <span className="equipment-search-result-code">
            {equipmentClass.id}
          </span>
        </button>
      ))}
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="equipment-empty-selection">
      <div className="equipment-empty-icon">
        <Boxes size={28} />
      </div>
      <h2>Select an Equipment Class</h2>
      <p>
        Browse the hierarchy or search for an Equipment Class to view its
        definition, applicability and effective properties.
      </p>
    </div>
  );
}

type StatusScreenProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function StatusScreen({ icon, title, message }: StatusScreenProps) {
  return (
    <div className="equipment-status-screen">
      <div className="equipment-status-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function compareEquipmentClasses(
  a: CfihosEquipmentClass,
  b: CfihosEquipmentClass,
): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
