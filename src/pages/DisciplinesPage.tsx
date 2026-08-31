import {
  CircleAlert,
  LoaderCircle,
  Search,
  Shapes,
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
import type { CfihosDiscipline } from "../cfihos/model/document";
import "./DisciplinesPage.css";

type LoadState =
  | { status: "loading" }
  | { status: "success"; disciplines: CfihosDiscipline[] }
  | { status: "error"; message: string };

export function DisciplinesPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const disciplines = await cfihosDocumentRepository.getDisciplines();
        if (!active) return;
        setState({ status: "success", disciplines });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS Disciplines.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredDisciplines = useMemo(() => {
    if (state.status !== "success") return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return state.disciplines;

    return state.disciplines.filter((discipline) => {
      const values = [
        discipline.id,
        discipline.code,
        discipline.name,
        discipline.description,
      ];
      return values.some((value) => value?.toLowerCase().includes(query));
    });
  }, [searchQuery, state]);

  function openDiscipline(discipline: CfihosDiscipline) {
    navigate(`/disciplines/${encodeURIComponent(discipline.id)}`);
  }

  if (state.status === "loading") {
    return (
      <DisciplineStatus
        icon={<LoaderCircle className="discipline-spinner" size={24} />}
        title="Loading Disciplines"
        message="Loading CFIHOS disciplines and their Document Type relationships…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <DisciplineStatus
        icon={<CircleAlert size={24} />}
        title="Unable to load Disciplines"
        message={state.message}
      />
    );
  }

  return (
    <div className="discipline-explorer">
      <aside className="discipline-browser">
        <div className="discipline-browser-heading">
          <div>
            <div className="discipline-page-eyebrow">Information</div>
            <h1>Disciplines</h1>
          </div>
          <span className="discipline-count">{state.disciplines.length}</span>
        </div>

        <div className="discipline-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search disciplines..."
            aria-label="Search Disciplines"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear Discipline search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="discipline-result-count">
          {filteredDisciplines.length}{" "}
          {filteredDisciplines.length === 1 ? "Discipline" : "Disciplines"}
        </div>

        <div className="discipline-list">
          {filteredDisciplines.map((discipline) => (
            <button
              type="button"
              key={discipline.id}
              className="discipline-list-item"
              onClick={() => openDiscipline(discipline)}
            >
              <span className="discipline-list-code">{discipline.code}</span>
              <span className="discipline-list-name">{discipline.name}</span>
              <span className="discipline-list-id">{discipline.id}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="discipline-detail">
        <DisciplineEmpty />
      </main>
    </div>
  );
}

function DisciplineEmpty() {
  return (
    <div className="discipline-empty">
      <div className="discipline-empty-icon">
        <Shapes size={28} />
      </div>
      <h2>Select a Discipline</h2>
      <p>
        Browse the 34 CFIHOS Disciplines to explore their associated Document
        Types, delivery context and lifecycle requirements.
      </p>
    </div>
  );
}

type DisciplineStatusProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function DisciplineStatus({ icon, title, message }: DisciplineStatusProps) {
  return (
    <div className="discipline-empty">
      <div className="discipline-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
