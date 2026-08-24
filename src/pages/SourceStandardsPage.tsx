import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Database,
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
  cfihosSourceStandardRepository,
} from "../cfihos/repository/CfihosSourceStandardRepository";
import type {
  CfihosClassPropertySourceStandard,
  CfihosClassSourceStandard,
  CfihosSourceStandard,
  CfihosSourceStandardPicklistValue,
  CfihosSourceStandardUsage,
} from "../cfihos/model/sourceStandard";
import {
  cfihosJip33RequirementRepository,
} from "../cfihos/repository/CfihosJip33RequirementRepository";
import type {
  CfihosJip33Requirement,
} from "../cfihos/model/jip33Requirement";
import "./SourceStandardsPage.css";

const COLLAPSE_THRESHOLD = 10;
const COLLAPSED_ITEM_COUNT = 5;

function visibleItems<T>(items: T[], expanded: boolean): T[] {
  return items.length > COLLAPSE_THRESHOLD && !expanded
    ? items.slice(0, COLLAPSED_ITEM_COUNT)
    : items;
}

type ExpansionControlProps = {
  expanded: boolean;
  total: number;
  label: string;
  controls: string;
  onToggle: () => void;
};

function ExpansionControl({
  expanded,
  total,
  label,
  controls,
  onToggle,
}: ExpansionControlProps) {
  if (total <= COLLAPSE_THRESHOLD) {
    return null;
  }

  return (
    <div className="source-standard-expansion-control">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onToggle}
      >
        {expanded ? "Show less" : `Show all ${total} ${label}`}
        <ChevronDown
          size={15}
          className={
            expanded
              ? "source-standard-expansion-chevron-open"
              : undefined
          }
        />
      </button>

      {!expanded && (
        <span>
          Showing first {COLLAPSED_ITEM_COUNT} of {total}
        </span>
      )}
    </div>
  );
}


type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      standards: CfihosSourceStandard[];
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
      usage: CfihosSourceStandardUsage;
    }
  | {
      status: "error";
      message: string;
    };

