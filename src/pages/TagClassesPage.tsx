import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Search,
  Tags,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { cfihosRepository } from "../cfihos/repository/CfihosRepository";
import type {
  CfihosTagClass,
  CfihosTagClassTreeNode,
} from "../cfihos/model/tagClass";
import "./TagClassesPage.css";

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      tagClasses: CfihosTagClass[];
      tree: CfihosTagClassTreeNode[];
    }
  | { status: "error"; message: string };

export function TagClassesPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [tagClasses, tree] = await Promise.all([
          cfihosRepository.getTagClasses(),
          cfihosRepository.getTagClassTree(),
        ]);

        if (!active) return;
        setState({ status: "success", tagClasses, tree });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS Tag Classes.",
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

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return state.tagClasses
      .filter((tagClass) => {
        const values = [
          tagClass.id,
          tagClass.name,
          tagClass.definition,
          tagClass.parentName,
          ...tagClass.synonyms,
        ];

        return values.some((value) =>
          value?.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      )
      .slice(0, 100);
  }, [searchQuery, state]);

  function openTagClass(tagClass: CfihosTagClass) {
    navigate(`/classes/tag/${encodeURIComponent(tagClass.id)}`);
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={<LoaderCircle className="tag-spinner" size={24} />}
        title="Loading Tag Classes"
        message="Building the CFIHOS Tag Class hierarchy and property indexes…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusScreen
        icon={<CircleAlert size={24} />}
        title="Unable to load Tag Classes"
        message={state.message}
      />
    );
  }

  return (
    <div className="tag-explorer">
      <aside className="tag-browser-panel">
        <div className="tag-browser-heading">
          <div>
            <div className="tag-page-eyebrow">Classes</div>
            <h1>Tag Classes</h1>
          </div>
          <div className="tag-class-count">{state.tagClasses.length}</div>
        </div>

        <div className="tag-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tag classes..."
            aria-label="Search tag classes"
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

        <div className="tag-tree">
          {searchQuery.trim() ? (
            <SearchResults results={searchResults} onSelect={openTagClass} />
          ) : (
            state.tree.map((node) => (
              <TreeNode key={node.id} node={node} onSelect={openTagClass} />
            ))
          )}
        </div>
      </aside>

      <section className="tag-detail-panel">
        <EmptySelection />
      </section>
    </div>
  );
}

type TreeNodeProps = {
  node: CfihosTagClassTreeNode;
  onSelect: (tagClass: CfihosTagClass) => void;
  depth?: number;
};

function TreeNode({ node, onSelect, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <div className="tag-tree-node">
      <div
        className="tag-tree-row"
        style={{ paddingLeft: 8 + depth * 17 }}
      >
        <button
          type="button"
          className="tag-tree-toggle"
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
            <span className="tag-tree-dot" />
          )}
        </button>

        <button
          type="button"
          className="tag-tree-label"
          onClick={() => onSelect(node)}
        >
          <span>{node.name}</span>
          {node.abstract && <span className="tag-tree-abstract">A</span>}
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
  results: CfihosTagClass[];
  onSelect: (tagClass: CfihosTagClass) => void;
};

function SearchResults({ results, onSelect }: SearchResultsProps) {
  if (results.length === 0) {
    return <div className="tag-search-empty">No matching Tag Classes found.</div>;
  }

  return (
    <div className="tag-search-results">
      {results.map((tagClass) => (
        <button
          key={tagClass.id}
          type="button"
          className="tag-search-result"
          onClick={() => onSelect(tagClass)}
        >
          <span className="tag-search-result-name">{tagClass.name}</span>
          <span className="tag-search-result-code">{tagClass.id}</span>
        </button>
      ))}
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="tag-empty-selection">
      <div className="tag-empty-icon">
        <Tags size={28} />
      </div>
      <h2>Select a Tag Class</h2>
      <p>
        Browse the hierarchy or search for a Tag Class to view its definition,
        classification and effective properties.
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
    <div className="tag-status-screen">
      <div className="tag-status-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
