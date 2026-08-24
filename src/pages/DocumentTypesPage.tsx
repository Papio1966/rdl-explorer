import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  Hash,
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
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  cfihosDocumentRepository,
} from "../cfihos/repository/CfihosDocumentRepository";
import type {
  CfihosDisciplineDocumentType,
  CfihosDocumentType,
} from "../cfihos/model/document";
import {
  cfihosClassDocumentRepository,
} from "../cfihos/repository/CfihosClassDocumentRepository";
import type {
  CfihosResolvedClassDocumentRequirement,
} from "../cfihos/model/classDocumentRequirement";
import {
  cfihosJip33RequirementRepository,
} from "../cfihos/repository/CfihosJip33RequirementRepository";
import type {
  CfihosJip33Requirement,
} from "../cfihos/model/jip33Requirement";
import {
  DisciplineDocumentTypeDrawer,
} from "../components/document/DisciplineDocumentTypeDrawer";
import "./DocumentTypesPage.css";

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      documentTypes: CfihosDocumentType[];
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
      documentType: CfihosDocumentType;
      relationships: CfihosDisciplineDocumentType[];
      classRequirements: CfihosResolvedClassDocumentRequirement[];
      jip33Requirements: CfihosJip33Requirement[];
    }
  | {
      status: "error";
      message: string;
    };

