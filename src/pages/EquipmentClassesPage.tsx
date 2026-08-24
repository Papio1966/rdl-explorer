import {
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
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
  cfihosEquipmentRepository,
} from "../cfihos/repository/CfihosEquipmentRepository";
import type {
  CfihosEffectiveEquipmentClassProperty,
  CfihosEquipmentClass,
  CfihosEquipmentClassTreeNode,
} from "../cfihos/model/equipmentClass";
import {
  cfihosClassRelationshipRepository,
} from "../cfihos/repository/CfihosClassRelationshipRepository";
import type {
  CfihosResolvedTagEquipmentClassRelationship,
} from "../cfihos/model/classRelationship";
import {
  cfihosSourceStandardRepository,
} from "../cfihos/repository/CfihosSourceStandardRepository";
import type {
  CfihosClassPropertySourceStandard,
  CfihosClassSourceStandard,
} from "../cfihos/model/sourceStandard";
import {
  cfihosClassDocumentRepository,
} from "../cfihos/repository/CfihosClassDocumentRepository";
import type {
  CfihosResolvedClassDocumentRequirement,
} from "../cfihos/model/classDocumentRequirement";
import {
  cfihosPropertyGroupingRepository,
} from "../cfihos/repository/CfihosPropertyGroupingRepository";
import type {
  CfihosClassPropertyGroupingView,
  CfihosPropertyGrouping,
} from "../cfihos/model/propertyGrouping";
import "./EquipmentClassesPage.css";

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      equipmentClasses: CfihosEquipmentClass[];
      tree: CfihosEquipmentClassTreeNode[];
    }
  | { status: "error"; message: string };

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

function ExpansionControl({ expanded, total, label, controls, onToggle }: ExpansionControlProps) {
  if (total <= COLLAPSE_THRESHOLD) return null;

  return (
    <div className="equipment-expansion-control">
      <button type="button" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
        {expanded ? "Show less" : `Show all ${total} ${label}`}
        <ChevronDown size={15} className={expanded ? "equipment-expansion-chevron-open" : undefined} />
      </button>
      {!expanded && <span>Showing first {COLLAPSED_ITEM_COUNT} of {total}</span>}
    </div>
  );
}

export function EquipmentClassesPage() {
  const navigate = useNavigate();
  const { equipmentClassId } = useParams();

  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedEquipmentClass, setSelectedEquipmentClass] =
    useState<CfihosEquipmentClass | null>(null);

  const [classPath, setClassPath] = useState<
    CfihosEquipmentClass[]
  >([]);

  const [properties, setProperties] = useState<
    CfihosEffectiveEquipmentClassProperty[]
  >([]);

  const [propertiesLoading, setPropertiesLoading] =
    useState(false);

  const [selectedProperty, setSelectedProperty] =
    useState<CfihosEffectiveEquipmentClassProperty | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [equipmentClasses, tree] =
          await Promise.all([
            cfihosEquipmentRepository.getEquipmentClasses(),
            cfihosEquipmentRepository.getEquipmentClassTree(),
          ]);

        if (!active) {
          return;
        }

        setState({
          status: "success",
          equipmentClasses,
          tree,
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
              : "Unable to load CFIHOS Equipment Classes.",
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

    async function resolveSelection() {
      setSelectedProperty(null);

      if (!equipmentClassId) {
        setSelectedEquipmentClass(null);
        setClassPath([]);
        setProperties([]);
        return;
      }

      setPropertiesLoading(true);

      try {
        const [
          equipmentClass,
          path,
          effectiveProperties,
        ] = await Promise.all([
          cfihosEquipmentRepository.getEquipmentClass(
            equipmentClassId,
          ),

          cfihosEquipmentRepository.getEquipmentClassPath(
            equipmentClassId,
          ),

          cfihosEquipmentRepository.getEffectiveEquipmentClassProperties(
            equipmentClassId,
          ),
        ]);

        if (!active) {
          return;
        }

        setSelectedEquipmentClass(equipmentClass);

        if (!equipmentClass) {
          setClassPath([]);
          setProperties([]);
          return;
        }

        setClassPath(path);
        setProperties(effectiveProperties);
      } catch (error) {
        if (!active) {
          return;
        }

        setSelectedEquipmentClass(null);
        setClassPath([]);
        setProperties([]);

        console.error(
          "Unable to resolve Equipment Class selection.",
          error,
        );
      } finally {
        if (active) {
          setPropertiesLoading(false);
        }
      }
    }

    resolveSelection();

    return () => {
      active = false;
    };
  }, [state.status, equipmentClassId]);

  useEffect(() => {
    if (!selectedProperty) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedProperty(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedProperty]);

  const searchResults = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }

    const query = searchQuery
      .trim()
      .toLowerCase();

    if (!query) {
      return [];
    }

    return state.equipmentClasses
      .filter((equipmentClass) => {
        const values = [
          equipmentClass.id,
          equipmentClass.name,
          equipmentClass.definition,
          equipmentClass.parentName,
          equipmentClass.existenceReason,
          ...equipmentClass.synonyms,
        ];

        return values.some((value) =>
          value?.toLowerCase().includes(query),
        );
      })
      .sort(compareEquipmentClasses)
      .slice(0, 100);
  }, [searchQuery, state]);

  function navigateToEquipmentClass(
    classId: string,
  ) {
    navigate(
      `/classes/equipment/${encodeURIComponent(classId)}`,
    );
  }

  function selectEquipmentClass(
    equipmentClass: CfihosEquipmentClass,
  ) {
    navigateToEquipmentClass(equipmentClass.id);
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={
          <LoaderCircle
            className="equipment-spinner"
            size={24}
          />
        }
        title="Loading Equipment Classes"
        message="Building the CFIHOS Equipment Class hierarchy and property indexes…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusScreen
        icon={<CircleAlert size={24} />}
        title="Unable to load Equipment Classes"
        message={state.message}
      />
    );
  }

  return (
    <div className="equipment-explorer">
      <aside className="equipment-browser-panel">
        <div className="equipment-browser-heading">
          <div>
            <div className="equipment-page-eyebrow">
              Classes
            </div>

            <h1>Equipment Classes</h1>
          </div>

          <div className="equipment-class-count">
            {state.equipmentClasses.length}
          </div>
        </div>

        <div className="equipment-search">
          <Search size={16} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search equipment classes..."
            aria-label="Search Equipment Classes"
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

        <div className="equipment-tree">
          {searchQuery.trim() ? (
            <SearchResults
              results={searchResults}
              selectedId={
                selectedEquipmentClass?.id ?? null
              }
              onSelect={selectEquipmentClass}
            />
          ) : (
            state.tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selectedId={
                  selectedEquipmentClass?.id ?? null
                }
                onSelect={selectEquipmentClass}
              />
            ))
          )}
        </div>
      </aside>

      <section className="equipment-detail-panel">
        {equipmentClassId &&
        !selectedEquipmentClass ? (
          <StatusScreen
            icon={<CircleAlert size={24} />}
            title="Equipment Class not found"
            message={`No CFIHOS Equipment Class was found for ${equipmentClassId}.`}
          />
        ) : selectedEquipmentClass ? (
          <EquipmentClassDetails
            equipmentClass={selectedEquipmentClass}
            classPath={classPath}
            properties={properties}
            propertiesLoading={propertiesLoading}
            onNavigateToClass={
              navigateToEquipmentClass
            }
            onOpenProperty={
              setSelectedProperty
            }
            onOpenStandard={(standardId) =>
              navigate(
                `/standards/${encodeURIComponent(standardId)}`,
              )
            }
            onOpenTagClass={(tagClassId) =>
              navigate(
                `/classes/tag/${encodeURIComponent(tagClassId)}`,
              )
            }
            onOpenDocument={(documentTypeId) =>
              navigate(
                `/documents/${encodeURIComponent(documentTypeId)}`,
              )
            }
            onOpenUnit={(unitId) =>
              navigate(`/units/${encodeURIComponent(unitId)}`)
            }
          />
        ) : (
          <EmptySelection />
        )}
      </section>

      {selectedProperty && (
        <PropertyDrawer
          key={`${selectedProperty.property.id}-${selectedProperty.sourceEquipmentClassId}`}
          item={selectedProperty}
          onClose={() =>
            setSelectedProperty(null)
          }
          onNavigateToClass={(id) => {
            setSelectedProperty(null);
            navigateToEquipmentClass(id);
          }}
          onOpenUnit={(unitId) => {
            setSelectedProperty(null);
            navigate(`/units/${encodeURIComponent(unitId)}`);
          }}
        />
      )}
    </div>
  );
}

