import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Hash,
  LoaderCircle,
  Search,
  Tags,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cfihosRepository } from "../cfihos/repository/CfihosRepository";
import type {
  CfihosTagClass,
  CfihosTagClassTreeNode,
} from "../cfihos/model/tagClass";
import type { CfihosEffectiveTagClassProperty } from "../cfihos/model/property";
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
import {
  cfihosJip33RequirementRepository,
} from "../cfihos/repository/CfihosJip33RequirementRepository";
import type {
  CfihosJip33Requirement,
  CfihosJip33RequirementMapping,
} from "../cfihos/model/jip33Requirement";
import {
  cfihosSubmissionReferenceDateRepository,
} from "../cfihos/repository/CfihosSubmissionReferenceDateRepository";
import type {
  CfihosSubmissionReferenceDate,
} from "../cfihos/model/submissionReferenceDate";
import "./TagClassesPage.css";

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      tagClasses: CfihosTagClass[];
      tree: CfihosTagClassTreeNode[];
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
    <div className="tag-expansion-control">
      <button type="button" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
        {expanded ? "Show less" : `Show all ${total} ${label}`}
        <ChevronDown size={15} className={expanded ? "tag-expansion-chevron-open" : undefined} />
      </button>
      {!expanded && <span>Showing first {COLLAPSED_ITEM_COUNT} of {total}</span>}
    </div>
  );
}

