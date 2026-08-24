import {
  ArrowRight,
  CircleAlert,
  Filter,
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
import type {
  CfihosDisciplineDocumentType,
} from "../cfihos/model/document";
import type {
  CfihosHandoverEvent,
  CfihosLifecyclePhaseKey,
} from "../cfihos/model/handoverEvent";
import {
  cfihosDocumentRepository,
} from "../cfihos/repository/CfihosDocumentRepository";
import {
  cfihosHandoverEventRepository,
} from "../cfihos/repository/CfihosHandoverEventRepository";
import "./LifecycleRequirementsPage.css";

type LifecyclePhaseKey = CfihosLifecyclePhaseKey;

type LifecyclePhase = {
  key: LifecyclePhaseKey;
  label: string;
  shortLabel: string;
  handoverEvent: CfihosHandoverEvent;
  statusSelector: (
    relationship: CfihosDisciplineDocumentType,
  ) => string | null;
};

function createLifecyclePhase(event: CfihosHandoverEvent): LifecyclePhase {
  const selectors: Record<
    LifecyclePhaseKey,
    (relationship: CfihosDisciplineDocumentType) => string | null
  > = {
    "detailed-engineering": (relationship) =>
      relationship.requiredStatusDetailedEngineering,
    construction: (relationship) =>
      relationship.requiredStatusConstruction,
    commissioning: (relationship) =>
      relationship.requiredStatusCommissioning,
    startup: (relationship) =>
      relationship.requiredStatusStartup,
    operations: (relationship) =>
      relationship.requiredStatusOperations,
  };

  return {
    key: event.lifecyclePhaseKey,
    label: displayHandoverEventName(event.name),
    shortLabel: displayHandoverEventName(event.name),
    handoverEvent: event,
    statusSelector: selectors[event.lifecyclePhaseKey],
  };
}

function displayHandoverEventName(name: string): string {
  const prefix = "handover for ";
  const normalized = name.trim();
  const phaseName = normalized.toLowerCase().startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;

  return phaseName.replace(/(^|[\s-])\S/g, (match) => match.toUpperCase());
}

type LoadState =
  | {
      status: "loading";
    }
  | {
      status: "success";
      relationships:
        CfihosDisciplineDocumentType[];
      phases: LifecyclePhase[];
    }
  | {
      status: "error";
      message: string;
    };

export function LifecycleRequirementsPage() {
  const navigate = useNavigate();

  const { lifecyclePhase } =
    useParams<{
      lifecyclePhase: string;
    }>();

  const [state, setState] =
    useState<LoadState>({
      status: "loading",
    });

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    selectedDiscipline,
    setSelectedDiscipline,
  ] = useState("all");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("all");

  const [
    selectedAssetType,
    setSelectedAssetType,
  ] = useState("all");

  const [
    selectedRepresentation,
    setSelectedRepresentation,
  ] = useState("all");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [relationships, handoverEvents] =
          await Promise.all([
            cfihosDocumentRepository.getRelationships(),
            cfihosHandoverEventRepository.getHandoverEvents(),
          ]);

        const phases = handoverEvents.map(createLifecyclePhase);

        if (!active) {
          return;
        }

        setState({
          status: "success",
          relationships,
          phases,
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
              : "Unable to load lifecycle requirements.",
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const activePhase =
    useMemo(() => {
      return (
        state.status === "success"
          ? state.phases.find(
          (phase) =>
            phase.key === lifecyclePhase,
        ) ?? state.phases[0]
          : undefined
      );
    }, [lifecyclePhase, state]);

  useEffect(() => {
    if (!activePhase) return;
    setSearchQuery("");
    setSelectedDiscipline("all");
    setSelectedStatus("all");
    setSelectedAssetType("all");
    setSelectedRepresentation("all");
  }, [activePhase?.key]);

  const phaseCounts =
    useMemo(() => {
      if (state.status !== "success") {
        return new Map<
          LifecyclePhaseKey,
          number
        >();
      }

      const counts =
        new Map<
          LifecyclePhaseKey,
          number
        >();

      for (const phase of state.phases) {
        counts.set(
          phase.key,
          state.relationships.filter(
            (relationship) =>
              hasExplicitLifecycleRequirement(
                phase.statusSelector(
                  relationship,
                ),
              ),
          ).length,
        );
      }

      return counts;
    }, [state]);

  const phaseRelationships =
    useMemo(() => {
      if (state.status !== "success") {
        return [];
      }

      if (!activePhase) return [];

      return state.relationships.filter(
        (relationship) =>
          hasExplicitLifecycleRequirement(
            activePhase.statusSelector(
              relationship,
            ),
          ),
      );
    }, [activePhase, state]);

  const disciplineOptions =
    useMemo(
      () =>
        uniqueSortedOptions(
          phaseRelationships.map(
            (relationship) => ({
              value:
                relationship.disciplineId,
              label: `${relationship.disciplineCode} · ${relationship.disciplineName}`,
            }),
          ),
        ),
      [phaseRelationships],
    );

  const statusOptions =
    useMemo(() => {
      if (!activePhase) {
        return [];
      }

      return uniqueStrings(
        phaseRelationships
          .map((relationship) =>
            activePhase.statusSelector(
              relationship,
            ),
          )
          .filter(
            (
              value,
            ): value is string =>
              hasExplicitLifecycleRequirement(
                value,
              ),
          ),
      );
    }, [activePhase, phaseRelationships]);

  const assetTypeOptions =
    useMemo(
      () =>
        uniqueStrings(
          phaseRelationships
            .map(
              (relationship) =>
                relationship.assetTypeReference,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(
                  value &&
                    value.trim(),
                ),
            ),
        ),
      [phaseRelationships],
    );

  const representationOptions =
    useMemo(
      () =>
        uniqueStrings(
          phaseRelationships
            .map(
              (relationship) =>
                relationship.representationType,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(
                  value &&
                    value.trim(),
                ),
            ),
        ),
      [phaseRelationships],
    );

  const filteredRelationships =
    useMemo(() => {
      if (!activePhase) {
        return [];
      }

      const query = searchQuery
        .trim()
        .toLowerCase();

      return phaseRelationships.filter(
        (relationship) => {
          const lifecycleStatus =
            activePhase.statusSelector(
              relationship,
            );

          if (
            selectedDiscipline !==
              "all" &&
            relationship.disciplineId !==
              selectedDiscipline
          ) {
            return false;
          }

          if (
            selectedStatus !== "all" &&
            normalizeValue(
              lifecycleStatus,
            ) !==
              normalizeValue(
                selectedStatus,
              )
          ) {
            return false;
          }

          if (
            selectedAssetType !==
              "all" &&
            normalizeValue(
              relationship.assetTypeReference,
            ) !==
              normalizeValue(
                selectedAssetType,
              )
          ) {
            return false;
          }

          if (
            selectedRepresentation !==
              "all" &&
            normalizeValue(
              relationship.representationType,
            ) !==
              normalizeValue(
                selectedRepresentation,
              )
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const values = [
            relationship.disciplineCode,
            relationship.disciplineName,
            relationship.documentTypeShortCode,
            relationship.documentTypeName,
            relationship.documentTypeDescription,
            relationship.disciplineDocumentTypeShortCode,
            relationship.assetTypeReference,
            relationship.representationType,
            relationship.nativeFileDeliveryTiming,
            lifecycleStatus,
            relationship.reviewType,
            relationship.comment,
          ];

          return values.some((value) =>
            value
              ?.toLowerCase()
              .includes(query),
          );
        },
      );
    }, [
      activePhase,
      phaseRelationships,
      searchQuery,
      selectedAssetType,
      selectedDiscipline,
      selectedRepresentation,
      selectedStatus,
    ]);

  const summary =
    useMemo(() => {
      if (!activePhase) {
        return {
          requirements: 0,
          disciplines: 0,
          documentTypes: 0,
          statuses: 0,
        };
      }

      const disciplines =
        new Set(
          phaseRelationships.map(
            (relationship) =>
              relationship.disciplineId,
          ),
        );

      const documentTypes =
        new Set(
          phaseRelationships.map(
            (relationship) =>
              relationship.documentTypeId,
          ),
        );

      const statuses =
        new Set(
          phaseRelationships
            .map((relationship) =>
              activePhase.statusSelector(
                relationship,
              ),
            )
            .filter(
              (
                value,
              ): value is string =>
                hasExplicitLifecycleRequirement(
                  value,
                ),
            )
            .map(normalizeValue),
        );

      return {
        requirements:
          phaseRelationships.length,
        disciplines: disciplines.size,
        documentTypes:
          documentTypes.size,
        statuses: statuses.size,
      };
    }, [
      activePhase,
      phaseRelationships,
    ]);

  const filtersActive =
    searchQuery.trim().length > 0 ||
    selectedDiscipline !== "all" ||
    selectedStatus !== "all" ||
    selectedAssetType !== "all" ||
    selectedRepresentation !== "all";

  function clearFilters() {
    setSearchQuery("");
    setSelectedDiscipline("all");
    setSelectedStatus("all");
    setSelectedAssetType("all");
    setSelectedRepresentation("all");
  }

  function openPhase(
    phase: LifecyclePhase,
  ) {
    navigate(
      `/lifecycle/${phase.key}`,
    );
  }

  if (state.status === "loading") {
    return (
      <LifecycleStatus
        icon={
          <LoaderCircle
            className="lifecycle-spinner"
            size={26}
          />
        }
        title="Loading Lifecycle Requirements"
        message="Reading the CFIHOS Discipline–Document Type lifecycle requirements…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <LifecycleStatus
        icon={
          <CircleAlert size={26} />
        }
        title="Unable to load Lifecycle Requirements"
        message={state.message}
      />
    );
  }

  if (!activePhase) {
    return (
      <LifecycleStatus
        icon={<CircleAlert size={26} />}
        title="Lifecycle phases not available"
        message="The CFIHOS handover event master did not provide a usable lifecycle phase."
      />
    );
  }

  return (
    <div className="lifecycle-page">
      <div className="lifecycle-page-inner">
        <header className="lifecycle-header">
          <div className="lifecycle-eyebrow">
            Information lifecycle
          </div>

          <h1>Lifecycle Requirements</h1>

          <p>
            Explore the CFIHOS document
            requirements for each project lifecycle
            phase, organised by Discipline and
            Document Type.
          </p>
        </header>

        <div className="lifecycle-phase-grid">
          {state.phases.map(
            (phase, index) => {
              const active =
                phase.key ===
                activePhase.key;

              const count =
                phaseCounts.get(
                  phase.key,
                ) ?? 0;

              return (
                <button
                  key={phase.key}
                  type="button"
                  className={`lifecycle-phase-card ${
                    active
                      ? "lifecycle-phase-card-active"
                      : ""
                  }`}
                  onClick={() =>
                    openPhase(phase)
                  }
                >
                  <div className="lifecycle-phase-index">
                    {String(
                      index + 1,
                    ).padStart(2, "0")}
                  </div>

                  <div className="lifecycle-phase-label">
                    {phase.label}
                  </div>

                  <div className="lifecycle-phase-count">
                    {count}
                    <span>
                      requirements
                    </span>
                  </div>
                </button>
              );
            },
          )}
        </div>

        <section className="lifecycle-phase-overview">
          <div className="lifecycle-phase-overview-heading">
            <div>
              <div className="lifecycle-eyebrow">
                Selected phase
              </div>

              <h2>
                {activePhase.label}
              </h2>

              <p>
                {activePhase.handoverEvent.description ??
                  "Relationships with an explicit CFIHOS required document status for this lifecycle phase."}
                {" "}
                ({activePhase.handoverEvent.id})
              </p>
            </div>

            <div className="lifecycle-phase-position">
              {state.phases.findIndex(
                (phase) =>
                  phase.key ===
                  activePhase.key,
              ) + 1}
              <span>/ {state.phases.length}</span>
            </div>
          </div>

          <div className="lifecycle-summary-grid">
            <SummaryCard
              value={summary.requirements}
              label="Requirements"
            />

            <SummaryCard
              value={summary.disciplines}
              label="Disciplines"
            />

            <SummaryCard
              value={summary.documentTypes}
              label="Document Types"
            />

            <SummaryCard
              value={summary.statuses}
              label="Required statuses"
            />
          </div>
        </section>

        <section className="lifecycle-browser-section">
          <div className="lifecycle-browser-heading">
            <div>
              <div className="lifecycle-eyebrow">
                Requirement browser
              </div>

              <h2>
                Discipline × Document Type
              </h2>

              <p>
                The status shown is the CFIHOS
                requirement for{" "}
                {activePhase.label}, not the actual
                status of a project document.
              </p>
            </div>

            <span className="lifecycle-result-badge">
              {filtersActive
                ? `${filteredRelationships.length} / ${phaseRelationships.length}`
                : phaseRelationships.length}
            </span>
          </div>

          <div className="lifecycle-filter-panel">
            <div className="lifecycle-search">
              <Search size={16} />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search discipline, document type, context, status..."
                aria-label="Search lifecycle requirements"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  aria-label="Clear lifecycle search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="lifecycle-filter-row">
              <Filter size={15} />

              <select
                value={selectedDiscipline}
                onChange={(event) =>
                  setSelectedDiscipline(
                    event.target.value,
                  )
                }
                aria-label="Filter by Discipline"
              >
                <option value="all">
                  All Disciplines
                </option>

                {disciplineOptions.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>

              <select
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value,
                  )
                }
                aria-label="Filter by required status"
              >
                <option value="all">
                  All statuses
                </option>

                {statusOptions.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ),
                )}
              </select>

              <select
                value={selectedAssetType}
                onChange={(event) =>
                  setSelectedAssetType(
                    event.target.value,
                  )
                }
                aria-label="Filter by asset type"
              >
                <option value="all">
                  All asset types
                </option>

                {assetTypeOptions.map(
                  (assetType) => (
                    <option
                      key={assetType}
                      value={assetType}
                    >
                      {assetType}
                    </option>
                  ),
                )}
              </select>

              <select
                value={
                  selectedRepresentation
                }
                onChange={(event) =>
                  setSelectedRepresentation(
                    event.target.value,
                  )
                }
                aria-label="Filter by representation"
              >
                <option value="all">
                  All representations
                </option>

                {representationOptions.map(
                  (representation) => (
                    <option
                      key={representation}
                      value={representation}
                    >
                      {representation}
                    </option>
                  ),
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  className="lifecycle-clear-filters"
                  onClick={clearFilters}
                >
                  <X size={13} />
                  Clear
                </button>
              )}
            </div>

            <div className="lifecycle-filter-summary">
              Showing{" "}
              <strong>
                {filteredRelationships.length}
              </strong>{" "}
              of{" "}
              <strong>
                {phaseRelationships.length}
              </strong>{" "}
              explicit requirements for{" "}
              <strong>
                {activePhase.label}
              </strong>
            </div>
          </div>

          {filteredRelationships.length ===
          0 ? (
            <div className="lifecycle-empty-results">
              No lifecycle requirements match the
              current filters.
            </div>
          ) : (
            <LifecycleRequirementsTable
              relationships={
                filteredRelationships
              }
              activePhase={activePhase}
              onOpenDiscipline={(
                disciplineId,
              ) =>
                navigate(
                  `/disciplines/${encodeURIComponent(
                    disciplineId,
                  )}`,
                )
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
        </section>
      </div>
    </div>
  );
}

type LifecycleRequirementsTableProps = {
  relationships:
    CfihosDisciplineDocumentType[];
  activePhase: LifecyclePhase;
  onOpenDiscipline: (
    disciplineId: string,
  ) => void;
  onOpenDocumentType: (
    documentTypeId: string,
  ) => void;
};

function LifecycleRequirementsTable({
  relationships,
  activePhase,
  onOpenDiscipline,
  onOpenDocumentType,
}: LifecycleRequirementsTableProps) {
  return (
    <div className="lifecycle-table-wrapper">
      <table className="lifecycle-table">
        <thead>
          <tr>
            <th>Discipline</th>
            <th>Document Type</th>
            <th>Context</th>
            <th>Required status</th>
            <th>Asset type</th>
            <th>Representation</th>
            <th>Delivery timing</th>
          </tr>
        </thead>

        <tbody>
          {relationships.map(
            (relationship) => {
              const requiredStatus =
                activePhase.statusSelector(
                  relationship,
                );

              return (
                <tr key={relationship.id}>
                  <td>
                    <button
                      type="button"
                      className="lifecycle-entity-link"
                      onClick={() =>
                        onOpenDiscipline(
                          relationship.disciplineId,
                        )
                      }
                    >
                      <span className="lifecycle-entity-code">
                        {
                          relationship.disciplineCode
                        }
                      </span>

                      <span>
                        {
                          relationship.disciplineName
                        }
                      </span>

                      <ArrowRight
                        size={12}
                      />
                    </button>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="lifecycle-document-link"
                      onClick={() =>
                        onOpenDocumentType(
                          relationship.documentTypeId,
                        )
                      }
                    >
                      <span className="lifecycle-document-title">
                        {
                          relationship.documentTypeName
                        }
                      </span>

                      <span className="lifecycle-document-code">
                        {
                          relationship.documentTypeShortCode
                        }
                      </span>
                    </button>
                  </td>

                  <td>
                    <span className="lifecycle-context-code">
                      {displayValue(
                        relationship.disciplineDocumentTypeShortCode,
                      )}
                    </span>
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        requiredStatus ??
                        "—"
                      }
                    />
                  </td>

                  <td>
                    {displayValue(
                      relationship.assetTypeReference,
                    )}
                  </td>

                  <td>
                    {displayValue(
                      relationship.representationType,
                    )}
                  </td>

                  <td>
                    {displayValue(
                      relationship.nativeFileDeliveryTiming,
                    )}
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className="lifecycle-status-badge">
      {status}
    </span>
  );
}

function SummaryCard({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="lifecycle-summary-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function LifecycleStatus({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="lifecycle-status-page">
      <div className="lifecycle-status-icon">
        {icon}
      </div>

      <h1>{title}</h1>

      <p>{message}</p>
    </div>
  );
}

function hasExplicitLifecycleRequirement(
  value: string | null,
): value is string {
  if (!value) {
    return false;
  }

  const normalized =
    normalizeValue(value);

  if (!normalized) {
    return false;
  }

  const nonRequirementValues =
    new Set([
      "-",
      "—",
      "not specified",
      "n/a",
      "na",
      "not applicable",
    ]);

  return !nonRequirementValues.has(
    normalized,
  );
}

function displayValue(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const trimmed = value.trim();

  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "—"
  ) {
    return "—";
  }

  return value;
}

function normalizeValue(
  value: string | null,
): string {
  return (
    value
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function uniqueStrings(
  values: string[],
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value.trim(),
        )
        .filter(Boolean),
    ),
  ).sort((a, b) =>
    a.localeCompare(
      b,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );
}

type SelectOption = {
  value: string;
  label: string;
};

function uniqueSortedOptions(
  options: SelectOption[],
): SelectOption[] {
  const unique =
    new Map<
      string,
      SelectOption
    >();

  for (const option of options) {
    if (
      !unique.has(
        option.value,
      )
    ) {
      unique.set(
        option.value,
        option,
      );
    }
  }

  return Array.from(
    unique.values(),
  ).sort((a, b) =>
    a.label.localeCompare(
      b.label,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );
}