type TreeNodeProps = {
  node: CfihosEquipmentClassTreeNode;
  selectedId: string | null;
  onSelect: (
    equipmentClass: CfihosEquipmentClass,
  ) => void;
  depth?: number;
};

function TreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: TreeNodeProps) {
  const containsSelected = useMemo(
    () =>
      treeContainsId(
        node,
        selectedId,
      ),
    [node, selectedId],
  );

  const [expanded, setExpanded] =
    useState(
      depth === 0 || containsSelected,
    );

  useEffect(() => {
    if (containsSelected) {
      setExpanded(true);
    }
  }, [containsSelected]);

  const hasChildren =
    node.children.length > 0;

  return (
    <div className="equipment-tree-node">
      <div
        className={`equipment-tree-row ${
          selectedId === node.id
            ? "equipment-tree-row-selected"
            : ""
        }`}
        style={{
          paddingLeft: 8 + depth * 17,
        }}
      >
        <button
          type="button"
          className="equipment-tree-toggle"
          onClick={() => {
            if (hasChildren) {
              setExpanded(
                (current) => !current,
              );
            }
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
            <span className="equipment-tree-dot" />
          )}
        </button>

        <button
          type="button"
          className="equipment-tree-label"
          onClick={() => onSelect(node)}
        >
          <span>{node.name}</span>

          {node.abstract && (
            <span className="equipment-tree-abstract">
              A
            </span>
          )}
        </button>
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function treeContainsId(
  node: CfihosEquipmentClassTreeNode,
  id: string | null,
): boolean {
  if (!id) {
    return false;
  }

  if (node.id === id) {
    return true;
  }

  return node.children.some((child) =>
    treeContainsId(child, id),
  );
}

type SearchResultsProps = {
  results: CfihosEquipmentClass[];
  selectedId: string | null;
  onSelect: (
    equipmentClass: CfihosEquipmentClass,
  ) => void;
};

function SearchResults({
  results,
  selectedId,
  onSelect,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="equipment-search-empty">
        No matching Equipment Classes found.
      </div>
    );
  }

  return (
    <div className="equipment-search-results">
      {results.map((equipmentClass) => (
        <button
          key={equipmentClass.id}
          type="button"
          className={`equipment-search-result ${
            selectedId === equipmentClass.id
              ? "equipment-search-result-selected"
              : ""
          }`}
          onClick={() =>
            onSelect(equipmentClass)
          }
        >
          <span className="equipment-search-result-name">
            {equipmentClass.name}
          </span>

          <span className="equipment-search-result-code">
            {equipmentClass.id}
          </span>
        </button>
      ))}
    </div>
  );
}

type EquipmentClassDetailsProps = {
  equipmentClass: CfihosEquipmentClass;
  classPath: CfihosEquipmentClass[];
  properties: CfihosEffectiveEquipmentClassProperty[];
  propertiesLoading: boolean;
  onNavigateToClass: (
    equipmentClassId: string,
  ) => void;
  onOpenProperty: (
    property: CfihosEffectiveEquipmentClassProperty,
  ) => void;
  onOpenStandard: (sourceStandardId: string) => void;
  onOpenTagClass: (tagClassId: string) => void;
  onOpenDocument: (documentTypeId: string) => void;
  onOpenUnit: (unitId: string) => void;
};

function EquipmentClassDetails({
  equipmentClass,
  classPath,
  properties,
  propertiesLoading,
  onNavigateToClass,
  onOpenProperty,
  onOpenStandard,
  onOpenDocument,
  onOpenTagClass,
  onOpenUnit,
}: EquipmentClassDetailsProps) {
  const directPropertyCount =
    properties.filter(
      (item) =>
        item.assignmentType === "direct",
    ).length;

  const inheritedPropertyCount =
    properties.length -
    directPropertyCount;

  const [directStandards, setDirectStandards] = useState<
    CfihosClassSourceStandard[]
  >([]);
  const [propertyStandards, setPropertyStandards] = useState<
    CfihosClassPropertySourceStandard[]
  >([]);
  const [standardsLoading, setStandardsLoading] = useState(false);

  const [relatedTagClasses, setRelatedTagClasses] = useState<
    CfihosResolvedTagEquipmentClassRelationship[]
  >([]);
  const [relationshipsLoading, setRelationshipsLoading] = useState(false);

  const [documentRequirements, setDocumentRequirements] = useState<
    CfihosResolvedClassDocumentRequirement[]
  >([]);
  const [documentRequirementsLoading, setDocumentRequirementsLoading] =
    useState(false);

  const [propertyGroupingViews, setPropertyGroupingViews] = useState<
    CfihosClassPropertyGroupingView[]
  >([]);
  const [propertyGroupingsLoading, setPropertyGroupingsLoading] =
    useState(false);
  const [propertyView, setPropertyView] = useState<"all" | "grouped">(
    "all",
  );

  useEffect(() => {
    let active = true;

    async function loadStandards() {
      setStandardsLoading(true);

      try {
        const [classStandards, classPropertyStandards] =
          await Promise.all([
            cfihosSourceStandardRepository.getStandardsForClass(
              equipmentClass.id,
            ),
            cfihosSourceStandardRepository.getPropertyStandardsForClass(
              equipmentClass.id,
            ),
          ]);

        if (!active) {
          return;
        }

        setDirectStandards(classStandards);
        setPropertyStandards(classPropertyStandards);
      } catch (error) {
        if (active) {
          setDirectStandards([]);
          setPropertyStandards([]);
          console.error(
            "Unable to load Source Standard provenance.",
            error,
          );
        }
      } finally {
        if (active) {
          setStandardsLoading(false);
        }
      }
    }

    loadStandards();

    return () => {
      active = false;
    };
  }, [equipmentClass.id]);

  useEffect(() => {
    let active = true;

    async function loadRelationships() {
      setRelationshipsLoading(true);

      try {
        const relationships =
          await cfihosClassRelationshipRepository.getTagClassesForEquipmentClass(
            equipmentClass.id,
          );

        if (!active) {
          return;
        }

        setRelatedTagClasses(relationships);
      } catch (error) {
        if (active) {
          setRelatedTagClasses([]);
          console.error(
            "Unable to load related Tag Classes.",
            error,
          );
        }
      } finally {
        if (active) {
          setRelationshipsLoading(false);
        }
      }
    }

    loadRelationships();

    return () => {
      active = false;
    };
  }, [equipmentClass.id]);

  useEffect(() => {
    let active = true;

    async function loadDocumentRequirements() {
      setDocumentRequirementsLoading(true);

      try {
        const items =
          await cfihosClassDocumentRepository.getRequirementsForEquipmentClass(
            equipmentClass.id,
          );

        if (active) {
          setDocumentRequirements(items);
        }
      } catch (error) {
        if (active) {
          setDocumentRequirements([]);
          console.error(
            "Unable to load required documents for Equipment Class.",
            error,
          );
        }
      } finally {
        if (active) {
          setDocumentRequirementsLoading(false);
        }
      }
    }

    loadDocumentRequirements();

    return () => {
      active = false;
    };
  }, [equipmentClass.id]);

  useEffect(() => {
    let active = true;

    async function loadPropertyGroupings() {
      setPropertyView("all");
      setPropertyGroupingsLoading(true);

      try {
        const views =
          await cfihosPropertyGroupingRepository.getGroupingsForClass(
            equipmentClass.id,
          );

        if (active) {
          setPropertyGroupingViews(views);
        }
      } catch (error) {
        if (active) {
          setPropertyGroupingViews([]);
          console.error(
            "Unable to load CFIHOS Property Groupings.",
            error,
          );
        }
      } finally {
        if (active) {
          setPropertyGroupingsLoading(false);
        }
      }
    }

    loadPropertyGroupings();

    return () => {
      active = false;
    };
  }, [equipmentClass.id]);

  return (
    <div className="equipment-details">
      {classPath.length > 0 && (
        <ClassBreadcrumb
          path={classPath}
          onNavigate={onNavigateToClass}
        />
      )}

      <header className="equipment-details-header">
        <div className="equipment-page-eyebrow">
          Equipment Class
        </div>

        <div className="equipment-title-row">
          <div>
            <h1>{equipmentClass.name}</h1>

            <div className="equipment-code">
              <Hash size={14} />
              {equipmentClass.id}
            </div>
          </div>

          <div className="equipment-badges">
            {equipmentClass.abstract ? (
              <span className="equipment-badge equipment-badge-neutral">
                Abstract class
              </span>
            ) : (
              <span className="equipment-badge equipment-badge-positive">
                <CircleCheck size={14} />
                Concrete class
              </span>
            )}

            {equipmentClass.sparePartInformationRequired && (
              <span className="equipment-badge equipment-badge-neutral">
                Spare part information required
              </span>
            )}
          </div>
        </div>

        {equipmentClass.definition && (
          <p className="equipment-definition">
            {equipmentClass.definition}
          </p>
        )}
      </header>

      <div className="equipment-detail-grid">
        <InfoCard title="Classification">
          <DefinitionRow label="Parent class">
            {equipmentClass.parentName ? (
              equipmentClass.parentId ? (
                <button
                  type="button"
                  className="equipment-parent-link"
                  onClick={() =>
                    onNavigateToClass(
                      equipmentClass.parentId!,
                    )
                  }
                >
                  {equipmentClass.parentName}
                  <ChevronRight size={14} />
                </button>
              ) : (
                equipmentClass.parentName
              )
            ) : (
              "Root class"
            )}
          </DefinitionRow>

          <DefinitionRow label="Class type">
            {equipmentClass.abstract
              ? "Abstract"
              : "Concrete"}
          </DefinitionRow>
        </InfoCard>

        <InfoCard title="Equipment information">
          <DefinitionRow label="Spare parts">
            {equipmentClass.sparePartInformationRequired
              ? "Information required"
              : "Not specifically required"}
          </DefinitionRow>

          <DefinitionRow label="Synonyms">
            {equipmentClass.synonyms.length > 0
              ? equipmentClass.synonyms.join(", ")
              : "None"}
          </DefinitionRow>
        </InfoCard>
      </div>

      {equipmentClass.existenceReason && (
        <InfoCard title="Existence reason">
          <p className="equipment-info-paragraph">
            {equipmentClass.existenceReason}
          </p>
        </InfoCard>
      )}

      <nav className="equipment-page-contents" aria-label="On this page">
        <span>On this page</span>
        <a href="#equipment-properties">Properties</a>
        <a href="#equipment-related-tags">Related Tag Classes</a>
        <a href="#equipment-required-documents">Required Documents</a>
        <a href="#equipment-source-standards">Source Standards</a>
      </nav>

      <section id="equipment-properties" className="equipment-properties-section equipment-section-anchor">
        <div className="equipment-properties-heading">
          <div>
            <div className="equipment-page-eyebrow">
              Information requirements
            </div>

            <h2>Properties</h2>

            {!propertiesLoading &&
              properties.length > 0 && (
                <div className="equipment-property-summary">
                  <span>{directPropertyCount} direct</span>
                  <span className="equipment-property-summary-separator">·</span>
                  <span>{inheritedPropertyCount} inherited</span>
                </div>
              )}
          </div>

          <div className="equipment-property-heading-actions">
            {propertyGroupingViews.length > 0 && (
              <div
                className="equipment-property-view-toggle"
                role="group"
                aria-label="Property presentation"
              >
                <button
                  type="button"
                  className={
                    propertyView === "all"
                      ? "equipment-property-view-active"
                      : undefined
                  }
                  onClick={() => setPropertyView("all")}
                >
                  All properties
                </button>
                <button
                  type="button"
                  className={
                    propertyView === "grouped"
                      ? "equipment-property-view-active"
                      : undefined
                  }
                  onClick={() => setPropertyView("grouped")}
                >
                  {propertyGroupingViews[0]?.purposeCode ?? "Grouped"} grouping
                </button>
              </div>
            )}

            {!propertiesLoading && (
              <span className="equipment-property-count">
                {propertyView === "grouped" && propertyGroupingViews.length > 0
                  ? `${propertyGroupingViews[0].propertyCount} grouped`
                  : `${properties.length} effective`}
              </span>
            )}
          </div>
        </div>

        {propertiesLoading || propertyGroupingsLoading ? (
          <div className="equipment-properties-loading">
            <LoaderCircle className="equipment-spinner" size={20} />
            Loading properties…
          </div>
        ) : propertyView === "grouped" && propertyGroupingViews.length > 0 ? (
          <PropertyGroupingView
            view={propertyGroupingViews[0]}
            properties={properties}
            onOpenProperty={onOpenProperty}
            onOpenStandard={onOpenStandard}
          />
        ) : properties.length === 0 ? (
          <div className="equipment-properties-empty">
            No properties are assigned to this Equipment Class or its ancestors.
          </div>
        ) : (
          <PropertiesTable
            key={equipmentClass.id}
            properties={properties}
            onNavigateToClass={
              onNavigateToClass
            }
            onOpenProperty={onOpenProperty}
            onOpenUnit={onOpenUnit}
          />
        )}
      </section>

      <RelatedTagClassesSection
        key={"related-tags-" + equipmentClass.id}
        relationships={relatedTagClasses}
        loading={relationshipsLoading}
        onOpenTagClass={onOpenTagClass}
      />

      <RequiredDocumentsSection
        key={"required-documents-" + equipmentClass.id}
        requirements={documentRequirements}
        loading={documentRequirementsLoading}
        onOpenDocument={onOpenDocument}
        onOpenStandard={onOpenStandard}
      />

      <SourceStandardsSection
        key={"source-standards-" + equipmentClass.id}
        directStandards={directStandards}
        propertyStandards={propertyStandards}
        loading={standardsLoading}
        onOpenStandard={onOpenStandard}
      />
    </div>
  );
}

type PropertyGroupingViewProps = {
  view: CfihosClassPropertyGroupingView;
  properties: CfihosEffectiveEquipmentClassProperty[];
  onOpenProperty: (property: CfihosEffectiveEquipmentClassProperty) => void;
  onOpenStandard: (sourceStandardId: string) => void;
};

function PropertyGroupingView({
  view,
  properties,
  onOpenProperty,
  onOpenStandard,
}: PropertyGroupingViewProps) {
  const propertiesById = useMemo(
    () => new Map(properties.map((item) => [item.property.id, item])),
    [properties],
  );

  return (
    <div className="equipment-property-grouping">
      <div className="equipment-property-grouping-intro">
        <div>
          <strong>{view.purposeCode} property grouping</strong>
          <span>
            CFIHOS-defined procurement grouping for this class. Groups are
            ordered by CFIHOS group code/name; properties are alphabetical
            where no sequence is supplied.
          </span>
        </div>
        <span>{view.groups.length} groups</span>
      </div>

      {view.groups.map((group) => (
        <section
          className="equipment-property-group-card"
          key={group.id ?? group.code ?? group.description ?? "group"}
        >
          <div className="equipment-property-group-heading">
            <div>
              <div className="equipment-property-group-code">
                {group.code ?? "Property group"}
              </div>
              <h3>{group.description ?? group.code ?? "Property group"}</h3>
            </div>

            <div className="equipment-property-group-meta">
              <span>{group.assignments.length} properties</span>
              {group.sourceStandards.map((standard) => (
                <button
                  type="button"
                  key={standard.id}
                  onClick={() => onOpenStandard(standard.id)}
                >
                  {standard.code ?? standard.id}
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
          </div>

          <div className="equipment-property-group-list">
            {group.assignments.map((assignment) => (
              <GroupingPropertyRow
                key={
                  assignment.assignmentId ??
                  `${group.id ?? group.code}-${assignment.propertyId}`
                }
                assignment={assignment}
                effectiveProperty={
                  assignment.propertyId
                    ? propertiesById.get(assignment.propertyId) ?? null
                    : null
                }
                onOpenProperty={onOpenProperty}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type GroupingPropertyRowProps = {
  assignment: CfihosPropertyGrouping;
  effectiveProperty: CfihosEffectiveEquipmentClassProperty | null;
  onOpenProperty: (property: CfihosEffectiveEquipmentClassProperty) => void;
};

function GroupingPropertyRow({
  assignment,
  effectiveProperty,
  onOpenProperty,
}: GroupingPropertyRowProps) {
  const content = (
    <>
      <div>
        <strong>{assignment.propertyName ?? assignment.propertyId ?? "Property"}</strong>
        {assignment.propertyId && <span>{assignment.propertyId}</span>}
      </div>
      <ChevronRight size={14} />
    </>
  );

  if (!effectiveProperty) {
    return (
      <div className="equipment-property-group-row equipment-property-group-row-static">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="equipment-property-group-row"
      onClick={() => onOpenProperty(effectiveProperty)}
    >
      {content}
    </button>
  );
}

type RelatedTagClassesSectionProps = {
  relationships: CfihosResolvedTagEquipmentClassRelationship[];
  loading: boolean;
  onOpenTagClass: (tagClassId: string) => void;
};

function RelatedTagClassesSection({
  relationships,
  loading,
  onOpenTagClass,
}: RelatedTagClassesSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedRelationships = visibleItems(relationships, expanded);

  return (
    <section id="equipment-related-tags" className="equipment-related-classes-section equipment-section-anchor">
      <div className="equipment-properties-heading">
        <div>
          <div className="equipment-page-eyebrow">
            Class relationship
          </div>
          <h2>Related Tag Classes</h2>
          <div className="equipment-property-summary">
            Explicit mappings from the CFIHOS Tag–Equipment relationship table.
          </div>
        </div>

        {!loading && (
          <span className="equipment-property-count">
            {relationships.length} mapped
          </span>
        )}
      </div>

      {loading ? (
        <div className="equipment-related-classes-empty">
          <LoaderCircle className="equipment-spinner" size={20} />
          Loading related Tag Classes…
        </div>
      ) : relationships.length === 0 ? (
        <div className="equipment-related-classes-empty">
          No explicit Tag Class mapping is recorded for this Equipment Class.
        </div>
      ) : (
        <>
          <div id="equipment-related-tags-list" className="equipment-related-classes-grid">
          {displayedRelationships.map((item) => (
            <button
              key={`${item.equipmentClass.id}-${item.tagClass.id}`}
              type="button"
              className="equipment-related-class-card"
              onClick={() => onOpenTagClass(item.tagClass.id)}
            >
              <div className="equipment-related-class-main">
                <div>
                  <div className="equipment-related-class-name">
                    {item.tagClass.name}
                  </div>
                  <div className="equipment-related-class-code">
                    {item.tagClass.id}
                  </div>
                </div>

                <ChevronRight size={15} />
              </div>

              {item.relationship.mappingReason && (
                <div className="equipment-related-class-reason">
                  <span>Mapping reason</span>
                  {item.relationship.mappingReason}
                </div>
              )}
            </button>
          ))}
          </div>
          <ExpansionControl
            expanded={expanded}
            total={relationships.length}
            label="classes"
            controls="equipment-related-tags-list"
            onToggle={() => setExpanded((value) => !value)}
          />
        </>
      )}
    </section>
  );
}


type RequiredDocumentsSectionProps = {
  requirements: CfihosResolvedClassDocumentRequirement[];
  loading: boolean;
  onOpenDocument: (documentTypeId: string) => void;
  onOpenStandard: (sourceStandardId: string) => void;
};

function RequiredDocumentsSection({
  requirements,
  loading,
  onOpenDocument,
  onOpenStandard,
}: RequiredDocumentsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedRequirements = visibleItems(requirements, expanded);
  const equipmentCount = requirements.filter(
    (item) => item.requirement.assetType === "Equipment",
  ).length;
  const modelPartCount = requirements.filter(
    (item) => item.requirement.assetType === "Model_Part",
  ).length;

  return (
    <section id="equipment-required-documents" className="equipment-required-documents-section equipment-section-anchor">
      <div className="equipment-properties-heading">
        <div>
          <div className="equipment-page-eyebrow">
            Document requirements
          </div>
          <h2>Required Documents</h2>
          <div className="equipment-property-summary">
            Explicit CFIHOS document requirements for this class and asset context.
          </div>
        </div>

        {!loading && (
          <span className="equipment-property-count">
            {requirements.length} required
          </span>
        )}
      </div>

      {loading ? (
        <div className="equipment-required-documents-empty">
          <LoaderCircle className="equipment-spinner" size={20} />
          Loading required documents…
        </div>
      ) : requirements.length === 0 ? (
        <div className="equipment-required-documents-empty">
          No Equipment or Model / Part document requirement is recorded for this class.
        </div>
      ) : (
        <>
          <div className="equipment-required-documents-summary">
            {equipmentCount > 0 && <span>Equipment {equipmentCount}</span>}
            {modelPartCount > 0 && <span>Model / Part {modelPartCount}</span>}
          </div>
          <div id="equipment-required-documents-list" className="equipment-required-documents-table-wrapper">
            <table className="equipment-required-documents-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Context</th>
                  <th>Source Standard</th>
                </tr>
              </thead>
              <tbody>
                {displayedRequirements.map((item) => (
                  <tr key={item.requirement.id}>
                    <td>
                      <button
                        type="button"
                        className="equipment-required-document-link"
                        onClick={() =>
                          onOpenDocument(item.requirement.documentTypeId)
                        }
                      >
                        {item.requirement.documentTypeName}
                        <ChevronRight size={12} />
                      </button>
                      <div className="equipment-required-document-id">
                        {item.requirement.documentTypeId}
                      </div>
                    </td>
                    <td>
                      <span className="equipment-required-document-context">
                        {item.requirement.assetType === "Model_Part"
                          ? "Model / Part"
                          : item.requirement.assetType}
                      </span>
                    </td>
                    <td>
                      {item.requirement.sourceStandardId ? (
                        <button
                          type="button"
                          className="equipment-required-standard-link"
                          onClick={() =>
                            onOpenStandard(
                              item.requirement.sourceStandardId!,
                            )
                          }
                        >
                          {item.requirement.sourceStandardCode ??
                            item.requirement.sourceStandardId}
                          <ChevronRight size={12} />
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ExpansionControl
            expanded={expanded}
            total={requirements.length}
            label="documents"
            controls="equipment-required-documents-list"
            onToggle={() => setExpanded((value) => !value)}
          />
        </>
      )}
    </section>
  );
}

type SourceStandardsSectionProps = {
  directStandards: CfihosClassSourceStandard[];
  propertyStandards: CfihosClassPropertySourceStandard[];
  loading: boolean;
  onOpenStandard: (sourceStandardId: string) => void;
};

function SourceStandardsSection({
  directStandards,
  propertyStandards,
  loading,
  onOpenStandard,
}: SourceStandardsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const uniqueDirectStandards = useMemo(() => {
    const seen = new Set<string>();

    return directStandards.filter((item) => {
      if (seen.has(item.sourceStandardId)) {
        return false;
      }

      seen.add(item.sourceStandardId);
      return true;
    });
  }, [directStandards]);

  const totalStandards = uniqueDirectStandards.length + propertyStandards.length;
  const displayedDirectStandards = expanded
    ? uniqueDirectStandards
    : uniqueDirectStandards.slice(0, COLLAPSED_ITEM_COUNT);
  const remainingSlots = Math.max(0, COLLAPSED_ITEM_COUNT - displayedDirectStandards.length);
  const displayedPropertyStandards = expanded
    ? propertyStandards
    : propertyStandards.slice(0, remainingSlots);

  return (
    <section id="equipment-source-standards" className="equipment-standards-section equipment-section-anchor">
      <div className="equipment-properties-heading">
        <div>
          <div className="equipment-page-eyebrow">
            Traceability
          </div>
          <h2>Source Standards</h2>
          <div className="equipment-property-summary">
            <span>{uniqueDirectStandards.length} direct</span>
            <span className="equipment-property-summary-separator">·</span>
            <span>{propertyStandards.length} property mappings</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="equipment-standards-empty">
          <LoaderCircle className="equipment-spinner" size={20} />
          Loading Source Standard provenance…
        </div>
      ) : uniqueDirectStandards.length === 0 &&
        propertyStandards.length === 0 ? (
        <div className="equipment-standards-empty">
          No Source Standard provenance is recorded for this class.
        </div>
      ) : (
        <div id="equipment-source-standards-list" className="equipment-standards-grid">
          <div className="equipment-standards-card">
            <h3>Direct class standards</h3>
            <p>Standards explicitly associated with this class.</p>

            {uniqueDirectStandards.length === 0 ? (
              <div className="equipment-standards-card-empty">None</div>
            ) : (
              <div className="equipment-standards-list">
                {displayedDirectStandards.map((item) => (
                  <button
                    key={item.sourceStandardId}
                    type="button"
                    onClick={() => onOpenStandard(item.sourceStandardId)}
                  >
                    <span>{item.sourceStandardCode}</span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="equipment-standards-card equipment-standards-card-wide">
            <h3>Property provenance</h3>
            <p>Property assignments traced to their originating standards.</p>

            {propertyStandards.length === 0 ? (
              <div className="equipment-standards-card-empty">None</div>
            ) : (
              <div className="equipment-standards-table-wrapper">
                <table className="equipment-standards-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Standard</th>
                      <th>Section</th>
                      <th>Source property name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPropertyStandards.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.propertyName}</strong>
                          <div className="equipment-property-code">
                            {item.propertyId}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="equipment-standard-link"
                            onClick={() =>
                              onOpenStandard(item.sourceStandardId)
                            }
                          >
                            {item.sourceStandardCode}
                            <ChevronRight size={12} />
                          </button>
                        </td>
                        <td>{item.sourceStandardSection ?? "—"}</td>
                        <td>
                          {item.propertyNameInSourceStandard ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {!loading && totalStandards > 0 && (
        <ExpansionControl
          expanded={expanded}
          total={totalStandards}
          label="source records"
          controls="equipment-source-standards-list"
          onToggle={() => setExpanded((value) => !value)}
        />
      )}
    </section>
  );
}

type ClassBreadcrumbProps = {
  path: CfihosEquipmentClass[];
  onNavigate: (
    equipmentClassId: string,
  ) => void;
};

function ClassBreadcrumb({
  path,
  onNavigate,
}: ClassBreadcrumbProps) {
  return (
    <nav
      className="equipment-breadcrumb"
      aria-label="Equipment Class hierarchy"
    >
      {path.map((item, index) => {
        const isCurrent =
          index === path.length - 1;

        return (
          <span
            className="equipment-breadcrumb-item"
            key={item.id}
          >
            {index > 0 && (
              <ChevronRight
                className="equipment-breadcrumb-separator"
                size={13}
              />
            )}

            {isCurrent ? (
              <span className="equipment-breadcrumb-current">
                {item.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onNavigate(item.id)
                }
              >
                {item.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

type PropertiesTableProps = {
  properties: CfihosEffectiveEquipmentClassProperty[];
  onNavigateToClass: (
    equipmentClassId: string,
  ) => void;
  onOpenProperty: (
    property: CfihosEffectiveEquipmentClassProperty,
  ) => void;
  onOpenUnit: (unitId: string) => void;
};

function PropertiesTable({
  properties,
  onNavigateToClass,
  onOpenProperty,
  onOpenUnit,
}: PropertiesTableProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedProperties = visibleItems(properties, expanded);

  return (
    <>
    <div id="equipment-properties-list" className="equipment-properties-table-wrapper">
      <table className="equipment-properties-table">
        <thead>
          <tr>
            <th>Property</th>
            <th>Assignment</th>
            <th>Relevant for</th>
            <th>Data type</th>
            <th>SI unit</th>
            <th>Imperial unit</th>
            <th>Picklist</th>
          </tr>
        </thead>

        <tbody>
          {displayedProperties.map((item) => {
            const {
              relationship,
              property,
              picklistValues,
              assignmentType,
              sourceEquipmentClassId,
              sourceEquipmentClassName,
              inheritanceDepth,
            } = item;

            return (
              <tr
                key={`${property.id}-${sourceEquipmentClassId}`}
              >
                <td>
                  <button
                    type="button"
                    className="equipment-property-open"
                    onClick={() =>
                      onOpenProperty(item)
                    }
                  >
                    {property.name}
                    <ChevronRight size={13} />
                  </button>

                  <div className="equipment-property-code">
                    {property.id}
                  </div>

                  {property.definition && (
                    <div className="equipment-property-definition">
                      {property.definition}
                    </div>
                  )}
                </td>

                <td>
                  {assignmentType === "direct" ? (
                    <span className="equipment-assignment-badge equipment-assignment-direct">
                      Direct
                    </span>
                  ) : (
                    <div className="equipment-assignment">
                      <span className="equipment-assignment-badge equipment-assignment-inherited">
                        Inherited
                      </span>

                      <button
                        type="button"
                        className="equipment-inheritance-source"
                        onClick={() =>
                          onNavigateToClass(
                            sourceEquipmentClassId,
                          )
                        }
                      >
                        from{" "}
                        {sourceEquipmentClassName}
                        <ChevronRight size={12} />
                      </button>

                      {inheritanceDepth > 1 && (
                        <div className="equipment-inheritance-depth">
                          {inheritanceDepth} levels up
                        </div>
                      )}
                    </div>
                  )}
                </td>

                <td>
                  <RelevanceBadges
                    relevantForEquipment={
                      relationship.relevantForEquipment
                    }
                    relevantForModelOrPart={
                      relationship.relevantForModelOrPart
                    }
                  />
                </td>

                <td>
                  {property.dataType ?? "—"}

                  {property.dataTypeLength && (
                    <div className="equipment-property-secondary">
                      Length{" "}
                      {property.dataTypeLength}
                    </div>
                  )}
                </td>

                <td>
                  {relationship.siUnit.id && relationship.siUnit.name ? (
                    <button
                      type="button"
                      className="equipment-unit-link"
                      onClick={() => onOpenUnit(relationship.siUnit.id!)}
                    >
                      {relationship.siUnit.name}
                      <ChevronRight size={12} />
                    </button>
                  ) : (
                    relationship.siUnit.name ?? "—"
                  )}
                </td>

                <td>
                  {relationship.imperialUnit.id && relationship.imperialUnit.name ? (
                    <button
                      type="button"
                      className="equipment-unit-link"
                      onClick={() => onOpenUnit(relationship.imperialUnit.id!)}
                    >
                      {relationship.imperialUnit.name}
                      <ChevronRight size={12} />
                    </button>
                  ) : (
                    relationship.imperialUnit.name ?? "—"
                  )}
                </td>

                <td>
                  {property.picklistName ? (
                    <button
                      type="button"
                      className="equipment-picklist-open"
                      onClick={() =>
                        onOpenProperty(item)
                      }
                    >
                      <span className="equipment-picklist-name">
                        {property.picklistName}
                      </span>

                      <span className="equipment-property-secondary">
                        {picklistValues.length}{" "}
                        {picklistValues.length ===
                        1
                          ? "value"
                          : "values"}
                      </span>
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <ExpansionControl
      expanded={expanded}
      total={properties.length}
      label="properties"
      controls="equipment-properties-list"
      onToggle={() => setExpanded((value) => !value)}
    />
    </>
  );
}

type RelevanceBadgesProps = {
  relevantForEquipment: boolean;
  relevantForModelOrPart: boolean;
};

function RelevanceBadges({
  relevantForEquipment,
  relevantForModelOrPart,
}: RelevanceBadgesProps) {
  if (
    !relevantForEquipment &&
    !relevantForModelOrPart
  ) {
    return (
      <span className="equipment-relevance-none">
        —
      </span>
    );
  }

  return (
    <div className="equipment-relevance-badges">
      {relevantForEquipment && (
        <span className="equipment-relevance-badge">
          Equipment
        </span>
      )}

      {relevantForModelOrPart && (
        <span className="equipment-relevance-badge equipment-relevance-model">
          Model / Part
        </span>
      )}
    </div>
  );
}

type PropertyDrawerProps = {
  item: CfihosEffectiveEquipmentClassProperty;
  onClose: () => void;
  onNavigateToClass: (
    equipmentClassId: string,
  ) => void;
  onOpenUnit: (unitId: string) => void;
};

function PropertyDrawer({
  item,
  onClose,
  onNavigateToClass,
  onOpenUnit,
}: PropertyDrawerProps) {
  const {
    relationship,
    property,
    picklistValues,
    assignmentType,
    sourceEquipmentClassId,
    sourceEquipmentClassName,
    inheritanceDepth,
  } = item;

  const [picklistQuery, setPicklistQuery] =
    useState("");

  const filteredPicklistValues =
    useMemo(() => {
      const query = picklistQuery
        .trim()
        .toLowerCase();

      if (!query) {
        return picklistValues;
      }

      return picklistValues.filter(
        (value) => {
          const fields = [
            value.code,
            value.description,
            value.sourceStandardCode,
            value.id,
          ];

          return fields.some((field) =>
            field
              ?.toLowerCase()
              .includes(query),
          );
        },
      );
    }, [picklistQuery, picklistValues]);

  return (
    <div
      className="equipment-property-drawer-layer"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="equipment-property-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Property: ${property.name}`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="equipment-property-drawer-header">
          <div>
            <div className="equipment-page-eyebrow">
              Property
            </div>

            <h2>{property.name}</h2>

            <div className="equipment-property-drawer-code">
              <Hash size={13} />
              {property.id}
            </div>
          </div>

          <button
            type="button"
            className="equipment-property-drawer-close"
            onClick={onClose}
            aria-label="Close property details"
          >
            <X size={18} />
          </button>
        </header>

        <div className="equipment-property-drawer-body">
          {property.definition && (
            <p className="equipment-property-drawer-definition">
              {property.definition}
            </p>
          )}

          <DrawerSection title="Assignment">
            <DrawerRow label="Assignment type">
              {assignmentType === "direct" ? (
                <span className="equipment-assignment-badge equipment-assignment-direct">
                  Direct
                </span>
              ) : (
                <span className="equipment-assignment-badge equipment-assignment-inherited">
                  Inherited
                </span>
              )}
            </DrawerRow>

            <DrawerRow label="Source class">
              <button
                type="button"
                className="equipment-drawer-link"
                onClick={() =>
                  onNavigateToClass(
                    sourceEquipmentClassId,
                  )
                }
              >
                {sourceEquipmentClassName}
                <ChevronRight size={13} />
              </button>
            </DrawerRow>

            {assignmentType ===
              "inherited" && (
              <DrawerRow label="Inheritance">
                {inheritanceDepth === 1
                  ? "Parent class"
                  : `${inheritanceDepth} levels up`}
              </DrawerRow>
            )}
          </DrawerSection>

          <DrawerSection title="Applicability">
            <DrawerRow label="Relevant for">
              <RelevanceBadges
                relevantForEquipment={
                  relationship.relevantForEquipment
                }
                relevantForModelOrPart={
                  relationship.relevantForModelOrPart
                }
              />
            </DrawerRow>
          </DrawerSection>

          <DrawerSection title="Property definition">
            <DrawerRow label="Data type">
              {property.dataType ??
                "Not specified"}
            </DrawerRow>

            <DrawerRow label="Data length">
              {property.dataTypeLength ??
                "Not specified"}
            </DrawerRow>

            <DrawerRow label="Dimension">
              {property.unitOfMeasureDimensionCode ??
                "Not specified"}
            </DrawerRow>

            <DrawerRow label="SI unit">
              {relationship.siUnit.id && relationship.siUnit.name ? (
                <button
                  type="button"
                  className="equipment-drawer-link"
                  onClick={() => onOpenUnit(relationship.siUnit.id!)}
                >
                  {relationship.siUnit.name}
                  <ChevronRight size={13} />
                </button>
              ) : (
                relationship.siUnit.name ?? "Not specified"
              )}
            </DrawerRow>

            <DrawerRow label="Imperial unit">
              {relationship.imperialUnit.id && relationship.imperialUnit.name ? (
                <button
                  type="button"
                  className="equipment-drawer-link"
                  onClick={() => onOpenUnit(relationship.imperialUnit.id!)}
                >
                  {relationship.imperialUnit.name}
                  <ChevronRight size={13} />
                </button>
              ) : (
                relationship.imperialUnit.name ?? "Not specified"
              )}
            </DrawerRow>

            <DrawerRow label="Synonyms">
              {property.synonyms.length > 0
                ? property.synonyms.join(", ")
                : "None"}
            </DrawerRow>
          </DrawerSection>

          {property.existenceReason && (
            <DrawerSection title="Existence reason">
              <p className="equipment-drawer-paragraph">
                {property.existenceReason}
              </p>
            </DrawerSection>
          )}

          {property.picklistName && (
            <DrawerSection
              title="Picklist"
              badge={`${picklistValues.length} values`}
            >
              <div className="equipment-drawer-picklist-heading">
                <div>
                  <div className="equipment-drawer-picklist-name">
                    {property.picklistName}
                  </div>

                  {property.picklistId && (
                    <div className="equipment-drawer-picklist-code">
                      {property.picklistId}
                    </div>
                  )}
                </div>
              </div>

              {picklistValues.length > 0 && (
                <>
                  <div className="equipment-drawer-search">
                    <Search size={15} />

                    <input
                      type="search"
                      value={picklistQuery}
                      onChange={(event) =>
                        setPicklistQuery(
                          event.target.value,
                        )
                      }
                      placeholder="Search values..."
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
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="equipment-drawer-picklist-count">
                    {
                      filteredPicklistValues.length
                    }{" "}
                    of {picklistValues.length}{" "}
                    values
                  </div>

                  <div className="equipment-drawer-picklist">
                    {filteredPicklistValues.length ===
                    0 ? (
                      <div className="equipment-drawer-picklist-empty">
                        No matching values.
                      </div>
                    ) : (
                      filteredPicklistValues.map(
                        (value) => (
                          <div
                            className="equipment-drawer-picklist-item"
                            key={value.id}
                          >
                            <div className="equipment-drawer-picklist-value-code">
                              {value.code}
                            </div>

                            {value.description && (
                              <div className="equipment-drawer-picklist-description">
                                {
                                  value.description
                                }
                              </div>
                            )}

                            {value.sourceStandardCode && (
                              <div className="equipment-drawer-picklist-source">
                                Source:{" "}
                                {
                                  value.sourceStandardCode
                                }
                              </div>
                            )}
                          </div>
                        ),
                      )
                    )}
                  </div>
                </>
              )}
            </DrawerSection>
          )}
        </div>
      </aside>
    </div>
  );
}

type DrawerSectionProps = {
  title: string;
  badge?: string;
  children: ReactNode;
};

function DrawerSection({
  title,
  badge,
  children,
}: DrawerSectionProps) {
  return (
    <section className="equipment-drawer-section">
      <div className="equipment-drawer-section-heading">
        <h3>{title}</h3>

        {badge && <span>{badge}</span>}
      </div>

      {children}
    </section>
  );
}

type DrawerRowProps = {
  label: string;
  children: ReactNode;
};

function DrawerRow({
  label,
  children,
}: DrawerRowProps) {
  return (
    <div className="equipment-drawer-row">
      <div className="equipment-drawer-row-label">
        {label}
      </div>

      <div className="equipment-drawer-row-value">
        {children}
      </div>
    </div>
  );
}

type InfoCardProps = {
  title: string;
  children: ReactNode;
};

function InfoCard({
  title,
  children,
}: InfoCardProps) {
  return (
    <section className="equipment-info-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type DefinitionRowProps = {
  label: string;
  children: ReactNode;
};

function DefinitionRow({
  label,
  children,
}: DefinitionRowProps) {
  return (
    <div className="equipment-definition-row">
      <div className="equipment-definition-label">
        {label}
      </div>

      <div className="equipment-definition-value">
        {children}
      </div>
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="equipment-empty-selection">
      <div className="equipment-empty-icon">
        <Boxes size={28} />
      </div>

      <h2>Select an Equipment Class</h2>

      <p>
        Browse the hierarchy or search for an
        Equipment Class to view its definition,
        applicability and effective properties.
      </p>
    </div>
  );
}

type StatusScreenProps = {
  icon: ReactNode;
  title: string;
  message: string;
};

function StatusScreen({
  icon,
  title,
  message,
}: StatusScreenProps) {
  return (
    <div className="equipment-status-screen">
      <div className="equipment-status-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function compareEquipmentClasses(
  a: CfihosEquipmentClass,
  b: CfihosEquipmentClass,
): number {
  return a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}