export function DocumentTypesPage() {
  const navigate = useNavigate();

  const { documentTypeId } =
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
        const documentTypes =
          await cfihosDocumentRepository.getDocumentTypes();

        if (!active) {
          return;
        }

        setState({
          status: "success",
          documentTypes,
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
              : "Unable to load CFIHOS Document Types.",
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

      if (!documentTypeId) {
        setDetailState({
          status: "idle",
        });

        return;
      }

      setDetailState({
        status: "loading",
      });

      try {
        const [result, classRequirements, jip33Requirements] =
          await Promise.all([
            cfihosDocumentRepository.getDocumentTypeWithDisciplines(
              documentTypeId,
            ),
            cfihosClassDocumentRepository.getRequirementsForDocumentType(
              documentTypeId,
            ),
            cfihosJip33RequirementRepository.getRequirementsForDocumentType(
              documentTypeId,
            ),
          ]);

        if (!active) {
          return;
        }

        if (!result) {
          setDetailState({
            status: "error",
            message: `No CFIHOS Document Type was found for ${documentTypeId}.`,
          });

          return;
        }

        setDetailState({
          status: "success",
          documentType:
            result.documentType,
          relationships:
            result.relationships,
          classRequirements,
          jip33Requirements,
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
              : "Unable to load the selected Document Type.",
        });
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [
    documentTypeId,
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

  const filteredDocumentTypes =
    useMemo(() => {
      if (state.status !== "success") {
        return [];
      }

      const query = searchQuery
        .trim()
        .toLowerCase();

      if (!query) {
        return state.documentTypes;
      }

      return state.documentTypes.filter(
        (documentType) => {
          const values = [
            documentType.id,
            documentType.shortCode,
            documentType.name,
            documentType.description,
            documentType.classification,
            ...documentType.synonyms,
          ];

          return values.some((value) =>
            value
              ?.toLowerCase()
              .includes(query),
          );
        },
      );
    }, [searchQuery, state]);

  function openDocumentType(
    documentType: CfihosDocumentType,
  ) {
    navigate(
      `/documents/${encodeURIComponent(
        documentType.id,
      )}`,
    );
  }

  if (state.status === "loading") {
    return (
      <DocumentStatus
        icon={
          <LoaderCircle
            className="document-spinner"
            size={24}
          />
        }
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
            <div className="document-page-eyebrow">
              Information
            </div>

            <h1>Document Types</h1>
          </div>

          <span className="document-count">
            {state.documentTypes.length}
          </span>
        </div>

        <div className="document-search">
          <Search size={16} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search document types..."
            aria-label="Search Document Types"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() =>
                setSearchQuery("")
              }
              aria-label="Clear Document Type search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="document-result-count">
          {filteredDocumentTypes.length}{" "}
          {filteredDocumentTypes.length ===
          1
            ? "Document Type"
            : "Document Types"}
        </div>

        <div className="document-list">
          {filteredDocumentTypes.map(
            (documentType) => (
              <button
                type="button"
                key={documentType.id}
                className={`document-list-item ${
                  documentType.id ===
                  documentTypeId
                    ? "document-list-item-selected"
                    : ""
                }`}
                onClick={() =>
                  openDocumentType(
                    documentType,
                  )
                }
              >
                <span className="document-list-name">
                  {documentType.name}
                </span>

                <span className="document-list-meta">
                  {documentType.shortCode}
                  {documentType.classification
                    ? ` · ${documentType.classification}`
                    : ""}
                </span>

                <span className="document-list-code">
                  {documentType.id}
                </span>
              </button>
            ),
          )}
        </div>
      </aside>

      <main className="document-detail">
        {detailState.status ===
          "idle" && <DocumentEmpty />}

        {detailState.status ===
          "loading" && (
          <DocumentStatus
            icon={
              <LoaderCircle
                className="document-spinner"
                size={22}
              />
            }
            title="Loading Document Type"
            message="Resolving Discipline usage and delivery requirements…"
          />
        )}

        {detailState.status ===
          "error" && (
          <DocumentStatus
            icon={
              <CircleAlert size={22} />
            }
            title="Document Type not available"
            message={
              detailState.message
            }
          />
        )}

        {detailState.status ===
          "success" && (
          <DocumentTypeDetails
            key={detailState.documentType.id}
            documentType={
              detailState.documentType
            }
            relationships={
              detailState.relationships
            }
            classRequirements={
              detailState.classRequirements
            }
            jip33Requirements={
              detailState.jip33Requirements
            }
            onOpenRelationship={
              setSelectedRelationship
            }
            onOpenDiscipline={(
              disciplineId,
            ) =>
              navigate(
                `/disciplines/${encodeURIComponent(
                  disciplineId,
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
          onOpenDiscipline={(
            disciplineId,
          ) => {
            setSelectedRelationship(null);

            navigate(
              `/disciplines/${encodeURIComponent(
                disciplineId,
              )}`,
            );
          }}
        />
      )}
    </div>
  );
}

type DocumentTypeDetailsProps = {
  documentType: CfihosDocumentType;
  relationships: CfihosDisciplineDocumentType[];
  classRequirements: CfihosResolvedClassDocumentRequirement[];
  jip33Requirements: CfihosJip33Requirement[];
  onOpenRelationship: (
    relationship: CfihosDisciplineDocumentType,
  ) => void;
  onOpenDiscipline: (
    disciplineId: string,
  ) => void;
};

function DocumentTypeDetails({
  documentType,
  relationships,
  classRequirements,
  jip33Requirements,
  onOpenRelationship,
  onOpenDiscipline,
}: DocumentTypeDetailsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  );

  const jip33Mappings = useMemo(
    () =>
      jip33Requirements.flatMap((requirement) =>
        requirement.mappings
          .filter((mapping) => mapping.documentTypeId === documentType.id)
          .map((mapping) => ({ requirement, mapping })),
      ),
    [documentType.id, jip33Requirements],
  );

  function isExpanded(sectionId: string) {
    return expandedSections.has(sectionId);
  }

  function toggleSection(sectionId: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const visibleRelationships = visibleItems(
    relationships,
    isExpanded("discipline"),
  );
  const visibleClassRequirements = visibleItems(
    classRequirements,
    isExpanded("classes"),
  );
  const visibleJip33Mappings = visibleItems(
    jip33Mappings,
    isExpanded("jip33"),
  );

  return (
    <div className="document-details-content">
      <header className="document-header">
        <div className="document-page-eyebrow">Document Type</div>

        <div className="document-title-row">
          <div>
            <h1>{documentType.name}</h1>
            <div className="document-id">
              <Hash size={14} />
              {documentType.id}
            </div>
          </div>

          <div className="document-header-badges">
            <span className="document-badge">{documentType.shortCode}</span>
            {documentType.classification && (
              <span className="document-badge document-badge-neutral">
                {documentType.classification}
              </span>
            )}
          </div>
        </div>

        {documentType.description && (
          <p className="document-description">{documentType.description}</p>
        )}
      </header>

      <div className="document-info-grid">
        <DocumentCard title="Reference">
          <DocumentRow label="Short code">{documentType.shortCode}</DocumentRow>
          <DocumentRow label="Classification">
            {documentType.classification ?? "Not specified"}
          </DocumentRow>
          <DocumentRow label="Synonyms">
            {documentType.synonyms.length > 0
              ? documentType.synonyms.join(", ")
              : "None"}
          </DocumentRow>
        </DocumentCard>

        <DocumentCard title="Usage">
          <DocumentRow label="Disciplines">{relationships.length}</DocumentRow>
          <DocumentRow label="Class requirements">
            {classRequirements.length}
          </DocumentRow>
          <DocumentRow label="CFIHOS code">{documentType.id}</DocumentRow>
        </DocumentCard>
      </div>

      <nav className="document-on-this-page" aria-label="On this page">
        <span>On this page</span>
        <div>
          <a href="#document-discipline-requirements">Discipline requirements</a>
          <a href="#document-required-by-classes">Required by Classes</a>
          {jip33Mappings.length > 0 && (
            <a href="#document-jip33-requirements">JIP33 requirements</a>
          )}
        </div>
      </nav>

      <section
        className="document-usage-section document-anchored-section"
        id="document-discipline-requirements"
      >
        <div className="document-section-heading">
          <div>
            <div className="document-page-eyebrow">Discipline context</div>
            <h2>Discipline requirements</h2>
            <p>
              The same Document Type can have different delivery and lifecycle
              requirements depending on the Discipline context.
            </p>
          </div>
          <span className="document-section-count">{relationships.length}</span>
        </div>

        {relationships.length === 0 ? (
          <div className="document-empty-panel">
            This Document Type has no Discipline relationships.
          </div>
        ) : (
          <>
            <DisciplineUsageTable
              relationships={visibleRelationships}
              onOpenRelationship={onOpenRelationship}
              onOpenDiscipline={onOpenDiscipline}
            />
            <ProgressiveDisclosureControl
              total={relationships.length}
              expanded={isExpanded("discipline")}
              label="discipline requirements"
              onToggle={() => toggleSection("discipline")}
            />
          </>
        )}
      </section>

      <section
        className="document-usage-section document-anchored-section"
        id="document-required-by-classes"
      >
        <div className="document-section-heading">
          <div>
            <div className="document-page-eyebrow">Class requirements</div>
            <h2>Required by Classes</h2>
            <p>
              CFIHOS class-document requirements that explicitly require this
              Document Type, including the applicable asset context and Source
              Standard provenance.
            </p>
          </div>
          <span className="document-section-count">{classRequirements.length}</span>
        </div>

        {classRequirements.length === 0 ? (
          <div className="document-empty-panel">
            This Document Type has no explicit class requirements.
          </div>
        ) : (
          <>
            <ClassRequirementTable requirements={visibleClassRequirements} />
            <ProgressiveDisclosureControl
              total={classRequirements.length}
              expanded={isExpanded("classes")}
              label="class requirements"
              onToggle={() => toggleSection("classes")}
            />
          </>
        )}
      </section>

      {jip33Mappings.length > 0 && (
        <section
          className="document-usage-section document-jip33-section document-anchored-section"
          id="document-jip33-requirements"
        >
          <div className="document-section-heading">
            <div>
              <div className="document-page-eyebrow">Specification overlay</div>
              <h2>JIP33 requirements</h2>
              <p>
                JIP33 information requirements that use this Document Type. These
                are additional specification mappings and are not merged into
                CFIHOS CORE class-document requirements.
              </p>
            </div>
            <span className="document-section-count">{jip33Mappings.length}</span>
          </div>

          <Jip33DocumentRequirementsList mappings={visibleJip33Mappings} />
          <ProgressiveDisclosureControl
            total={jip33Mappings.length}
            expanded={isExpanded("jip33")}
            label="JIP33 requirements"
            onToggle={() => toggleSection("jip33")}
          />
        </section>
      )}
    </div>
  );
}

const COLLAPSE_THRESHOLD = 10;
const COLLAPSED_ITEM_COUNT = 5;

function visibleItems<T>(items: T[], expanded: boolean): T[] {
  if (expanded || items.length <= COLLAPSE_THRESHOLD) return items;
  return items.slice(0, COLLAPSED_ITEM_COUNT);
}

type ProgressiveDisclosureControlProps = {
  total: number;
  expanded: boolean;
  label: string;
  onToggle: () => void;
};

function ProgressiveDisclosureControl({
  total,
  expanded,
  label,
  onToggle,
}: ProgressiveDisclosureControlProps) {
  if (total <= COLLAPSE_THRESHOLD) return null;

  return (
    <div className="document-progressive-disclosure">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded ? "Show less" : `Show all ${total} ${label}`}
        <ChevronDown
          size={14}
          className={expanded ? "document-disclosure-chevron-expanded" : ""}
        />
      </button>
      <span>
        {expanded
          ? `Showing all ${total}`
          : `Showing first ${COLLAPSED_ITEM_COUNT} of ${total}`}
      </span>
    </div>
  );
}

type Jip33DocumentMapping = {
  requirement: CfihosJip33Requirement;
  mapping: CfihosJip33Requirement["mappings"][number];
};

function Jip33DocumentRequirementsList({
  mappings,
}: {
  mappings: Jip33DocumentMapping[];
}) {
  const navigate = useNavigate();

  return (
    <div className="document-jip33-list">
      {mappings.map(({ requirement, mapping }, index) => (
        <div
          className="document-jip33-row"
          key={`${requirement.id}-${mapping.tagClassId}-${index}`}
        >
          <div>
            <strong>{requirement.number ?? requirement.title ?? requirement.id}</strong>
            {requirement.title && requirement.title !== requirement.number && (
              <span>{requirement.title}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              navigate(`/classes/tag/${encodeURIComponent(mapping.tagClassId)}`)
            }
          >
            {mapping.tagClassName}
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(
                `/standards/${encodeURIComponent(mapping.sourceStandardId)}`,
              )
            }
          >
            {mapping.sourceStandardCode ?? mapping.sourceStandardId}
            <ChevronRight size={13} />
          </button>
          <span className="document-context-chip">
            {requirement.requirementGroupCode ?? "JIP33"}
          </span>
        </div>
      ))}
    </div>
  );
}

type ClassRequirementTableProps = {
  requirements: CfihosResolvedClassDocumentRequirement[];
};

function ClassRequirementTable({
  requirements,
}: ClassRequirementTableProps) {
  const navigate = useNavigate();

  return (
    <div className="document-class-requirement-wrapper">
      <table className="document-class-requirement-table">
        <thead>
          <tr>
            <th>Class</th>
            <th>Asset context</th>
            <th>Source Standard</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((item) => {
            const { requirement } = item;
            const classRoute =
              requirement.assetType === "Tag" && item.resolvedTagClassId
                ? `/classes/tag/${encodeURIComponent(item.resolvedTagClassId)}`
                : requirement.assetType === "Equipment" && item.resolvedEquipmentClassId
                  ? `/classes/equipment/${encodeURIComponent(item.resolvedEquipmentClassId)}`
                  : null;

            return (
              <tr key={requirement.id}>
                <td>
                  {classRoute ? (
                    <button
                      type="button"
                      className="document-class-link"
                      onClick={() => navigate(classRoute)}
                    >
                      <span>{requirement.className}</span>
                      <ChevronRight size={13} />
                    </button>
                  ) : (
                    <span className="document-class-name">
                      {requirement.className}
                    </span>
                  )}
                  <div className="document-class-id">
                    {requirement.classId}
                  </div>
                </td>
                <td>
                  <span className="document-context-chip">
                    {displayAssetContext(requirement.assetType)}
                  </span>
                </td>
                <td>
                  {item.resolvedSourceStandardId ? (
                    <button
                      type="button"
                      className="document-standard-link"
                      onClick={() =>
                        navigate(
                          `/standards/${encodeURIComponent(
                            item.resolvedSourceStandardId!,
                          )}`,
                        )
                      }
                    >
                      {requirement.sourceStandardCode ??
                        item.resolvedSourceStandardId}
                      <ChevronRight size={13} />
                    </button>
                  ) : (
                    requirement.sourceStandardCode ?? "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function displayAssetContext(
  assetType: CfihosResolvedClassDocumentRequirement["requirement"]["assetType"],
): string {
  switch (assetType) {
    case "Model_Part":
      return "Model / Part";
    case "Process_Unit":
      return "Process Unit";
    case "Unknown":
      return "Other";
    default:
      return assetType;
  }
}

type DisciplineUsageTableProps = {
  relationships: CfihosDisciplineDocumentType[];
  onOpenRelationship: (
    relationship: CfihosDisciplineDocumentType,
  ) => void;
  onOpenDiscipline: (
    disciplineId: string,
  ) => void;
};

function DisciplineUsageTable({
  relationships,
  onOpenRelationship,
  onOpenDiscipline,
}: DisciplineUsageTableProps) {
  return (
    <div className="document-table-wrapper">
      <table className="document-table">
        <thead>
          <tr>
            <th>Discipline</th>
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
                    className="document-discipline-link"
                    onClick={() =>
                      onOpenDiscipline(
                        relationship.disciplineId,
                      )
                    }
                  >
                    <span className="document-discipline-code">
                      {
                        relationship.disciplineCode
                      }
                    </span>

                    <span>
                      {
                        relationship.disciplineName
                      }
                    </span>

                    <ChevronRight
                      size={13}
                    />
                  </button>
                </td>

                <td>
                  {
                    relationship.disciplineDocumentTypeShortCode ??
                    "—"
                  }
                </td>

                <td>
                  {displayCompactValue(
                    relationship.assetTypeReference,
                  )}
                </td>

                <td>
                  {displayCompactValue(
                    relationship.representationType,
                  )}
                </td>

                <td>
                  {displayCompactValue(
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
                    className="document-details-button"
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

  const activeValues = values.filter(
    ({ value }) =>
      isMeaningfulStatus(value),
  );

  if (activeValues.length === 0) {
    return (
      <span className="document-lifecycle-none">
        Not specified
      </span>
    );
  }

  return (
    <div className="document-lifecycle-summary">
      {activeValues.map(
        ({ key, value }) => (
          <span
            key={key}
            className="document-lifecycle-chip"
            title={`${key}: ${value}`}
          >
            {key} · {value}
          </span>
        ),
      )}
    </div>
  );
}

type DocumentCardProps = {
  title: string;
  children: ReactNode;
};

function DocumentCard({
  title,
  children,
}: DocumentCardProps) {
  return (
    <section className="document-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type DocumentRowProps = {
  label: string;
  children: ReactNode;
};

function DocumentRow({
  label,
  children,
}: DocumentRowProps) {
  return (
    <div className="document-row">
      <div className="document-row-label">
        {label}
      </div>

      <div className="document-row-value">
        {children}
      </div>
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
        Search or browse the CFIHOS
        Document Type master data to see
        definitions, classifications and
        Discipline-specific lifecycle
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

function DocumentStatus({
  icon,
  title,
  message,
}: DocumentStatusProps) {
  return (
    <div className="document-empty">
      <div className="document-empty-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function displayCompactValue(
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