export function SourceStandardsPage() {
  const navigate = useNavigate();
  const { sourceStandardId } = useParams();

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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const standards =
          await cfihosSourceStandardRepository.getSourceStandards();

        if (!active) {
          return;
        }

        setState({
          status: "success",
          standards,
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
              : "Unable to load CFIHOS Source Standards.",
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
      if (!sourceStandardId) {
        setDetailState({
          status: "idle",
        });

        return;
      }

      setDetailState({
        status: "loading",
      });

      try {
        const usage =
          await cfihosSourceStandardRepository.getSourceStandardUsage(
            sourceStandardId,
          );

        if (!active) {
          return;
        }

        if (!usage) {
          setDetailState({
            status: "error",
            message: `No CFIHOS Source Standard was found for ${sourceStandardId}.`,
          });

          return;
        }

        setDetailState({
          status: "success",
          usage,
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
              : "Unable to load the selected Source Standard.",
        });
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [
    sourceStandardId,
    state.status,
  ]);

  const filteredStandards =
    useMemo(() => {
      if (state.status !== "success") {
        return [];
      }

      const query = searchQuery
        .trim()
        .toLowerCase();

      if (!query) {
        return state.standards;
      }

      return state.standards.filter(
        (standard) => {
          const values = [
            standard.id,
            standard.code,
            standard.description,
          ];

          return values.some((value) =>
            value
              ?.toLowerCase()
              .includes(query),
          );
        },
      );
    }, [searchQuery, state]);

  function openStandard(
    standard: CfihosSourceStandard,
  ) {
    navigate(
      `/standards/${encodeURIComponent(
        standard.id,
      )}`,
    );
  }

  if (state.status === "loading") {
    return (
      <SourceStandardStatus
        icon={
          <LoaderCircle
            className="source-standard-spinner"
            size={24}
          />
        }
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
            <div className="source-standard-page-eyebrow">
              Reference
            </div>

            <h1>Source Standards</h1>
          </div>

          <span className="source-standard-count">
            {state.standards.length}
          </span>
        </div>

        <div className="source-standard-search">
          <Search size={16} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search standards..."
            aria-label="Search Source Standards"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() =>
                setSearchQuery("")
              }
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
          {filteredStandards.map(
            (standard) => (
              <button
                type="button"
                key={standard.id}
                className={`source-standard-list-item ${
                  standard.id ===
                  sourceStandardId
                    ? "source-standard-list-item-selected"
                    : ""
                }`}
                onClick={() =>
                  openStandard(standard)
                }
              >
                <span className="source-standard-list-code">
                  {standard.code}
                </span>

                <span className="source-standard-list-description">
                  {standard.description ??
                    "No description"}
                </span>

                <span className="source-standard-list-id">
                  {standard.id}
                </span>
              </button>
            ),
          )}
        </div>
      </aside>

      <main className="source-standard-detail">
        {detailState.status ===
          "idle" && (
          <SourceStandardEmpty />
        )}

        {detailState.status ===
          "loading" && (
          <SourceStandardStatus
            icon={
              <LoaderCircle
                className="source-standard-spinner"
                size={22}
              />
            }
            title="Loading Source Standard"
            message="Resolving classes, property provenance and picklist references…"
          />
        )}

        {detailState.status ===
          "error" && (
          <SourceStandardStatus
            icon={
              <CircleAlert size={22} />
            }
            title="Source Standard not available"
            message={
              detailState.message
            }
          />
        )}

        {detailState.status ===
          "success" && (
          <SourceStandardDetails
            usage={detailState.usage}
            onOpenTagClass={(
              tagClassId,
            ) =>
              navigate(
                `/classes/tag/${encodeURIComponent(
                  tagClassId,
                )}`,
              )
            }
            onOpenEquipmentClass={(
              equipmentClassId,
            ) =>
              navigate(
                `/classes/equipment/${encodeURIComponent(
                  equipmentClassId,
                )}`,
              )
            }
            onOpenProperty={(
              propertyId,
            ) =>
              navigate(
                `/dictionary/${encodeURIComponent(
                  propertyId,
                )}`,
              )
            }
          />
        )}
      </main>
    </div>
  );
}

type SourceStandardDetailsProps = {
  usage: CfihosSourceStandardUsage;
  onOpenTagClass: (
    tagClassId: string,
  ) => void;
  onOpenEquipmentClass: (
    equipmentClassId: string,
  ) => void;
  onOpenProperty: (
    propertyId: string,
  ) => void;
};

function SourceStandardDetails({
  usage,
  onOpenTagClass,
  onOpenEquipmentClass,
  onOpenProperty,
}: SourceStandardDetailsProps) {
  const {
    standard,
    classRelationships,
    propertyRelationships,
    picklistValues,
  } = usage;

  const [classesExpanded, setClassesExpanded] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [picklistExpanded, setPicklistExpanded] = useState(false);
  const [jip33Available, setJip33Available] = useState<boolean | null>(null);

  useEffect(() => {
    setClassesExpanded(false);
    setPropertiesExpanded(false);
    setPicklistExpanded(false);
    setJip33Available(null);
  }, [standard.id]);

  const uniqueClasses =
    useMemo(() => {
      const seen =
        new Set<string>();

      return classRelationships.filter(
        (relationship) => {
          const key = [
            relationship.classId,
            relationship.className,
            relationship.tagClassId ?? "",
            relationship.equipmentClassId ??
              "",
          ].join("|");

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        },
      );
    }, [classRelationships]);

  const visibleClasses = visibleItems(uniqueClasses, classesExpanded);
  const visibleProperties = visibleItems(propertyRelationships, propertiesExpanded);
  const visiblePicklistValues = visibleItems(picklistValues, picklistExpanded);

  return (
    <div className="source-standard-details-content">
      <header className="source-standard-header">
        <div className="source-standard-page-eyebrow">
          Source Standard
        </div>

        <div className="source-standard-title-row">
          <div>
            <h1>{standard.code}</h1>

            <div className="source-standard-id">
              <Hash size={14} />
              {standard.id}
            </div>
          </div>

          <div className="source-standard-header-badges">
            {standard.stillToBeCompleted ? (
              <span className="source-standard-badge source-standard-badge-warning">
                <AlertTriangle
                  size={13}
                />
                To be completed
              </span>
            ) : (
              <span className="source-standard-badge">
                Complete
              </span>
            )}
          </div>
        </div>

        {standard.description && (
          <p className="source-standard-description">
            {standard.description}
          </p>
        )}
      </header>

      <div className="source-standard-info-grid">
        <SourceStandardCard title="Reference">
          <SourceStandardRow label="Code">
            {standard.code}
          </SourceStandardRow>

          <SourceStandardRow label="CFIHOS code">
            {standard.id}
          </SourceStandardRow>

          <SourceStandardRow label="Completion status">
            {standard.stillToBeCompleted
              ? "Still to be completed"
              : "Complete"}
          </SourceStandardRow>
        </SourceStandardCard>

        <SourceStandardCard title="Usage">
          <SourceStandardRow label="Classes">
            {uniqueClasses.length}
          </SourceStandardRow>

          <SourceStandardRow label="Property mappings">
            {propertyRelationships.length}
          </SourceStandardRow>

          <SourceStandardRow label="Picklist values">
            {picklistValues.length}
          </SourceStandardRow>
        </SourceStandardCard>
      </div>

      <nav
        className="source-standard-page-contents"
        aria-label="On this page"
      >
        <span>On this page</span>
        <a href="#source-standard-classes">Classes</a>
        {jip33Available !== false && (
          <a href="#source-standard-jip33">JIP33 Information Requirements</a>
        )}
        <a href="#source-standard-properties">Property mappings</a>
        <a href="#source-standard-picklist-values">Picklist values</a>
      </nav>

      <section
        id="source-standard-classes"
        className="source-standard-section source-standard-section-anchor"
      >
        <div className="source-standard-section-heading">
          <div>
            <div className="source-standard-page-eyebrow">
              Class usage
            </div>

            <h2>Classes</h2>

            <p>
              Tag and Equipment Classes that
              reference this Source Standard.
            </p>
          </div>

          <span className="source-standard-section-count">
            {uniqueClasses.length}
          </span>
        </div>

        {uniqueClasses.length === 0 ? (
          <SourceStandardEmptyPanel>
            No direct class references exist for
            this Source Standard.
          </SourceStandardEmptyPanel>
        ) : (
          <>
          <ClassUsageTable
            relationships={
              visibleClasses
            }
            tableId="source-standard-classes-list"
            onOpenTagClass={
              onOpenTagClass
            }
            onOpenEquipmentClass={
              onOpenEquipmentClass
            }
          />
          <ExpansionControl
            expanded={classesExpanded}
            total={uniqueClasses.length}
            label="classes"
            controls="source-standard-classes-list"
            onToggle={() => setClassesExpanded((current) => !current)}
          />
          </>
        )}
      </section>

      <Jip33SourceStandardSection
        sourceStandardId={standard.id}
        onOpenTagClass={onOpenTagClass}
        onAvailabilityChange={setJip33Available}
      />

      <section
        id="source-standard-properties"
        className="source-standard-section source-standard-section-anchor"
      >
        <div className="source-standard-section-heading">
          <div>
            <div className="source-standard-page-eyebrow">
              Provenance
            </div>

            <h2>Property mappings</h2>

            <p>
              Class-property assignments traced
              back to this Source Standard,
              including source section and original
              terminology.
            </p>
          </div>

          <span className="source-standard-section-count">
            {propertyRelationships.length}
          </span>
        </div>

        {propertyRelationships.length ===
        0 ? (
          <SourceStandardEmptyPanel>
            No property provenance mappings exist
            for this Source Standard.
          </SourceStandardEmptyPanel>
        ) : (
          <>
          <PropertyUsageTable
            relationships={
              visibleProperties
            }
            tableId="source-standard-properties-list"
            onOpenTagClass={
              onOpenTagClass
            }
            onOpenEquipmentClass={
              onOpenEquipmentClass
            }
            onOpenProperty={
              onOpenProperty
            }
          />
          <ExpansionControl
            expanded={propertiesExpanded}
            total={propertyRelationships.length}
            label="property mappings"
            controls="source-standard-properties-list"
            onToggle={() => setPropertiesExpanded((current) => !current)}
          />
          </>
        )}
      </section>

      <section
        id="source-standard-picklist-values"
        className="source-standard-section source-standard-section-anchor"
      >
        <div className="source-standard-section-heading">
          <div>
            <div className="source-standard-page-eyebrow">
              Controlled values
            </div>

            <h2>Picklist values</h2>

            <p>
              Controlled property values that
              explicitly reference this Source
              Standard.
            </p>
          </div>

          <span className="source-standard-section-count">
            {picklistValues.length}
          </span>
        </div>

        {picklistValues.length === 0 ? (
          <SourceStandardEmptyPanel>
            No picklist values reference this Source
            Standard.
          </SourceStandardEmptyPanel>
        ) : (
          <>
          <PicklistValueTable
            values={visiblePicklistValues}
            tableId="source-standard-picklist-values-list"
          />
          <ExpansionControl
            expanded={picklistExpanded}
            total={picklistValues.length}
            label="picklist values"
            controls="source-standard-picklist-values-list"
            onToggle={() => setPicklistExpanded((current) => !current)}
          />
          </>
        )}
      </section>
    </div>
  );
}

function Jip33SourceStandardSection({
  sourceStandardId,
  onOpenTagClass,
  onAvailabilityChange,
}: {
  sourceStandardId: string;
  onOpenTagClass: (tagClassId: string) => void;
  onAvailabilityChange: (available: boolean | null) => void;
}) {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState<CfihosJip33Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setExpanded(false);
    onAvailabilityChange(null);
    cfihosJip33RequirementRepository
      .getRequirementsForSourceStandard(sourceStandardId)
      .then((items) => {
        if (active) {
          setRequirements(items);
          onAvailabilityChange(items.length > 0);
        }
      })
      .catch((error) => {
        if (active) {
          setRequirements([]);
          onAvailabilityChange(false);
          console.error("Unable to load JIP33 Source Standard requirements.", error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [sourceStandardId, onAvailabilityChange]);

  if (!loading && requirements.length === 0) return null;

  const mappings = requirements.flatMap((requirement) =>
    requirement.mappings
      .filter((mapping) => mapping.sourceStandardId === sourceStandardId)
      .map((mapping) => ({ requirement, mapping })),
  );

  const classCount = new Set(mappings.map(({ mapping }) => mapping.tagClassId)).size;
  const documentCount = new Set(mappings.map(({ mapping }) => mapping.documentTypeId)).size;
  const visibleMappings = visibleItems(mappings, expanded);

  return (
    <>
      <style>{`
        .source-standard-jip33-summary { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
        .source-standard-jip33-summary span { padding:7px 9px; border-radius:7px; background:var(--brand-soft); color:var(--brand-dark); font-size:10.5px; }
        .source-standard-jip33-list { overflow:hidden; border:1px solid var(--line); border-radius:10px; background:#fff; }
        .source-standard-jip33-row { display:grid; grid-template-columns:minmax(240px,1.5fr) minmax(170px,.8fr) minmax(180px,.9fr) minmax(150px,.7fr); gap:14px; align-items:center; padding:12px 14px; border-bottom:1px solid #edf1f0; }
        .source-standard-jip33-row:last-child { border-bottom:0; }
        .source-standard-jip33-row > div { display:grid; gap:3px; }
        .source-standard-jip33-row strong { color:var(--ink); font-size:11.5px; }
        .source-standard-jip33-row > div > span, .source-standard-jip33-row > span { color:var(--muted); font-size:10.5px; }
        .source-standard-jip33-row button { display:inline-flex; align-items:center; gap:4px; padding:0; border:0; background:transparent; color:var(--brand-dark); font-size:11px; font-weight:700; text-align:left; cursor:pointer; }
        @media (max-width:900px) { .source-standard-jip33-row { grid-template-columns:1fr; } }
      `}</style>
      <section
        id="source-standard-jip33"
        className="source-standard-section source-standard-section-anchor source-standard-jip33-section"
      >
      <div className="source-standard-section-heading">
        <div>
          <div className="source-standard-page-eyebrow">Specification overlay</div>
          <h2>JIP33 Information Requirements</h2>
          <p>
            Detailed document and data requirements defined by this JIP33 Source
            Standard, mapped to Tag Classes and Document Types.
          </p>
        </div>
        {!loading && (
          <span className="source-standard-section-count">{requirements.length}</span>
        )}
      </div>

      {loading ? (
        <SourceStandardEmptyPanel>Loading JIP33 requirements…</SourceStandardEmptyPanel>
      ) : (
        <>
          <div className="source-standard-jip33-summary">
            <span><strong>{requirements.length}</strong> requirements</span>
            <span><strong>{classCount}</strong> Tag Classes</span>
            <span><strong>{documentCount}</strong> Document Types</span>
          </div>
          <div id="source-standard-jip33-list" className="source-standard-jip33-list">
            {visibleMappings.map(({ requirement, mapping }, index) => (
              <div
                className="source-standard-jip33-row"
                key={`${requirement.id}-${mapping.tagClassId}-${mapping.documentTypeId}-${index}`}
              >
                <div>
                  <strong>{requirement.number ?? requirement.title ?? requirement.id}</strong>
                  {requirement.title && requirement.title !== requirement.number && (
                    <span>{requirement.title}</span>
                  )}
                </div>
                <button type="button" onClick={() => onOpenTagClass(mapping.tagClassId)}>
                  {mapping.tagClassName}<ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${encodeURIComponent(mapping.documentTypeId)}`)}
                >
                  {mapping.documentTypeName}<ChevronRight size={13} />
                </button>
                <span>{requirement.requirementGroupCode ?? "JIP33"}</span>
              </div>
            ))}
          </div>
          <ExpansionControl
            expanded={expanded}
            total={mappings.length}
            label="JIP33 mappings"
            controls="source-standard-jip33-list"
            onToggle={() => setExpanded((current) => !current)}
          />
        </>
      )}
      </section>
    </>
  );
}

type ClassUsageTableProps = {
  relationships:
    CfihosClassSourceStandard[];
  tableId?: string;
  onOpenTagClass: (
    tagClassId: string,
  ) => void;
  onOpenEquipmentClass: (
    equipmentClassId: string,
  ) => void;
};

function ClassUsageTable({
  relationships,
  tableId,
  onOpenTagClass,
  onOpenEquipmentClass,
}: ClassUsageTableProps) {
  return (
    <div className="source-standard-table-wrapper">
      <table id={tableId} className="source-standard-table source-standard-class-table">
        <thead>
          <tr>
            <th>Class</th>
            <th>Raw CFIHOS ID</th>
            <th>Available views</th>
          </tr>
        </thead>

        <tbody>
          {relationships.map(
            (relationship, index) => (
              <tr
                key={`${relationship.classId}-${relationship.sourceStandardId}-${index}`}
              >
                <td>
                  <div className="source-standard-class-name">
                    {relationship.className}
                  </div>

                  <div className="source-standard-class-domain">
                    {formatDomain(
                      relationship,
                    )}
                  </div>
                </td>

                <td className="source-standard-mono">
                  {relationship.classId}
                </td>

                <td>
                  <ClassNavigation
                    relationship={
                      relationship
                    }
                    onOpenTagClass={
                      onOpenTagClass
                    }
                    onOpenEquipmentClass={
                      onOpenEquipmentClass
                    }
                  />
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

type PropertyUsageTableProps = {
  relationships:
    CfihosClassPropertySourceStandard[];
  tableId?: string;
  onOpenTagClass: (
    tagClassId: string,
  ) => void;
  onOpenEquipmentClass: (
    equipmentClassId: string,
  ) => void;
  onOpenProperty: (
    propertyId: string,
  ) => void;
};

function PropertyUsageTable({
  relationships,
  tableId,
  onOpenTagClass,
  onOpenEquipmentClass,
  onOpenProperty,
}: PropertyUsageTableProps) {
  return (
    <div className="source-standard-table-wrapper">
      <table id={tableId} className="source-standard-table source-standard-property-table">
        <thead>
          <tr>
            <th>Class</th>
            <th>Property</th>
            <th>Source section</th>
            <th>Source property name</th>
            <th>Sequence</th>
          </tr>
        </thead>

        <tbody>
          {relationships.map(
            (relationship) => (
              <tr key={relationship.id}>
                <td>
                  <div className="source-standard-class-name">
                    {relationship.className}
                  </div>

                  <ClassNavigation
                    relationship={
                      relationship
                    }
                    onOpenTagClass={
                      onOpenTagClass
                    }
                    onOpenEquipmentClass={
                      onOpenEquipmentClass
                    }
                    compact
                  />
                </td>

                <td>
                  <button
                    type="button"
                    className="source-standard-property-link"
                    onClick={() =>
                      onOpenProperty(
                        relationship.propertyId,
                      )
                    }
                  >
                    <span>
                      {
                        relationship.propertyName
                      }
                    </span>

                    <ChevronRight
                      size={13}
                    />
                  </button>

                  <div className="source-standard-property-id">
                    {
                      relationship.propertyId
                    }
                  </div>
                </td>

                <td>
                  {displayValue(
                    relationship.sourceStandardSection,
                  )}
                </td>

                <td>
                  {displayValue(
                    relationship.propertyNameInSourceStandard,
                  )}
                </td>

                <td>
                  {displayValue(
                    relationship.propertySequenceNumber,
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

type PicklistValueTableProps = {
  values:
    CfihosSourceStandardPicklistValue[];
  tableId?: string;
};

function PicklistValueTable({
  values,
  tableId,
}: PicklistValueTableProps) {
  return (
    <div className="source-standard-table-wrapper">
      <table id={tableId} className="source-standard-table source-standard-picklist-table">
        <thead>
          <tr>
            <th>Picklist</th>
            <th>Value</th>
            <th>Description</th>
            <th>CFIHOS value ID</th>
          </tr>
        </thead>

        <tbody>
          {values.map((value) => (
            <tr key={value.valueId}>
              <td>
                <div className="source-standard-picklist-name">
                  {value.picklistName}
                </div>

                <div className="source-standard-property-id">
                  {value.picklistId}
                </div>
              </td>

              <td>
                <strong>
                  {value.valueCode}
                </strong>
              </td>

              <td>
                {value.valueDescription ??
                  "—"}
              </td>

              <td className="source-standard-mono">
                {value.valueId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ClassNavigationProps = {
  relationship:
    | CfihosClassSourceStandard
    | CfihosClassPropertySourceStandard;
  onOpenTagClass: (
    tagClassId: string,
  ) => void;
  onOpenEquipmentClass: (
    equipmentClassId: string,
  ) => void;
  compact?: boolean;
};

function ClassNavigation({
  relationship,
  onOpenTagClass,
  onOpenEquipmentClass,
  compact = false,
}: ClassNavigationProps) {
  if (
    !relationship.tagClassId &&
    !relationship.equipmentClassId
  ) {
    return (
      <span className="source-standard-unresolved">
        Unresolved
      </span>
    );
  }

  return (
    <div
      className={`source-standard-class-links ${
        compact
          ? "source-standard-class-links-compact"
          : ""
      }`}
    >
      {relationship.tagClassId && (
        <button
          type="button"
          onClick={() =>
            onOpenTagClass(
              relationship.tagClassId!,
            )
          }
        >
          Tag Class
          <ChevronRight size={12} />
        </button>
      )}

      {relationship.equipmentClassId && (
        <button
          type="button"
          onClick={() =>
            onOpenEquipmentClass(
              relationship.equipmentClassId!,
            )
          }
        >
          Equipment Class
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

function formatDomain(
  relationship:
    CfihosClassSourceStandard,
): string {
  if (
    relationship.tagClassId &&
    relationship.equipmentClassId
  ) {
    return "Tag + Equipment";
  }

  if (relationship.tagClassId) {
    return "Tag Class";
  }

  if (
    relationship.equipmentClassId
  ) {
    return "Equipment Class";
  }

  return "Unresolved";
}

type SourceStandardCardProps = {
  title: string;
  children: ReactNode;
};

function SourceStandardCard({
  title,
  children,
}: SourceStandardCardProps) {
  return (
    <section className="source-standard-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type SourceStandardRowProps = {
  label: string;
  children: ReactNode;
};

function SourceStandardRow({
  label,
  children,
}: SourceStandardRowProps) {
  return (
    <div className="source-standard-row">
      <div className="source-standard-row-label">
        {label}
      </div>

      <div className="source-standard-row-value">
        {children}
      </div>
    </div>
  );
}

type SourceStandardEmptyPanelProps = {
  children: ReactNode;
};

function SourceStandardEmptyPanel({
  children,
}: SourceStandardEmptyPanelProps) {
  return (
    <div className="source-standard-empty-panel">
      {children}
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
        Search or browse the CFIHOS Source
        Standard master to explore class usage,
        property provenance and controlled-value
        references.
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
      <div className="source-standard-empty-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{message}</p>
    </div>
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