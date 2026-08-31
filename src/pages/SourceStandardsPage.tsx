import {
  CircleAlert,
  Database,
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
  cfihosSourceStandardRepository,
} from "../cfihos/repository/CfihosSourceStandardRepository";
import type { CfihosSourceStandard } from "../cfihos/model/sourceStandard";
import "./SourceStandardsPage.css";

type LoadState =
  | { status: "loading" }
  | { status: "success"; standards: CfihosSourceStandard[] }
  | { status: "error"; message: string };

export function SourceStandardsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const standards =
          await cfihosSourceStandardRepository.getSourceStandards();
        if (!active) return;
        setState({ status: "success", standards });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS Source Standards.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredStandards = useMemo(() => {
    if (state.status !== "success") return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return state.standards;

    return state.standards.filter((standard) => {
      const values = [standard.id, standard.code, standard.description];
      return values.some((value) => value?.toLowerCase().includes(query));
    });
  }, [searchQuery, state]);

  function openStandard(standard: CfihosSourceStandard) {
    navigate(`/standards/${encodeURIComponent(standard.id)}`);
  }

  if (state.status === "loading") {
    return (
      <SourceStandardStatus
        icon={<LoaderCircle className="source-standard-spinner" size={24} />}
        title="Loading Source Standards"
        message="Loading the CFIHOS Source Standard master and traceability relationships…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <SourceStandardStatus
        icon={<CircleAlert size={24} />}
        title="Unable to load Source Standards"
        message={state.message}
      />
    );
  }

  return (
    <div className="source-standard-explorer">
      <aside className="source-standard-browser">
        <div className="source-standard-browser-heading">
          <div>
            <div className="source-standard-page-eyebrow">Reference</div>
            <h1>Source Standards</h1>
          </div>
          <span className="source-standard-count">{state.standards.length}</span>
        </div>

        <div className="source-standard-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search standards..."
            aria-label="Search Source Standards"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear Source Standard search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="source-standard-result-count">
          {filteredStandards.length}{" "}
          {filteredStandards.length === 1
            ? "Source Standard"
            : "Source Standards"}
        </div>

        <div className="source-standard-list">
          {filteredStandards.map((standard) => (
            <button
              type="button"
              key={standard.id}
              className="source-standard-list-item"
              onClick={() => openStandard(standard)}
            >
              <span className="source-standard-list-code">{standard.code}</span>
              <span className="source-standard-list-description">
                {standard.description ?? "No description"}
              </span>
              <span className="source-standard-list-id">{standard.id}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="source-standard-detail">
        <SourceStandardEmpty />
      </main>
    </div>
  );
}

function SourceStandardEmpty() {
  return (
    <div className="source-standard-empty">
      <div className="source-standard-empty-icon">
        <Database size={28} />
      </div>
      <h2>Select a Source Standard</h2>
      <p>
        Search or browse the CFIHOS Source Standard master to explore class
        usage, property provenance and controlled-value references.
      </p>
    </div>
  );
}

type SourceStandardStatusProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function SourceStandardStatus({
  icon,
  title,
  message,
}: SourceStandardStatusProps) {
  return (
    <div className="source-standard-empty">
      <div className="source-standard-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
