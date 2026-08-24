import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleAlert,
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
import { useNavigate, useParams } from "react-router-dom";
import {
  cfihosUnitOfMeasureRepository,
} from "../cfihos/repository/CfihosUnitOfMeasureRepository";
import type {
  CfihosUnitOfMeasure,
} from "../cfihos/model/unitOfMeasure";
import {
  cfihosPropertyRepository,
  type CfihosPropertyUsage,
} from "../cfihos/repository/CfihosPropertyRepository";
import type {
  CfihosProperty,
  CfihosPropertyPicklistValue,
} from "../cfihos/model/property";
import "./DataDictionaryPage.css";


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
    <div className="dictionary-expansion-control">
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
              ? "dictionary-expansion-chevron-open"
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
      properties: CfihosProperty[];
    }
  | { status: "error"; message: string };

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      usage: CfihosPropertyUsage;
      picklistValues: CfihosPropertyPicklistValue[];
      dimensionUnits: CfihosUnitOfMeasure[];
    }
  | { status: "error"; message: string };

export function DataDictionaryPage() {
  const navigate = useNavigate();
  const { propertyId } = useParams();

  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  const [detailState, setDetailState] =
    useState<DetailState>({
      status: "idle",
    });

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const properties =
          await cfihosPropertyRepository.getProperties();

        if (!active) {
          return;
        }

        setState({
          status: "success",
          properties,
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
              : "Unable to load the CFIHOS Data Dictionary.",
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

    async function loadProperty() {
      if (!propertyId) {
        setDetailState({
          status: "idle",
        });

        return;
      }

      setDetailState({
        status: "loading",
      });

      try {
        const [usage, picklistValues] =
          await Promise.all([
            cfihosPropertyRepository.getPropertyUsage(
              propertyId,
            ),

            cfihosPropertyRepository.getPicklistValues(
              propertyId,
            ),
          ]);

        const dimensionUnits =
          usage?.property.unitOfMeasureDimensionId
            ? await cfihosUnitOfMeasureRepository.getUnitsForDimension(
                usage.property.unitOfMeasureDimensionId,
              )
            : [];

        if (!active) {
          return;
        }

        if (!usage) {
          setDetailState({
            status: "error",
            message: `No CFIHOS property was found for ${propertyId}.`,
          });

          return;
        }

        setDetailState({
          status: "success",
          usage,
          picklistValues,
          dimensionUnits,
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
              : "Unable to load the selected property.",
        });
      }
    }

    loadProperty();

    return () => {
      active = false;
    };
  }, [propertyId, state.status]);

  const filteredProperties = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }

    const query = searchQuery
      .trim()
      .toLowerCase();

    if (!query) {
      return [...state.properties].sort(compareProperties);
    }

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

        return values.some((value) =>
          value?.toLowerCase().includes(query),
        );
      })
      .sort(compareProperties);
  }, [searchQuery, state]);

  function openProperty(property: CfihosProperty) {
    navigate(
      `/dictionary/${encodeURIComponent(property.id)}`,
    );
  }

  if (state.status === "loading") {
    return (
      <DictionaryStatus
        icon={
          <LoaderCircle
            className="dictionary-spinner"
            size={24}
          />
        }
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
            <div className="dictionary-eyebrow">
              Reference
            </div>

            <h1>Data Dictionary</h1>
          </div>

          <span className="dictionary-count">
            {state.properties.length}
          </span>
        </div>

        <div className="dictionary-search">
          <Search size={16} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
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
          {filteredProperties.length === 1
            ? "property"
            : "properties"}
        </div>

        <div className="dictionary-property-list">
          {filteredProperties.map((property) => (
            <button
              type="button"
              key={property.id}
              className={`dictionary-property-item ${
                property.id === propertyId
                  ? "dictionary-property-item-selected"
                  : ""
              }`}
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

                {property.picklistName
                  ? ` · ${property.picklistName}`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="dictionary-detail">
        {detailState.status === "idle" && (
          <DictionaryEmpty />
        )}

        {detailState.status === "loading" && (
          <DictionaryStatus
            icon={
              <LoaderCircle
                className="dictionary-spinner"
                size={22}
              />
            }
            title="Loading property"
            message="Resolving property usage and picklist values…"
          />
        )}

        {detailState.status === "error" && (
          <DictionaryStatus
            icon={<CircleAlert size={22} />}
            title="Property not available"
            message={detailState.message}
          />
        )}

        {detailState.status === "success" && (
          <PropertyDetails
            usage={detailState.usage}
            picklistValues={
              detailState.picklistValues
            }
            dimensionUnits={
              detailState.dimensionUnits
            }
            onOpenTagClass={(tagClassId) =>
              navigate(
                `/classes/tag/${encodeURIComponent(
                  tagClassId,
                )}`,
              )
            }
            onOpenUnit={(unitId) =>
              navigate(
                `/units/${encodeURIComponent(unitId)}`,
              )
            }
            onOpenDimension={(dimensionId) =>
              navigate(
                `/units?dimension=${encodeURIComponent(
                  dimensionId,
                )}`,
              )
            }
          />
        )}
      </main>
    </div>
  );
}

type PropertyDetailsProps = {
  usage: CfihosPropertyUsage;
  picklistValues: CfihosPropertyPicklistValue[];
  dimensionUnits: CfihosUnitOfMeasure[];
  onOpenTagClass: (tagClassId: string) => void;
  onOpenUnit: (unitId: string) => void;
  onOpenDimension: (dimensionId: string) => void;
};

function PropertyDetails({
  usage,
  picklistValues,
  dimensionUnits,
  onOpenTagClass,
  onOpenUnit,
  onOpenDimension,
}: PropertyDetailsProps) {
  const { property, tagClasses } = usage;

  const [picklistQuery, setPicklistQuery] =
    useState("");
  const [unitsExpanded, setUnitsExpanded] =
    useState(false);
  const [tagClassesExpanded, setTagClassesExpanded] =
    useState(false);
  const [picklistExpanded, setPicklistExpanded] =
    useState(false);

  useEffect(() => {
    setPicklistQuery("");
    setUnitsExpanded(false);
    setTagClassesExpanded(false);
    setPicklistExpanded(false);
  }, [property.id]);

  const filteredPicklistValues = useMemo(() => {
    const query = picklistQuery
      .trim()
      .toLowerCase();

    if (!query) {
      return picklistValues;
    }

    return picklistValues.filter((value) => {
      const fields = [
        value.code,
        value.description,
        value.sourceStandardCode,
        value.id,
      ];

      return fields.some((field) =>
        field?.toLowerCase().includes(query),
      );
    });
  }, [picklistQuery, picklistValues]);

  const visibleUnits = visibleItems(
    dimensionUnits,
    unitsExpanded,
  );
  const visibleTagClasses = visibleItems(
    tagClasses,
    tagClassesExpanded,
  );
  const visiblePicklistValues = visibleItems(
    filteredPicklistValues,
    picklistExpanded,
  );

  return (
    <div className="dictionary-details-content">
      <header className="dictionary-property-header">
        <div className="dictionary-eyebrow">
          Property
        </div>

        <h1>{property.name}</h1>

        <div className="dictionary-property-code">
          <Hash size={14} />
          {property.id}
        </div>

        {property.definition && (
          <p>{property.definition}</p>
        )}
      </header>

      <div className="dictionary-detail-grid">
        <DictionaryCard title="Definition">
          <DictionaryRow label="Data type">
            {property.dataType ?? "Not specified"}
          </DictionaryRow>

          <DictionaryRow label="Data length">
            {property.dataTypeLength ??
              "Not specified"}
          </DictionaryRow>

          <DictionaryRow label="Dimension">
            {property.unitOfMeasureDimensionId ? (
              <button
                type="button"
                className="dictionary-inline-link"
                onClick={() =>
                  onOpenDimension(
                    property.unitOfMeasureDimensionId!,
                  )
                }
              >
                <span>
                  {property.unitOfMeasureDimensionCode ??
                    property.unitOfMeasureDimensionId}
                </span>
                <ChevronRight size={13} />
              </button>
            ) : (
              "Not specified"
            )}
          </DictionaryRow>
        </DictionaryCard>

        <DictionaryCard title="Reference">
          <DictionaryRow label="Picklist">
            {property.picklistName ??
              "Not applicable"}
          </DictionaryRow>

          <DictionaryRow label="Synonyms">
            {property.synonyms.length > 0
              ? property.synonyms.join(", ")
              : "None"}
          </DictionaryRow>
        </DictionaryCard>
      </div>

      {property.existenceReason && (
        <DictionaryCard title="Existence reason">
          <p className="dictionary-card-paragraph">
            {property.existenceReason}
          </p>
        </DictionaryCard>
      )}

      <nav
        className="dictionary-page-contents"
        aria-label="On this page"
      >
        <span>On this page</span>
        {property.unitOfMeasureDimensionId && (
          <a href="#dictionary-units">Units of Measure</a>
        )}
        <a href="#dictionary-tag-classes">Used by Tag Classes</a>
        {property.picklistName && (
          <a href="#dictionary-picklist-values">Allowed Values</a>
        )}
      </nav>

      {property.unitOfMeasureDimensionId && (
        <section
          id="dictionary-units"
          className="dictionary-section dictionary-section-anchor"
        >
          <div className="dictionary-section-heading">
            <div>
              <div className="dictionary-eyebrow">
                Measurement semantics
              </div>

              <h2>Units of Measure</h2>

              <p className="dictionary-section-description">
                CFIHOS units belonging to dimension{" "}
                <button
                  type="button"
                  className="dictionary-dimension-link"
                  onClick={() =>
                    onOpenDimension(
                      property.unitOfMeasureDimensionId!,
                    )
                  }
                >
                  {property.unitOfMeasureDimensionCode ??
                    property.unitOfMeasureDimensionId}
                  <ChevronRight size={12} />
                </button>
              </p>
            </div>

            <span className="dictionary-section-count">
              {dimensionUnits.length}
            </span>
          </div>

          {dimensionUnits.length === 0 ? (
            <div className="dictionary-empty-panel">
              No Units of Measure were found for this dimension.
            </div>
          ) : (
            <>
              <div
                id="dictionary-units-list"
                className="dictionary-unit-grid"
              >
                {visibleUnits.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    className="dictionary-unit-card"
                    onClick={() => onOpenUnit(unit.id)}
                  >
                    <div>
                      <div className="dictionary-unit-name">
                        {unit.name}
                      </div>
                      <div className="dictionary-unit-meta">
                        {unit.symbol ?? "No symbol"}
                      </div>
                      <div className="dictionary-unit-code">
                        {unit.id}
                      </div>
                    </div>

                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>

              <ExpansionControl
                expanded={unitsExpanded}
                total={dimensionUnits.length}
                label="units"
                controls="dictionary-units-list"
                onToggle={() =>
                  setUnitsExpanded((current) => !current)
                }
              />
            </>
          )}
        </section>
      )}

      <section
        id="dictionary-tag-classes"
        className="dictionary-section dictionary-section-anchor"
      >
        <div className="dictionary-section-heading">
          <div>
            <div className="dictionary-eyebrow">
              Relationships
            </div>

            <h2>Used by Tag Classes</h2>
          </div>

          <span className="dictionary-section-count">
            {tagClasses.length}
          </span>
        </div>

        {tagClasses.length === 0 ? (
          <div className="dictionary-empty-panel">
            No direct Tag Class assignments were found for
            this property.
          </div>
        ) : (
          <div
            id="dictionary-tag-classes-list"
            className="dictionary-class-grid"
          >
            {visibleTagClasses.map((tagClass) => (
              <button
                key={tagClass.id}
                type="button"
                className="dictionary-class-card"
                onClick={() =>
                  onOpenTagClass(tagClass.id)
                }
              >
                <div>
                  <div className="dictionary-class-name">
                    {tagClass.name}
                  </div>

                  <div className="dictionary-class-code">
                    {tagClass.id}
                  </div>
                </div>

                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        )}

        <ExpansionControl
          expanded={tagClassesExpanded}
          total={tagClasses.length}
          label="Tag Classes"
          controls="dictionary-tag-classes-list"
          onToggle={() =>
            setTagClassesExpanded((current) => !current)
          }
        />
      </section>

      {property.picklistName && (
        <section
          id="dictionary-picklist-values"
          className="dictionary-section dictionary-section-anchor"
        >
          <div className="dictionary-section-heading">
            <div>
              <div className="dictionary-eyebrow">
                Allowed values
              </div>

              <h2>{property.picklistName}</h2>

              {property.picklistId && (
                <div className="dictionary-picklist-code">
                  {property.picklistId}
                </div>
              )}
            </div>

            <span className="dictionary-section-count">
              {picklistValues.length}
            </span>
          </div>

          {picklistValues.length === 0 ? (
            <div className="dictionary-empty-panel">
              No picklist values were found.
            </div>
          ) : (
            <>
              <div className="dictionary-picklist-search">
                <Search size={16} />

                <input
                  type="search"
                  value={picklistQuery}
                  onChange={(event) =>
                    setPicklistQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search picklist values..."
                  aria-label="Search picklist values"
                />

                {picklistQuery && (
                  <button
                    type="button"
                    onClick={() =>
                      setPicklistQuery("")
                    }
                    aria-label="Clear picklist search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="dictionary-filter-count">
                {filteredPicklistValues.length} of{" "}
                {picklistValues.length} values
              </div>

              <div
                id="dictionary-picklist-values-list"
                className="dictionary-picklist-table-wrapper"
              >
                <table className="dictionary-picklist-table">
                  <thead>
                    <tr>
                      <th>Value</th>
                      <th>Description</th>
                      <th>Source standard</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visiblePicklistValues.map(
                      (value) => (
                        <tr key={value.id}>
                          <td>
                            <div className="dictionary-picklist-value">
                              {value.code}
                            </div>

                            <div className="dictionary-picklist-id">
                              {value.id}
                            </div>
                          </td>

                          <td>
                            {value.description ?? "—"}
                          </td>

                          <td>
                            {value.sourceStandardCode ??
                              "—"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <ExpansionControl
                expanded={picklistExpanded}
                total={filteredPicklistValues.length}
                label="values"
                controls="dictionary-picklist-values-list"
                onToggle={() =>
                  setPicklistExpanded((current) => !current)
                }
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

type DictionaryCardProps = {
  title: string;
  children: ReactNode;
};

function DictionaryCard({
  title,
  children,
}: DictionaryCardProps) {
  return (
    <section className="dictionary-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type DictionaryRowProps = {
  label: string;
  children: ReactNode;
};

function DictionaryRow({
  label,
  children,
}: DictionaryRowProps) {
  return (
    <div className="dictionary-row">
      <div className="dictionary-row-label">
        {label}
      </div>

      <div className="dictionary-row-value">
        {children}
      </div>
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
        Search or browse the CFIHOS Data Dictionary
        to view definitions, datatype information,
        picklists and Tag Class usage.
      </p>
    </div>
  );
}

type DictionaryStatusProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function DictionaryStatus({
  icon,
  title,
  message,
}: DictionaryStatusProps) {
  return (
    <div className="dictionary-empty">
      <div className="dictionary-empty-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function compareProperties(
  a: CfihosProperty,
  b: CfihosProperty,
): number {
  return a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}