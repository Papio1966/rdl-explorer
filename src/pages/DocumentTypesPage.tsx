import {
  CircleAlert,
  FileText,
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
  cfihosDocumentRepository,
} from "../cfihos/repository/CfihosDocumentRepository";
import type { CfihosDocumentType } from "../cfihos/model/document";
import "./DocumentTypesPage.css";

type LoadState =
  | { status: "loading" }
  | { status: "success"; documentTypes: CfihosDocumentType[] }
  | { status: "error"; message: string };

export function DocumentTypesPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const documentTypes = await cfihosDocumentRepository.getDocumentTypes();
        if (!active) return;
        setState({ status: "success", documentTypes });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS Document Types.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredDocumentTypes = useMemo(() => {
    if (state.status !== "success") return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return state.documentTypes;

    return state.documentTypes.filter((documentType) => {
      const values = [
        documentType.id,
        documentType.shortCode,
        documentType.name,
        documentType.description,
        documentType.classification,
        ...documentType.synonyms,
      ];
      return values.some((value) => value?.toLowerCase().includes(query));
    });
  }, [searchQuery, state]);

  function openDocumentType(documentType: CfihosDocumentType) {
    navigate(`/documents/${encodeURIComponent(documentType.id)}`);
  }

  if (state.status === "loading") {
    return (
      <DocumentStatus
        icon={<LoaderCircle className="document-spinner" size={24} />}
        title="Loading Document Types"
        message="Loading CFIHOS document master data and Discipline relationships…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <DocumentStatus
        icon={<CircleAlert size={24} />}
        title="Unable to load Document Types"
        message={state.message}
      />
    );
  }

  return (
    <div className="document-explorer">
      <aside className="document-browser">
        <div className="document-browser-heading">
          <div>
            <div className="document-page-eyebrow">Information</div>
            <h1>Document Types</h1>
          </div>
          <span className="document-count">{state.documentTypes.length}</span>
        </div>

        <div className="document-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search document types..."
            aria-label="Search Document Types"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear Document Type search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="document-result-count">
          {filteredDocumentTypes.length}{" "}
          {filteredDocumentTypes.length === 1
            ? "Document Type"
            : "Document Types"}
        </div>

        <div className="document-list">
          {filteredDocumentTypes.map((documentType) => (
            <button
              type="button"
              key={documentType.id}
              className="document-list-item"
              onClick={() => openDocumentType(documentType)}
            >
              <span className="document-list-name">{documentType.name}</span>
              <span className="document-list-meta">
                {documentType.shortCode}
                {documentType.classification
                  ? ` · ${documentType.classification}`
                  : ""}
              </span>
              <span className="document-list-code">{documentType.id}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="document-detail">
        <DocumentEmpty />
      </main>
    </div>
  );
}

function DocumentEmpty() {
  return (
    <div className="document-empty">
      <div className="document-empty-icon">
        <FileText size={28} />
      </div>
      <h2>Select a Document Type</h2>
      <p>
        Search or browse the CFIHOS Document Type master data to see
        definitions, classifications and Discipline-specific lifecycle
        requirements.
      </p>
    </div>
  );
}

type DocumentStatusProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function DocumentStatus({ icon, title, message }: DocumentStatusProps) {
  return (
    <div className="document-empty">
      <div className="document-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
