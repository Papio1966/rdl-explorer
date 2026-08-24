import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Hash,
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
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  cfihosDocumentRepository,
} from "../cfihos/repository/CfihosDocumentRepository";
import type {
  CfihosDiscipline,
  CfihosDisciplineDocumentType,
} from "../cfihos/model/document";
import {
  DisciplineDocumentTypeDrawer,
} from "../components/document/DisciplineDocumentTypeDrawer";
import "./DisciplinesPage.css";

const COLLAPSE_THRESHOLD = 10;
const COLLAPSED_ITEM_COUNT = 5;

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      disciplines: CfihosDiscipline[];
    }
  | {
      status: "error";
      message: string;
    };

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      discipline: CfihosDiscipline;
      relationships: CfihosDisciplineDocumentType[];
    }
  | {
      status: "error";
      message: string;
    };

export function DisciplinesPage() {
  const navigate = useNavigate();

  const { disciplineId } =
    useParams();

  const [state, setState] =
    useState<LoadState>({
      status: "loading",
    });

  const [detailState, setDetailState] =
    useState<DetailState>({
      status: "idle",
    });

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    selectedRelationship,
    setSelectedRelationship,
  ] =
    useState<CfihosDisciplineDocumentType | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const disciplines =
          await cfihosDocumentRepository.getDisciplines();

        if (!active) {
          return;
        }

        setState({
          status: "success",
          disciplines,
        });
      } catch (error) {
        if (!active) {
          return;
        }

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

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    let active = true;

    async function loadDetail() {
      setSelectedRelationship(null);

      if (!disciplineId) {
        setDetailState({
          status: "idle",
        });

        return;
      }

      setDetailState({
        status: "loading",
      });

      try {
        const result =
          await cfihosDocumentRepository.getDisciplineWithDocumentTypes(
            disciplineId,
          );

        if (!active) {
          return;
        }

        if (!result) {
          setDetailState({
            status: "error",
            message: `No CFIHOS Discipline was found for ${disciplineId}.`,
          });

          return;
        }

        setDetailState({
          status: "success",
          discipline:
            result.discipline,
          relationships:
            result.relationships,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setDetailState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the selected Discipline.",
        });
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [
    disciplineId,
    state.status,
  ]);

  useEffect(() => {
    if (!selectedRelationship) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setSelectedRelationship(null);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedRelationship]);

  const filteredDisciplines =
    useMemo(() => {
      if (state.status !== "success") {
        return [];
      }

      const query = searchQuery
        .trim()
        .toLowerCase();

      if (!query) {
        return state.disciplines;
      }

      return state.disciplines.filter(
        (discipline) => {
          const values = [
            discipline.id,
            discipline.code,
            discipline.name,
            discipline.description,
          ];

          return values.some((value) =>
            value
              ?.toLowerCase()
              .includes(query),
          );
        },
      );
    }, [searchQuery, state]);

  function openDiscipline(
    discipline: CfihosDiscipline,
  ) {
    navigate(
      `/disciplines/${encodeURIComponent(
        discipline.id,
      )}`,
    );
  }

  if (state.status === "loading") {
    return (
      <DisciplineStatus
        icon={
          <LoaderCircle
            className="discipline-spinner"
            size={24}
          />
        }
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
            <div className="discipline-page-eyebrow">
              Information
            </div>

            <h1>Disciplines</h1>
          </div>

          <span className="discipline-count">
            {state.disciplines.length}
          </span>
        </div>

        <div className="discipline-search">
          <Search size={16} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search disciplines..."
            aria-label="Search Disciplines"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() =>
                setSearchQuery("")
              }
              aria-label="Clear Discipline search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="discipline-result-count">
          {filteredDisciplines.length}{" "}
          {filteredDisciplines.length ===
          1
            ? "Discipline"
            : "Disciplines"}
        </div>

        <div className="discipline-list">
          {filteredDisciplines.map(
            (discipline) => (
              <button
                type="button"
                key={discipline.id}
                className={`discipline-list-item ${
                  discipline.id ===
                  disciplineId
                    ? "discipline-list-item-selected"
                    : ""
                }`}
                onClick={() =>
                  openDiscipline(
                    discipline,
                  )
                }
              >
                <span className="discipline-list-code">
                  {discipline.code}
                </span>

                <span className="discipline-list-name">
                  {discipline.name}
                </span>

                <span className="discipline-list-id">
                  {discipline.id}
                </span>
              </button>
            ),
          )}
        </div>
      </aside>

      <main className="discipline-detail">
        {detailState.status ===
          "idle" && <DisciplineEmpty />}

        {detailState.status ===
          "loading" && (
          <DisciplineStatus
            icon={
              <LoaderCircle
                className="discipline-spinner"
                size={22}
              />
            }
            title="Loading Discipline"
            message="Resolving Document Types and lifecycle requirements…"
          />
        )}

        {detailState.status ===
          "error" && (
          <DisciplineStatus
            icon={
              <CircleAlert size={22} />
            }
            title="Discipline not available"
            message={
              detailState.message
            }
          />
        )}

        {detailState.status ===
          "success" && (
          <DisciplineDetails
            discipline={
              detailState.discipline
            }
            relationships={
              detailState.relationships
            }
            onOpenRelationship={
              setSelectedRelationship
            }
            onOpenDocumentType={(
              documentTypeId,
            ) =>
              navigate(
                `/documents/${encodeURIComponent(
                  documentTypeId,
                )}`,
              )
            }
          />
        )}
      </main>

      {selectedRelationship && (
        <DisciplineDocumentTypeDrawer
          relationship={
            selectedRelationship
          }
          onClose={() =>
            setSelectedRelationship(null)
          }
          onOpenDocumentType={(
            documentTypeId,
          ) => {
            setSelectedRelationship(null);

            navigate(
              `/documents/${encodeURIComponent(
                documentTypeId,
              )}`,
            );
          }}
        />
      )}
    </div>
  );
}

type DisciplineDetailsProps = {
  discipline: CfihosDiscipline;
  relationships: CfihosDisciplineDocumentType[];
  onOpenRelationship: (
    relationship: CfihosDisciplineDocumentType,
  ) => void;
  onOpenDocumentType: (
    documentTypeId: string,
  ) => void;
};

function DisciplineDetails({
  discipline,
  relationships,
  onOpenRelationship,
  onOpenDocumentType,
}: DisciplineDetailsProps) {
  const [documentTypesExpanded, setDocumentTypesExpanded] =
    useState(false);

  useEffect(() => {
    setDocumentTypesExpanded(false);
  }, [discipline.id]);

  const visibleRelationships =
    relationships.length > COLLAPSE_THRESHOLD && !documentTypesExpanded
      ? relationships.slice(0, COLLAPSED_ITEM_COUNT)
      : relationships;

  const classificationCounts =
    useMemo(() => {
      const counts =
        new Map<string, number>();

      for (const relationship of relationships) {
        const classification =
          relationship.documentTypeShortCode
            ? relationship.documentTypeShortCode
            : "Unknown";

        counts.set(
          classification,
          (counts.get(classification) ??
            0) + 1,
        );
      }

      return counts;
    }, [relationships]);

  return (
    <div className="discipline-details-content">
      <header className="discipline-header">
        <div className="discipline-page-eyebrow">
          Discipline
        </div>

        <div className="discipline-title-row">
          <div>
            <div className="discipline-title-code">
              {discipline.code}
            </div>

            <h1>{discipline.name}</h1>

            <div className="discipline-id">
              <Hash size={14} />
              {discipline.id}
            </div>
          </div>

          <div className="discipline-header-badges">
            <span className="discipline-badge">
              {relationships.length} document types
            </span>
          </div>
        </div>

        {discipline.description && (
          <p className="discipline-description">
            {discipline.description}
          </p>
        )}
      </header>

      <div className="discipline-info-grid">
        <DisciplineCard title="Reference">
          <DisciplineRow label="Discipline code">
            {discipline.code}
          </DisciplineRow>

          <DisciplineRow label="CFIHOS code">
            {discipline.id}
          </DisciplineRow>
        </DisciplineCard>

        <DisciplineCard title="Document coverage">
          <DisciplineRow label="Document Types">
            {relationships.length}
          </DisciplineRow>

          <DisciplineRow label="Relationship records">
            {relationships.length}
          </DisciplineRow>

          <DisciplineRow label="Context codes">
            {
              Array.from(
                classificationCounts.values(),
              ).reduce(
                (sum, count) =>
                  sum + count,
                0,
              )
            }
          </DisciplineRow>
        </DisciplineCard>
      </div>

      <section className="discipline-documents-section">
        <div className="discipline-section-heading">
          <div>
            <div className="discipline-page-eyebrow">
              Information requirements
            </div>

            <h2>Document Types</h2>

            <p>
              Document Types associated with this
              Discipline, including delivery context
              and lifecycle requirements.
            </p>
          </div>

          <span className="discipline-section-count">
            {relationships.length}
          </span>
        </div>

        {relationships.length === 0 ? (
          <div className="discipline-empty-panel">
            This Discipline has no
            Document Type relationships.
          </div>
        ) : (
          <>
            <DocumentTypeTable
              relationships={
                visibleRelationships
              }
            onOpenRelationship={
              onOpenRelationship
            }
              onOpenDocumentType={
                onOpenDocumentType
              }
            />

            {relationships.length > COLLAPSE_THRESHOLD && (
              <div className="discipline-expansion-control">
                <button
                  type="button"
                  aria-expanded={documentTypesExpanded}
                  aria-controls="discipline-document-types-list"
                  onClick={() =>
                    setDocumentTypesExpanded((current) => !current)
                  }
                >
                  {documentTypesExpanded
                    ? "Show less"
                    : `Show all ${relationships.length} Document Types`}
                  <ChevronDown
                    size={15}
                    className={
                      documentTypesExpanded
                        ? "discipline-expansion-chevron-open"
                        : undefined
                    }
                  />
                </button>

                {!documentTypesExpanded && (
                  <span>
                    Showing first {COLLAPSED_ITEM_COUNT} of {relationships.length}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

type DocumentTypeTableProps = {
  relationships: CfihosDisciplineDocumentType[];
  onOpenRelationship: (
    relationship: CfihosDisciplineDocumentType,
  ) => void;
  onOpenDocumentType: (
    documentTypeId: string,
  ) => void;
};

function DocumentTypeTable({
  relationships,
  onOpenRelationship,
  onOpenDocumentType,
}: DocumentTypeTableProps) {
  return (
    <div className="discipline-table-wrapper" id="discipline-document-types-list">
      <table className="discipline-table">
        <thead>
          <tr>
            <th>Document Type</th>
            <th>Context code</th>
            <th>Asset type</th>
            <th>Representation</th>
            <th>Delivery timing</th>
            <th>Lifecycle</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {relationships.map(
            (relationship) => (
              <tr key={relationship.id}>
                <td>
                  <button
                    type="button"
                    className="discipline-document-link"
                    onClick={() =>
                      onOpenDocumentType(
                        relationship.documentTypeId,
                      )
                    }
                  >
                    <span className="discipline-document-code">
                      {
                        relationship.documentTypeShortCode
                      }
                    </span>

                    <span>
                      {
                        relationship.documentTypeName
                      }
                    </span>

                    <ChevronRight
                      size={13}
                    />
                  </button>

                  {relationship.documentTypeDescription && (
                    <div className="discipline-document-description">
                      {
                        relationship.documentTypeDescription
                      }
                    </div>
                  )}
                </td>

                <td>
                  {
                    relationship.disciplineDocumentTypeShortCode ??
                    "—"
                  }
                </td>

                <td>
                  {formatPresentationValue(
                    relationship.assetTypeReference,
                  )}
                </td>

                <td>
                  {formatPresentationValue(
                    relationship.representationType,
                  )}
                </td>

                <td>
                  {formatPresentationValue(
                    relationship.nativeFileDeliveryTiming,
                  )}
                </td>

                <td>
                  <LifecycleSummary
                    relationship={
                      relationship
                    }
                  />
                </td>

                <td>
                  <button
                    type="button"
                    className="discipline-details-button"
                    onClick={() =>
                      onOpenRelationship(
                        relationship,
                      )
                    }
                  >
                    View
                    <ChevronRight
                      size={13}
                    />
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

type LifecycleSummaryProps = {
  relationship: CfihosDisciplineDocumentType;
};

function LifecycleSummary({
  relationship,
}: LifecycleSummaryProps) {
  const values = [
    {
      key: "DE",
      value:
        relationship.requiredStatusDetailedEngineering,
    },
    {
      key: "CON",
      value:
        relationship.requiredStatusConstruction,
    },
    {
      key: "COM",
      value:
        relationship.requiredStatusCommissioning,
    },
    {
      key: "SU",
      value:
        relationship.requiredStatusStartup,
    },
    {
      key: "OPS",
      value:
        relationship.requiredStatusOperations,
    },
  ];

  const activeValues =
    values.filter(
      ({ value }) =>
        isMeaningfulStatus(value),
    );

  if (activeValues.length === 0) {
    return (
      <span className="discipline-lifecycle-none">
        Not specified
      </span>
    );
  }

  return (
    <div className="discipline-lifecycle-summary">
      {activeValues.map(
        ({ key, value }) => (
          <span
            key={key}
            className="discipline-lifecycle-chip"
            title={`${key}: ${value}`}
          >
            {key} · {value}
          </span>
        ),
      )}
    </div>
  );
}

type DisciplineCardProps = {
  title: string;
  children: ReactNode;
};

function DisciplineCard({
  title,
  children,
}: DisciplineCardProps) {
  return (
    <section className="discipline-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type DisciplineRowProps = {
  label: string;
  children: ReactNode;
};

function DisciplineRow({
  label,
  children,
}: DisciplineRowProps) {
  return (
    <div className="discipline-row">
      <div className="discipline-row-label">
        {label}
      </div>

      <div className="discipline-row-value">
        {children}
      </div>
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
        Browse the 34 CFIHOS Disciplines to
        explore their associated Document Types,
        delivery context and lifecycle
        requirements.
      </p>
    </div>
  );
}

type DisciplineStatusProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function DisciplineStatus({
  icon,
  title,
  message,
}: DisciplineStatusProps) {
  return (
    <div className="discipline-empty">
      <div className="discipline-empty-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function formatPresentationValue(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    normalized === "" ||
    normalized === "-" ||
    normalized === "—"
  ) {
    return "—";
  }

  if (
    normalized === "model_part"
  ) {
    return "Model / Part";
  }

  return value;
}

function isMeaningfulStatus(
  value: string | null,
): boolean {
  if (!value) {
    return false;
  }

  const normalized =
    value.trim().toLowerCase();

  return ![
    "",
    "-",
    "—",
    "not specified",
    "not applicable",
  ].includes(normalized);
}