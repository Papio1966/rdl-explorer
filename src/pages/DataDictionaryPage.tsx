import {
  BookOpen,
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
  cfihosPropertyRepository,
} from "../cfihos/repository/CfihosPropertyRepository";
import type { CfihosProperty } from "../cfihos/model/property";
import "./DataDictionaryPage.css";

type LoadState =
  | { status: "loading" }
  | { status: "success"; properties: CfihosProperty[] }
  | { status: "error"; message: string };

export function DataDictionaryPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const properties = await cfihosPropertyRepository.getProperties();
        if (!active) return;
        setState({ status: "success", properties });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the CFIHOS Data Dictionary.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredProperties = useMemo(() => {
    if (state.status !== "success") return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return [...state.properties].sort(compareProperties);

    return state.properties
      .filter((property) => {
        const values = [
          property.id,
          property.name,
          property.definition,
          property.dataType,
          property.unitOfMeasureDimensionCode,
          property.picklistName,
          property.existenceReason,
          ...property.synonyms,
        ];
        return values.some((value) => value?.toLowerCase().includes(query));
      })
      .sort(compareProperties);
  }, [searchQuery, state]);

  function openProperty(property: CfihosProperty) {
    navigate(`/dictionary/${encodeURIComponent(property.id)}`);
  }

  if (state.status === "loading") {
    return (
      <DictionaryStatus
        icon={<LoaderCircle className="dictionary-spinner" size={24} />}
        title="Loading Data Dictionary"
        message="Loading and indexing CFIHOS properties…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <DictionaryStatus
        icon={<CircleAlert size={24} />}
        title="Unable to load Data Dictionary"
        message={state.message}
      />
    );
  }

  return (
    <div className="dictionary-explorer">
      <aside className="dictionary-browser">
        <div className="dictionary-browser-heading">
          <div>
            <div className="dictionary-eyebrow">Reference</div>
            <h1>Data Dictionary</h1>
          </div>
          <span className="dictionary-count">{state.properties.length}</span>
        </div>

        <div className="dictionary-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search properties..."
            aria-label="Search properties"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear property search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="dictionary-result-count">
          {filteredProperties.length}{" "}
          {filteredProperties.length === 1 ? "property" : "properties"}
        </div>

        <div className="dictionary-property-list">
          {filteredProperties.map((property) => (
            <button
              type="button"
              key={property.id}
              className="dictionary-property-item"
              onClick={() => openProperty(property)}
            >
              <span className="dictionary-property-item-name">
                {property.name}
              </span>
              <span className="dictionary-property-item-code">
                {property.id}
              </span>
              <span className="dictionary-property-item-meta">
                {property.dataType ?? "Unspecified type"}
                {property.picklistName ? ` · ${property.picklistName}` : ""}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="dictionary-detail">
        <DictionaryEmpty />
      </main>
    </div>
  );
}

function DictionaryEmpty() {
  return (
    <div className="dictionary-empty">
      <div className="dictionary-empty-icon">
        <BookOpen size={28} />
      </div>
      <h2>Select a property</h2>
      <p>
        Search or browse the CFIHOS Data Dictionary to view definitions,
        datatype information, picklists and Tag Class usage.
      </p>
    </div>
  );
}

type DictionaryStatusProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function DictionaryStatus({ icon, title, message }: DictionaryStatusProps) {
  return (
    <div className="dictionary-empty">
      <div className="dictionary-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function compareProperties(a: CfihosProperty, b: CfihosProperty): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