export function TagClassesPage() {
  const navigate = useNavigate();
  const { tagClassId } = useParams();

  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTagClass, setSelectedTagClass] =
    useState<CfihosTagClass | null>(null);

  const [classPath, setClassPath] = useState<CfihosTagClass[]>([]);

  const [properties, setProperties] = useState<
    CfihosEffectiveTagClassProperty[]
  >([]);

  const [propertiesLoading, setPropertiesLoading] =
    useState(false);

  const [selectedProperty, setSelectedProperty] =
    useState<CfihosEffectiveTagClassProperty | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [tagClasses, tree] = await Promise.all([
          cfihosRepository.getTagClasses(),
          cfihosRepository.getTagClassTree(),
        ]);

        if (!active) {
          return;
        }

        setState({
          status: "success",
          tagClasses,
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
              : "Unable to load CFIHOS Tag Classes.",
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

      if (!tagClassId) {
        setSelectedTagClass(null);
        setClassPath([]);
        setProperties([]);
        return;
      }

      setPropertiesLoading(true);

      try {
        const [tagClass, path, effectiveProperties] =
          await Promise.all([
            cfihosRepository.getTagClass(tagClassId),
            cfihosRepository.getTagClassPath(tagClassId),
            cfihosRepository.getEffectiveTagClassProperties(
              tagClassId,
            ),
          ]);

        if (!active) {
          return;
        }

        setSelectedTagClass(tagClass);

        if (!tagClass) {
          setClassPath([]);
          setProperties([]);
          return;
        }

        setClassPath(path);
        setProperties(effectiveProperties);
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
  }, [state.status, tagClassId]);

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
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProperty]);

  const searchResults = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return state.tagClasses
      .filter((tagClass) => {
        const values = [
          tagClass.id,
          tagClass.name,
          tagClass.definition,
          tagClass.parentName,
          ...tagClass.synonyms,
        ];

        return values.some((value) =>
          value?.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        }),
      )
      .slice(0, 100);
  }, [searchQuery, state]);

  function navigateToTagClass(tagClassIdToOpen: string) {
    navigate(
      `/classes/tag/${encodeURIComponent(tagClassIdToOpen)}`,
    );
  }

  function selectTagClass(tagClass: CfihosTagClass) {
    navigateToTagClass(tagClass.id);
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={
          <LoaderCircle
            className="tag-spinner"
            size={24}
          />
        }
        title="Loading Tag Classes"
        message="Building the CFIHOS Tag Class hierarchy and property indexes…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusScreen
        icon={<CircleAlert size={24} />}
        title="Unable to load Tag Classes"
        message={state.message}
      />
    );
  }

  return (
    <div className="tag-explorer">
      <aside className="tag-browser-panel">
        <div className="tag-browser-heading">
          <div>
            <div className="tag-page-eyebrow">
              Classes
            </div>
            <h1>Tag Classes</h1>
          </div>

          <div className="tag-class-count">
            {state.tagClasses.length}
          </div>
        </div>

        <div className="tag-search">
          <Search size={16} />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search tag classes..."
            aria-label="Search tag classes"
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

        <div className="tag-tree">
          {searchQuery.trim() ? (
            <SearchResults
              results={searchResults}
              selectedId={
                selectedTagClass?.id ?? null
              }
              onSelect={selectTagClass}
            />
          ) : (
            state.tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selectedId={
                  selectedTagClass?.id ?? null
                }
                onSelect={selectTagClass}
              />
            ))
          )}
        </div>
      </aside>

      <section className="tag-detail-panel">
        {tagClassId && !selectedTagClass ? (
          <StatusScreen
            icon={<CircleAlert size={24} />}
            title="Tag Class not found"
            message={`No CFIHOS Tag Class was found for ${tagClassId}.`}
          />
        ) : selectedTagClass ? (
          <TagClassDetails
            tagClass={selectedTagClass}
            classPath={classPath}
            properties={properties}
            propertiesLoading={propertiesLoading}
            onNavigateToClass={navigateToTagClass}
            onOpenProperty={setSelectedProperty}
            onOpenStandard={(standardId) =>
              navigate(
                `/standards/${encodeURIComponent(standardId)}`,
              )
            }
            onOpenEquipmentClass={(equipmentClassId) =>
              navigate(
                `/classes/equipment/${encodeURIComponent(
                  equipmentClassId,
                )}`,
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
          key={`${selectedProperty.property.id}-${selectedProperty.sourceTagClassId}`}
          item={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onNavigateToClass={(id) => {
            setSelectedProperty(null);
            navigateToTagClass(id);
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
  node: CfihosTagClassTreeNode;
  selectedId: string | null;
  onSelect: (tagClass: CfihosTagClass) => void;
  depth?: number;
};

function TreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: TreeNodeProps) {
  const containsSelected = useMemo(
    () => treeContainsId(node, selectedId),
    [node, selectedId],
  );

  const [expanded, setExpanded] = useState(
    depth === 0 || containsSelected,
  );

  useEffect(() => {
    if (containsSelected) {
      setExpanded(true);
    }
  }, [containsSelected]);

  const hasChildren = node.children.length > 0;

  return (
    <div className="tag-tree-node">
      <div
        className={`tag-tree-row ${
          selectedId === node.id
            ? "tag-tree-row-selected"
            : ""
        }`}
        style={{
          paddingLeft: 8 + depth * 17,
        }}
      >
        <button
          type="button"
          className="tag-tree-toggle"
          onClick={() => {
            if (hasChildren) {
              setExpanded((current) => !current);
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
            <span className="tag-tree-dot" />
          )}
        </button>

        <button
          type="button"
          className="tag-tree-label"
          onClick={() => onSelect(node)}
        >
          <span>{node.name}</span>

          {node.abstract && (
            <span className="tag-tree-abstract">
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
  node: CfihosTagClassTreeNode,
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
  results: CfihosTagClass[];
  selectedId: string | null;
  onSelect: (tagClass: CfihosTagClass) => void;
};

function SearchResults({
  results,
  selectedId,
  onSelect,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="tag-search-empty">
        No matching Tag Classes found.
      </div>
    );
  }

  return (
    <div className="tag-search-results">
      {results.map((tagClass) => (
        <button
          key={tagClass.id}
          type="button"
          className={`tag-search-result ${
            selectedId === tagClass.id
              ? "tag-search-result-selected"
              : ""
          }`}
          onClick={() => onSelect(tagClass)}
        >
          <span className="tag-search-result-name">
            {tagClass.name}
          </span>

          <span className="tag-search-result-code">
            {tagClass.id}
          </span>
        </button>
      ))}
    </div>
  );
}

type TagClassDetailsProps = {
  tagClass: CfihosTagClass;
  classPath: CfihosTagClass[];
  properties: CfihosEffectiveTagClassProperty[];
  propertiesLoading: boolean;
  onNavigateToClass: (tagClassId: string) => void;
  onOpenProperty: (
    property: CfihosEffectiveTagClassProperty,
  ) => void;
  onOpenStandard: (sourceStandardId: string) => void;
  onOpenEquipmentClass: (equipmentClassId: string) => void;
  onOpenDocument: (documentTypeId: string) => void;
  onOpenUnit: (unitId: string) => void;
};

function TagClassDetails({
  tagClass,
  classPath,
  properties,
  propertiesLoading,
  onNavigateToClass,
  onOpenProperty,
  onOpenStandard,
  onOpenDocument,
  onOpenEquipmentClass,
  onOpenUnit,
}: TagClassDetailsProps) {
  const directPropertyCount = properties.filter(
    (item) => item.assignmentType === "direct",
  ).length;

  const inheritedPropertyCount =
    properties.length - directPropertyCount;

  const [directStandards, setDirectStandards] = useState<
    CfihosClassSourceStandard[]
  >([]);
  const [propertyStandards, setPropertyStandards] = useState<
    CfihosClassPropertySourceStandard[]
  >([]);
  const [standardsLoading, setStandardsLoading] = useState(false);

  const [relatedEquipmentClasses, setRelatedEquipmentClasses] = useState<
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
              tagClass.id,
            ),
            cfihosSourceStandardRepository.getPropertyStandardsForClass(
              tagClass.id,
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
  }, [tagClass.id]);

  useEffect(() => {
    let active = true;

    async function loadRelationships() {
      setRelationshipsLoading(true);

      try {
        const relationships =
          await cfihosClassRelationshipRepository.getEquipmentClassesForTagClass(
            tagClass.id,
          );

        if (!active) {
          return;
        }

        setRelatedEquipmentClasses(relationships);
      } catch (error) {
        if (active) {
          setRelatedEquipmentClasses([]);
          console.error(
            "Unable to load related Equipment Classes.",
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
  }, [tagClass.id]);

  useEffect(() => {
    let active = true;

    async function loadDocumentRequirements() {
      setDocumentRequirementsLoading(true);

      try {
        const items =
          await cfihosClassDocumentRepository.getRequirementsForTagClass(
            tagClass.id,
          );

        if (active) {
          setDocumentRequirements(items);
        }
      } catch (error) {
        if (active) {
          setDocumentRequirements([]);
          console.error(
            "Unable to load required documents for Tag Class.",
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
  }, [tagClass.id]);

  useEffect(() => {
    let active = true;

    async function loadPropertyGroupings() {
      setPropertyView("all");
      setPropertyGroupingsLoading(true);

      try {
        const views =
          await cfihosPropertyGroupingRepository.getGroupingsForClass(
            tagClass.id,
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
  }, [tagClass.id]);

  return (
    <div className="tag-details">
      {classPath.length > 0 && (
        <ClassBreadcrumb
          path={classPath}
          onNavigate={onNavigateToClass}
        />
      )}

      <header className="tag-details-header">
        <div className="tag-page-eyebrow">
          Tag Class
        </div>

        <div className="tag-title-row">
          <div>
            <h1>{tagClass.name}</h1>

            <div className="tag-code">
              <Hash size={14} />
              {tagClass.id}
            </div>
          </div>

          <div className="tag-badges">
            {tagClass.abstract ? (
              <span className="tag-badge tag-badge-neutral">
                Abstract class
              </span>
            ) : (
              <span className="tag-badge tag-badge-positive">
                <CircleCheck size={14} />
                Concrete class
              </span>
            )}

            {tagClass.equipmentExpected && (
              <span className="tag-badge tag-badge-neutral">
                Equipment expected
              </span>
            )}
          </div>
        </div>

        {tagClass.definition && (
          <p className="tag-definition">
            {tagClass.definition}
          </p>
        )}
      </header>

      <div className="tag-detail-grid">
        <InfoCard title="Classification">
          <DefinitionRow label="Parent class">
            {tagClass.parentName ? (
              tagClass.parentId ? (
                <button
                  type="button"
                  className="tag-parent-link"
                  onClick={() =>
                    onNavigateToClass(
                      tagClass.parentId!,
                    )
                  }
                >
                  {tagClass.parentName}
                  <ChevronRight size={14} />
                </button>
              ) : (
                tagClass.parentName
              )
            ) : (
              "Root class"
            )}
          </DefinitionRow>

          <DefinitionRow label="Class type">
            {tagClass.abstract
              ? "Abstract"
              : "Concrete"}
          </DefinitionRow>

          <DefinitionRow label="Equipment expected">
            {tagClass.equipmentExpected
              ? "Yes"
              : "No"}
          </DefinitionRow>
        </InfoCard>

        <InfoCard title="Tagging">
          <DefinitionRow label="Tag number format">
            {tagClass.tagNumberFormat ??
              "Not specified"}
          </DefinitionRow>

          <DefinitionRow label="Synonyms">
            {tagClass.synonyms.length > 0
              ? tagClass.synonyms.join(", ")
              : "None"}
          </DefinitionRow>
        </InfoCard>
      </div>

      {tagClass.existenceReason && (
        <InfoCard title="Existence reason">
          <p className="tag-info-paragraph">
            {tagClass.existenceReason}
          </p>
        </InfoCard>
      )}

      <nav className="tag-page-contents" aria-label="On this page">
        <span>On this page</span>
        <a href="#tag-properties">Properties</a>
        <a href="#tag-related-equipment">Related Equipment Classes</a>
        <a href="#tag-required-documents">Required Documents</a>
        <a href="#tag-jip33">JIP33 Information Requirements</a>
        <a href="#tag-source-standards">Source Standards</a>
      </nav>

      <section id="tag-properties" className="tag-properties-section tag-section-anchor">
        <div className="tag-properties-heading">
          <div>
            <div className="tag-page-eyebrow">
              Information requirements
            </div>

            <h2>Properties</h2>

            {!propertiesLoading &&
              properties.length > 0 && (
                <div className="tag-property-summary">
                  <span>{directPropertyCount} direct</span>
                  <span className="tag-property-summary-separator">·</span>
                  <span>{inheritedPropertyCount} inherited</span>
                </div>
              )}
          </div>

          <div className="tag-property-heading-actions">
            {propertyGroupingViews.length > 0 && (
              <div
                className="tag-property-view-toggle"
                role="group"
                aria-label="Property presentation"
              >
                <button
                  type="button"
                  className={
                    propertyView === "all"
                      ? "tag-property-view-active"
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
                      ? "tag-property-view-active"
                      : undefined
                  }
                  onClick={() => setPropertyView("grouped")}
                >
                  {propertyGroupingViews[0]?.purposeCode ?? "Grouped"} grouping
                </button>
              </div>
            )}

            {!propertiesLoading && (
              <span className="tag-property-count">
                {propertyView === "grouped" && propertyGroupingViews.length > 0
                  ? `${propertyGroupingViews[0].propertyCount} grouped`
                  : `${properties.length} effective`}
              </span>
            )}
          </div>
        </div>

        {propertiesLoading || propertyGroupingsLoading ? (
          <div className="tag-properties-loading">
            <LoaderCircle className="tag-spinner" size={20} />
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
          <div className="tag-properties-empty">
            No properties are assigned to this Tag Class or its ancestors.
          </div>
        ) : (
          <PropertiesTable
            key={tagClass.id}
            properties={properties}
            onNavigateToClass={
              onNavigateToClass
            }
            onOpenProperty={onOpenProperty}
            onOpenUnit={onOpenUnit}
          />
        )}
      </section>

      <RelatedEquipmentClassesSection
        key={"related-equipment-" + tagClass.id}
        relationships={relatedEquipmentClasses}
        loading={relationshipsLoading}
        onOpenEquipmentClass={onOpenEquipmentClass}
      />

      <RequiredDocumentsSection
        key={"required-documents-" + tagClass.id}
        requirements={documentRequirements}
        loading={documentRequirementsLoading}
        onOpenDocument={onOpenDocument}
        onOpenStandard={onOpenStandard}
      />

      <Jip33RequirementsSection
        key={"jip33-" + tagClass.id}
        tagClassId={tagClass.id}
        onOpenDocument={onOpenDocument}
        onOpenStandard={onOpenStandard}
      />

      <SourceStandardsSection
        key={"source-standards-" + tagClass.id}
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
  properties: CfihosEffectiveTagClassProperty[];
  onOpenProperty: (property: CfihosEffectiveTagClassProperty) => void;
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
    <div className="tag-property-grouping">
      <div className="tag-property-grouping-intro">
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
          className="tag-property-group-card"
          key={group.id ?? group.code ?? group.description ?? "group"}
        >
          <div className="tag-property-group-heading">
            <div>
              <div className="tag-property-group-code">
                {group.code ?? "Property group"}
              </div>
              <h3>{group.description ?? group.code ?? "Property group"}</h3>
            </div>

            <div className="tag-property-group-meta">
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

          <div className="tag-property-group-list">
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
  effectiveProperty: CfihosEffectiveTagClassProperty | null;
  onOpenProperty: (property: CfihosEffectiveTagClassProperty) => void;
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
      <div className="tag-property-group-row tag-property-group-row-static">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="tag-property-group-row"
      onClick={() => onOpenProperty(effectiveProperty)}
    >
      {content}
    </button>
  );
}

type RelatedEquipmentClassesSectionProps = {
  relationships: CfihosResolvedTagEquipmentClassRelationship[];
  loading: boolean;
  onOpenEquipmentClass: (equipmentClassId: string) => void;
};

function RelatedEquipmentClassesSection({
  relationships,
  loading,
  onOpenEquipmentClass,
}: RelatedEquipmentClassesSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedRelationships = visibleItems(relationships, expanded);

  return (
    <section id="tag-related-equipment" className="tag-related-classes-section tag-section-anchor">
      <div className="tag-properties-heading">
        <div>
          <div className="tag-page-eyebrow">
            Class relationship
          </div>
          <h2>Related Equipment Classes</h2>
          <div className="tag-property-summary">
            Explicit mappings from the CFIHOS Tag–Equipment relationship table.
          </div>
        </div>

        {!loading && (
          <span className="tag-property-count">
            {relationships.length} mapped
          </span>
        )}
      </div>

      {loading ? (
        <div className="tag-related-classes-empty">
          <LoaderCircle className="tag-spinner" size={20} />
          Loading related Equipment Classes…
        </div>
      ) : relationships.length === 0 ? (
        <div className="tag-related-classes-empty">
          No explicit Equipment Class mapping is recorded for this Tag Class.
        </div>
      ) : (
        <>
          <div id="tag-related-equipment-list" className="tag-related-classes-grid">
          {displayedRelationships.map((item) => (
            <button
              key={`${item.tagClass.id}-${item.equipmentClass.id}`}
              type="button"
              className="tag-related-class-card"
              onClick={() =>
                onOpenEquipmentClass(item.equipmentClass.id)
              }
            >
              <div className="tag-related-class-main">
                <div>
                  <div className="tag-related-class-name">
                    {item.equipmentClass.name}
                  </div>
                  <div className="tag-related-class-code">
                    {item.equipmentClass.id}
                  </div>
                </div>

                <ChevronRight size={15} />
              </div>

              {item.relationship.mappingReason && (
                <div className="tag-related-class-reason">
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
            controls="tag-related-equipment-list"
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
  const tagCount = requirements.filter(
    (item) => item.requirement.assetType === "Tag",
  ).length;
  const modelPartCount = requirements.filter(
    (item) => item.requirement.assetType === "Model_Part",
  ).length;

  return (
    <section id="tag-required-documents" className="tag-required-documents-section tag-section-anchor">
      <div className="tag-properties-heading">
        <div>
          <div className="tag-page-eyebrow">
            Document requirements
          </div>
          <h2>Required Documents</h2>
          <div className="tag-property-summary">
            Explicit CFIHOS document requirements for this class and asset context.
          </div>
        </div>

        {!loading && (
          <span className="tag-property-count">
            {requirements.length} required
          </span>
        )}
      </div>

      {loading ? (
        <div className="tag-required-documents-empty">
          <LoaderCircle className="tag-spinner" size={20} />
          Loading required documents…
        </div>
      ) : requirements.length === 0 ? (
        <div className="tag-required-documents-empty">
          No Tag or Model / Part document requirement is recorded for this class.
        </div>
      ) : (
        <>
          <div className="tag-required-documents-summary">
            {tagCount > 0 && <span>Tag {tagCount}</span>}
            {modelPartCount > 0 && <span>Model / Part {modelPartCount}</span>}
          </div>
          <div id="tag-required-documents-list" className="tag-required-documents-table-wrapper">
            <table className="tag-required-documents-table">
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
                        className="tag-required-document-link"
                        onClick={() =>
                          onOpenDocument(item.requirement.documentTypeId)
                        }
                      >
                        {item.requirement.documentTypeName}
                        <ChevronRight size={12} />
                      </button>
                      <div className="tag-required-document-id">
                        {item.requirement.documentTypeId}
                      </div>
                    </td>
                    <td>
                      <span className="tag-required-document-context">
                        {item.requirement.assetType === "Model_Part"
                          ? "Model / Part"
                          : item.requirement.assetType}
                      </span>
                    </td>
                    <td>
                      {item.requirement.sourceStandardId ? (
                        <button
                          type="button"
                          className="tag-required-standard-link"
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
            controls="tag-required-documents-list"
            onToggle={() => setExpanded((value) => !value)}
          />
        </>
      )}
    </section>
  );
}

type Jip33RequirementsSectionProps = {
  tagClassId: string;
  onOpenDocument: (documentTypeId: string) => void;
  onOpenStandard: (sourceStandardId: string) => void;
};

function Jip33RequirementsSection({
  tagClassId,
  onOpenDocument,
  onOpenStandard,
}: Jip33RequirementsSectionProps) {
  const [requirements, setRequirements] = useState<CfihosJip33Requirement[]>([]);
  const [referenceDates, setReferenceDates] = useState<
    CfihosSubmissionReferenceDate[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      cfihosJip33RequirementRepository.getRequirementsForTagClass(tagClassId),
      cfihosSubmissionReferenceDateRepository.getAll(),
    ])
      .then(([items, dates]) => {
        if (!active) return;
        setRequirements(items);
        setReferenceDates(dates);
      })
      .catch((error) => {
        if (active) {
          setRequirements([]);
          setReferenceDates([]);
          console.error("Unable to load JIP33 requirements.", error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tagClassId]);

  const referenceDatesByCode = useMemo(() => {
    return new Map(
      referenceDates.map((item) => [item.code.trim().toLowerCase(), item]),
    );
  }, [referenceDates]);

  const displayedRequirements = visibleItems(requirements, expanded);

  const groups = useMemo(() => {
    const grouped = new Map<string, CfihosJip33Requirement[]>();
    for (const requirement of displayedRequirements) {
      const key = requirement.requirementGroupCode ?? "Other requirements";
      const current = grouped.get(key) ?? [];
      current.push(requirement);
      grouped.set(key, current);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [displayedRequirements]);

  return (
    <section id="tag-jip33" className="tag-jip33-section tag-section-anchor">
      <div className="tag-properties-heading">
        <div>
          <div className="tag-page-eyebrow">Specification overlay</div>
          <h2>JIP33 Information Requirements</h2>
          <div className="tag-property-summary">
            Additional specification requirements for this Tag Class. These are
            separate from CFIHOS CORE class-document requirements.
          </div>
        </div>
        {!loading && (
          <span className="tag-property-count">{requirements.length} requirements</span>
        )}
      </div>

      {loading ? (
        <div className="tag-properties-loading">
          <LoaderCircle className="tag-spinner" size={20} />
          Loading JIP33 requirements…
        </div>
      ) : requirements.length === 0 ? (
        <div className="tag-properties-empty">
          No JIP33 information requirement is mapped to this Tag Class.
        </div>
      ) : (
        <>
        <div id="tag-jip33-list" className="tag-jip33-groups">
          {groups.map(([groupName, groupRequirements]) => (
            <section className="tag-jip33-group" key={groupName}>
              <div className="tag-jip33-group-heading">
                <div>
                  <div className="tag-page-eyebrow">Requirement group</div>
                  <h3>{groupName}</h3>
                </div>
                <span>{groupRequirements.length}</span>
              </div>

              <div className="tag-jip33-list">
                {groupRequirements.map((requirement) => {
                  const mappings = requirement.mappings.filter(
                    (mapping) => mapping.tagClassId === tagClassId,
                  );
                  const primary = mappings[0];
                  return (
                    <details className="tag-jip33-requirement" key={requirement.id}>
                      <summary>
                        <div>
                          <strong>
                            {requirement.number ?? requirement.title ?? requirement.id}
                          </strong>
                          {requirement.title && requirement.title !== requirement.number && (
                            <span>{requirement.title}</span>
                          )}
                        </div>
                        <span className="tag-jip33-document-name">
                          {primary?.documentTypeName ?? "Document requirement"}
                        </span>
                      </summary>

                      <div className="tag-jip33-requirement-body">
                        {(requirement.description || requirement.typicalDeliverable) && (
                          <div className="tag-jip33-copy">
                            {requirement.description && <p>{requirement.description}</p>}
                            {requirement.typicalDeliverable && (
                              <p><strong>Typical deliverable:</strong> {requirement.typicalDeliverable}</p>
                            )}
                          </div>
                        )}

                        {mappings.map((mapping, index) => (
                          <Jip33MappingDetails
                            key={`${requirement.id}-${mapping.tagClassId}-${mapping.documentTypeId}-${index}`}
                            mapping={mapping}
                            sourceChapter={requirement.engineeringStandardSourceChapter}
                            referenceDatesByCode={referenceDatesByCode}
                            onOpenDocument={onOpenDocument}
                            onOpenStandard={onOpenStandard}
                          />
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <ExpansionControl
          expanded={expanded}
          total={requirements.length}
          label="requirements"
          controls="tag-jip33-list"
          onToggle={() => setExpanded((value) => !value)}
        />
        </>
      )}
    </section>
  );
}


function Jip33IndicatorChip({ label, value }: { label: string; value: string }) {
  const normalizedValue = value.trim().toLowerCase();
  const toneClass =
    normalizedValue === "yes"
      ? "tag-jip33-chip-positive"
      : normalizedValue === "no"
        ? "tag-jip33-chip-neutral"
        : "";

  return <span className={toneClass}>{label}: {value}</span>;
}

function Jip33MappingDetails({
  mapping,
  sourceChapter,
  referenceDatesByCode,
  onOpenDocument,
  onOpenStandard,
}: {
  mapping: CfihosJip33RequirementMapping;
  sourceChapter: string | null;
  referenceDatesByCode: Map<string, CfihosSubmissionReferenceDate>;
  onOpenDocument: (documentTypeId: string) => void;
  onOpenStandard: (sourceStandardId: string) => void;
}) {
  const timing = [
    formatJip33Timing(
      "Review",
      mapping.issueForReviewNumberOfWeeks,
      mapping.issueForReviewReferenceDate,
      referenceDatesByCode,
    ),
    formatJip33Timing(
      "Approval",
      mapping.issueForApprovalNumberOfWeeks,
      mapping.issueForApprovalReferenceDate,
      referenceDatesByCode,
    ),
    formatJip33Timing(
      "Information",
      mapping.forInformationNumberOfWeeks,
      mapping.forInformationReferenceDate,
      referenceDatesByCode,
    ),
  ].filter(Boolean) as string[];

  return (
    <div className="tag-jip33-mapping">
      <div className="tag-jip33-links">
        <button type="button" onClick={() => onOpenDocument(mapping.documentTypeId)}>
          {mapping.documentTypeName}<ChevronRight size={13} />
        </button>
        <button type="button" onClick={() => onOpenStandard(mapping.sourceStandardId)}>
          {mapping.sourceStandardCode ?? mapping.sourceStandardId}<ChevronRight size={13} />
        </button>
      </div>

      <div className="tag-jip33-chips">
        {mapping.submitAtProposal && (
          <Jip33IndicatorChip label="Proposal" value={mapping.submitAtProposal} />
        )}
        {mapping.submitForReview && (
          <Jip33IndicatorChip label="Review" value={mapping.submitForReview} />
        )}
        {mapping.submitAtDelivery && (
          <Jip33IndicatorChip label="Delivery" value={mapping.submitAtDelivery} />
        )}
        {mapping.requiredHandoverStatusCode && (
          <span>Handover: {mapping.requiredHandoverStatusCode}</span>
        )}
        {mapping.requiredTranslationIndicator && (
          <Jip33IndicatorChip
            label="Translation"
            value={mapping.requiredTranslationIndicator}
          />
        )}
        {mapping.deliverableFormatCode && <span>Format: {mapping.deliverableFormatCode}</span>}
      </div>

      {(sourceChapter || timing.length > 0) && (
        <div className="tag-jip33-meta">
          {sourceChapter && <span>Source chapter: {sourceChapter}</span>}
          {timing.length > 0 && <span>{timing.join(" · ")}</span>}
        </div>
      )}
    </div>
  );
}

function formatJip33Timing(
  label: string,
  numberOfWeeks: string | null,
  referenceDateCode: string | null,
  referenceDatesByCode: Map<string, CfihosSubmissionReferenceDate>,
): string | null {
  if (!numberOfWeeks && !referenceDateCode) {
    return null;
  }

  const referenceDate = referenceDateCode
    ? referenceDatesByCode.get(referenceDateCode.trim().toLowerCase())
    : null;

  if (numberOfWeeks && referenceDate?.description) {
    return `${label}: ${formatWeeks(numberOfWeeks)} ${formatReferenceDatePhrase(
      referenceDate.description,
    )} (${referenceDate.code})`;
  }

  if (numberOfWeeks && referenceDateCode) {
    return `${label}: ${formatWeeks(numberOfWeeks)} · ${referenceDateCode}`;
  }

  if (numberOfWeeks) {
    return `${label}: ${formatWeeks(numberOfWeeks)}`;
  }

  if (referenceDate?.description) {
    return `${label}: ${referenceDate.description} (${referenceDate.code})`;
  }

  return `${label}: ${referenceDateCode}`;
}

function formatWeeks(value: string): string {
  const normalized = value.trim();
  return `${normalized} ${normalized === "1" ? "week" : "weeks"}`;
}

function formatReferenceDatePhrase(description: string): string {
  const normalized = description.trim();

  if (normalized.toLowerCase().startsWith("weeks ")) {
    return normalized.slice("weeks ".length);
  }

  if (normalized.toLowerCase().startsWith("week ")) {
    return normalized.slice("week ".length);
  }

  return normalized;
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
    <section id="tag-source-standards" className="tag-standards-section tag-section-anchor">
      <div className="tag-properties-heading">
        <div>
          <div className="tag-page-eyebrow">
            Traceability
          </div>
          <h2>Source Standards</h2>
          <div className="tag-property-summary">
            <span>{uniqueDirectStandards.length} direct</span>
            <span className="tag-property-summary-separator">·</span>
            <span>{propertyStandards.length} property mappings</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="tag-standards-empty">
          <LoaderCircle className="tag-spinner" size={20} />
          Loading Source Standard provenance…
        </div>
      ) : uniqueDirectStandards.length === 0 &&
        propertyStandards.length === 0 ? (
        <div className="tag-standards-empty">
          No Source Standard provenance is recorded for this class.
        </div>
      ) : (
        <div id="tag-source-standards-list" className="tag-standards-grid">
          <div className="tag-standards-card">
            <h3>Direct class standards</h3>
            <p>Standards explicitly associated with this class.</p>

            {uniqueDirectStandards.length === 0 ? (
              <div className="tag-standards-card-empty">None</div>
            ) : (
              <div className="tag-standards-list">
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

          <div className="tag-standards-card tag-standards-card-wide">
            <h3>Property provenance</h3>
            <p>Property assignments traced to their originating standards.</p>

            {propertyStandards.length === 0 ? (
              <div className="tag-standards-card-empty">None</div>
            ) : (
              <div className="tag-standards-table-wrapper">
                <table className="tag-standards-table">
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
                          <div className="tag-property-code">
                            {item.propertyId}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="tag-standard-link"
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
          controls="tag-source-standards-list"
          onToggle={() => setExpanded((value) => !value)}
        />
      )}
    </section>
  );
}

type ClassBreadcrumbProps = {
  path: CfihosTagClass[];
  onNavigate: (tagClassId: string) => void;
};

function ClassBreadcrumb({
  path,
  onNavigate,
}: ClassBreadcrumbProps) {
  return (
    <nav
      className="tag-breadcrumb"
      aria-label="Tag Class hierarchy"
    >
      {path.map((item, index) => {
        const isCurrent =
          index === path.length - 1;

        return (
          <span
            className="tag-breadcrumb-item"
            key={item.id}
          >
            {index > 0 && (
              <ChevronRight
                className="tag-breadcrumb-separator"
                size={13}
              />
            )}

            {isCurrent ? (
              <span className="tag-breadcrumb-current">
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
  properties: CfihosEffectiveTagClassProperty[];
  onNavigateToClass: (tagClassId: string) => void;
  onOpenProperty: (
    property: CfihosEffectiveTagClassProperty,
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
    <div id="tag-properties-list" className="tag-properties-table-wrapper">
      <table className="tag-properties-table">
        <thead>
          <tr>
            <th>Property</th>
            <th>Assignment</th>
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
              sourceTagClassId,
              sourceTagClassName,
              inheritanceDepth,
            } = item;

            return (
              <tr
                key={`${property.id}-${sourceTagClassId}`}
              >
                <td>
                  <button
                    type="button"
                    className="tag-property-open"
                    onClick={() =>
                      onOpenProperty(item)
                    }
                  >
                    {property.name}
                    <ChevronRight size={13} />
                  </button>

                  <div className="tag-property-code">
                    {property.id}
                  </div>

                  {property.definition && (
                    <div className="tag-property-definition">
                      {property.definition}
                    </div>
                  )}
                </td>

                <td>
                  {assignmentType === "direct" ? (
                    <span className="tag-assignment-badge tag-assignment-direct">
                      Direct
                    </span>
                  ) : (
                    <div className="tag-assignment">
                      <span className="tag-assignment-badge tag-assignment-inherited">
                        Inherited
                      </span>

                      <button
                        type="button"
                        className="tag-inheritance-source"
                        onClick={() =>
                          onNavigateToClass(
                            sourceTagClassId,
                          )
                        }
                      >
                        from {sourceTagClassName}
                        <ChevronRight
                          size={12}
                        />
                      </button>

                      {inheritanceDepth > 1 && (
                        <div className="tag-inheritance-depth">
                          {inheritanceDepth} levels up
                        </div>
                      )}
                    </div>
                  )}
                </td>

                <td>
                  {property.dataType ?? "—"}

                  {property.dataTypeLength && (
                    <div className="tag-property-secondary">
                      Length{" "}
                      {property.dataTypeLength}
                    </div>
                  )}
                </td>

                <td>
                  {relationship.siUnit.id && relationship.siUnit.name ? (
                    <button
                      type="button"
                      className="tag-unit-link"
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
                      className="tag-unit-link"
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
                      className="tag-picklist-open"
                      onClick={() =>
                        onOpenProperty(item)
                      }
                    >
                      <span className="tag-picklist-name">
                        {property.picklistName}
                      </span>

                      <span className="tag-property-secondary">
                        {picklistValues.length}{" "}
                        {picklistValues.length === 1
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
      controls="tag-properties-list"
      onToggle={() => setExpanded((value) => !value)}
    />
    </>
  );
}

type PropertyDrawerProps = {
  item: CfihosEffectiveTagClassProperty;
  onClose: () => void;
  onNavigateToClass: (tagClassId: string) => void;
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
    sourceTagClassId,
    sourceTagClassName,
    inheritanceDepth,
  } = item;

  const [picklistQuery, setPicklistQuery] =
    useState("");

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
        field
          ?.toLowerCase()
          .includes(query),
      );
    });
  }, [picklistQuery, picklistValues]);

  return (
    <div
      className="tag-property-drawer-layer"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="tag-property-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Property: ${property.name}`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="tag-property-drawer-header">
          <div>
            <div className="tag-page-eyebrow">
              Property
            </div>

            <h2>{property.name}</h2>

            <div className="tag-property-drawer-code">
              <Hash size={13} />
              {property.id}
            </div>
          </div>

          <button
            type="button"
            className="tag-property-drawer-close"
            onClick={onClose}
            aria-label="Close property details"
          >
            <X size={18} />
          </button>
        </header>

        <div className="tag-property-drawer-body">
          {property.definition && (
            <p className="tag-property-drawer-definition">
              {property.definition}
            </p>
          )}

          <DrawerSection title="Assignment">
            <DrawerRow label="Assignment type">
              {assignmentType === "direct" ? (
                <span className="tag-assignment-badge tag-assignment-direct">
                  Direct
                </span>
              ) : (
                <span className="tag-assignment-badge tag-assignment-inherited">
                  Inherited
                </span>
              )}
            </DrawerRow>

            <DrawerRow label="Source class">
              <button
                type="button"
                className="tag-drawer-link"
                onClick={() =>
                  onNavigateToClass(
                    sourceTagClassId,
                  )
                }
              >
                {sourceTagClassName}
                <ChevronRight size={13} />
              </button>
            </DrawerRow>

            {assignmentType === "inherited" && (
              <DrawerRow label="Inheritance">
                {inheritanceDepth === 1
                  ? "Parent class"
                  : `${inheritanceDepth} levels up`}
              </DrawerRow>
            )}
          </DrawerSection>

          <DrawerSection title="Property definition">
            <DrawerRow label="Data type">
              {property.dataType ?? "Not specified"}
            </DrawerRow>

            <DrawerRow label="Data length">
              {property.dataTypeLength ?? "Not specified"}
            </DrawerRow>

            <DrawerRow label="Dimension">
              {property.unitOfMeasureDimensionCode ??
                "Not specified"}
            </DrawerRow>

            <DrawerRow label="SI unit">
              {relationship.siUnit.id && relationship.siUnit.name ? (
                <button
                  type="button"
                  className="tag-drawer-link"
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
                  className="tag-drawer-link"
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
              <p className="tag-drawer-paragraph">
                {property.existenceReason}
              </p>
            </DrawerSection>
          )}

          {property.picklistName && (
            <DrawerSection
              title="Picklist"
              badge={`${picklistValues.length} values`}
            >
              <div className="tag-drawer-picklist-heading">
                <div>
                  <div className="tag-drawer-picklist-name">
                    {property.picklistName}
                  </div>

                  {property.picklistId && (
                    <div className="tag-drawer-picklist-code">
                      {property.picklistId}
                    </div>
                  )}
                </div>
              </div>

              {picklistValues.length > 0 && (
                <>
                  <div className="tag-drawer-search">
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

                  <div className="tag-drawer-picklist-count">
                    {filteredPicklistValues.length} of{" "}
                    {picklistValues.length} values
                  </div>

                  <div className="tag-drawer-picklist">
                    {filteredPicklistValues.length ===
                    0 ? (
                      <div className="tag-drawer-picklist-empty">
                        No matching values.
                      </div>
                    ) : (
                      filteredPicklistValues.map(
                        (value) => (
                          <div
                            className="tag-drawer-picklist-item"
                            key={value.id}
                          >
                            <div className="tag-drawer-picklist-value-code">
                              {value.code}
                            </div>

                            {value.description && (
                              <div className="tag-drawer-picklist-description">
                                {value.description}
                              </div>
                            )}

                            {value.sourceStandardCode && (
                              <div className="tag-drawer-picklist-source">
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
    <section className="tag-drawer-section">
      <div className="tag-drawer-section-heading">
        <h3>{title}</h3>

        {badge && (
          <span>{badge}</span>
        )}
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
    <div className="tag-drawer-row">
      <div className="tag-drawer-row-label">
        {label}
      </div>

      <div className="tag-drawer-row-value">
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
    <section className="tag-info-card">
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
    <div className="tag-definition-row">
      <div className="tag-definition-label">
        {label}
      </div>

      <div className="tag-definition-value">
        {children}
      </div>
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="tag-empty-selection">
      <div className="tag-empty-icon">
        <Tags size={28} />
      </div>

      <h2>Select a Tag Class</h2>

      <p>
        Browse the hierarchy or search for a
        Tag Class to view its definition,
        classification and effective properties.
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
    <div className="tag-status-screen">
      <div className="tag-status-icon">
        {icon}
      </div>

      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}