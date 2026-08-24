import {
  ArrowRight,
  BookOpen,
  Boxes,
  CircleAlert,
  Database,
  FileText,
  GitBranch,
  Layers3,
  ListChecks,
  LoaderCircle,
  Ruler,
  Shapes,
  Tags,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  cfihosRepository,
} from "../cfihos/repository/CfihosRepository";

import {
  cfihosEquipmentRepository,
} from "../cfihos/repository/CfihosEquipmentRepository";

import {
  cfihosDocumentRepository,
} from "../cfihos/repository/CfihosDocumentRepository";

import {
  cfihosSourceStandardRepository,
} from "../cfihos/repository/CfihosSourceStandardRepository";

import {
  cfihosUnitOfMeasureRepository,
} from "../cfihos/repository/CfihosUnitOfMeasureRepository";

import {
  cfihosJip33RequirementRepository,
} from "../cfihos/repository/CfihosJip33RequirementRepository";

import type {
  CfihosHandoverEvent,
} from "../cfihos/model/handoverEvent";

import {
  cfihosHandoverEventRepository,
} from "../cfihos/repository/CfihosHandoverEventRepository";

import "./DataModelPage.css";

type ModelCounts = {
  tagClasses: number;
  equipmentClasses: number;
  properties: number;
  picklists: number;
  disciplines: number;
  documentTypes: number;
  disciplineDocumentRelationships: number;
  sourceStandards: number;
  unitsOfMeasure: number;
  dimensions: number;
  jip33Requirements: number;
  jip33Mappings: number;
  jip33TagClasses: number;
  jip33SourceStandards: number;
  jip33DocumentTypes: number;
};

type LoadState =
  | {
      status: "loading";
    }
  | {
      status: "success";
      counts: ModelCounts;
      handoverEvents: CfihosHandoverEvent[];
    }
  | {
      status: "error";
      message: string;
    };

export function DataModelPage() {
  const navigate = useNavigate();

  const [state, setState] =
    useState<LoadState>({
      status: "loading",
    });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [
          tagClasses,
          equipmentClasses,
          properties,
          disciplines,
          documentTypes,
          documentRelationships,
          sourceStandards,
          unitsOfMeasure,
          jip33Summary,
          handoverEvents,
        ] = await Promise.all([
          cfihosRepository.getTagClasses(),

          cfihosEquipmentRepository.getEquipmentClasses(),

          cfihosRepository.getProperties(),

          cfihosDocumentRepository.getDisciplines(),

          cfihosDocumentRepository.getDocumentTypes(),

          cfihosDocumentRepository.getRelationships(),

          cfihosSourceStandardRepository.getSourceStandards(),

          cfihosUnitOfMeasureRepository.getUnits(),

          cfihosJip33RequirementRepository.getSummary(),

          cfihosHandoverEventRepository.getHandoverEvents(),
        ]);

        if (!active) {
          return;
        }

        const picklistIds =
          new Set<string>();

        const dimensionIds =
          new Set<string>();

        for (const unit of unitsOfMeasure) {
          if (unit.dimensionId) {
            dimensionIds.add(unit.dimensionId);
          }
        }

        for (const property of properties) {
          if (property.picklistId) {
            picklistIds.add(
              property.picklistId,
            );
          }
        }

        setState({
          status: "success",
          counts: {
            tagClasses:
              tagClasses.length,

            equipmentClasses:
              equipmentClasses.length,

            properties:
              properties.length,

            picklists:
              picklistIds.size,

            disciplines:
              disciplines.length,

            documentTypes:
              documentTypes.length,

            disciplineDocumentRelationships:
              documentRelationships.length,

            sourceStandards:
              sourceStandards.length,

            unitsOfMeasure:
              unitsOfMeasure.length,

            dimensions:
              dimensionIds.size,

            jip33Requirements:
              jip33Summary.requirementCount,

            jip33Mappings:
              jip33Summary.mappingCount,

            jip33TagClasses:
              jip33Summary.tagClassCount,

            jip33SourceStandards:
              jip33Summary.sourceStandardCount,

            jip33DocumentTypes:
              jip33Summary.documentTypeCount,
          },
          handoverEvents,
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
              : "Unable to build the CFIHOS information model.",
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <ModelStatus
        icon={
          <LoaderCircle
            className="data-model-spinner"
            size={26}
          />
        }
        title="Building Data Model"
        message="Loading the validated CFIHOS domains and relationships…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <ModelStatus
        icon={<CircleAlert size={26} />}
        title="Unable to build Data Model"
        message={state.message}
      />
    );
  }

  const { counts, handoverEvents } = state;

  return (
    <div className="data-model-page">
      <div className="data-model-inner">
        <header className="data-model-header">
          <div className="data-model-eyebrow">
            Model
          </div>

          <h1>
            CFIHOS Information Model
          </h1>

          <p>
            A navigable logical view of the
            CFIHOS domains currently implemented
            in the Explorer and the relationships
            that connect them.
          </p>
        </header>

        <div className="data-model-summary">
          <SummaryMetric
            value={
              counts.tagClasses +
              counts.equipmentClasses
            }
            label="Classes"
          />

          <SummaryMetric
            value={counts.properties}
            label="Properties"
          />

          <SummaryMetric
            value={
              counts.disciplineDocumentRelationships
            }
            label="Document contexts"
          />

          <SummaryMetric
            value={
              counts.sourceStandards
            }
            label="Source Standards"
          />
        </div>

        <section className="data-model-section">
          <SectionHeading
            eyebrow="Classification"
            title="Classes & properties"
            description="Tag and Equipment Classes form independent hierarchies while sharing the CFIHOS property catalogue."
          />

          <div className="data-model-classification-map">
            <div className="data-model-column">
              <ModelNode
                icon={Tags}
                eyebrow="Class hierarchy"
                title="Tag Classes"
                count={counts.tagClasses}
                description="Functional and physical tag classification with parent-child inheritance."
                route="/classes/tag"
                onNavigate={navigate}
              />

              <RelationshipArrow
                label="parent / child"
                direction="vertical"
              />

              <RelationshipNote>
                Properties assigned higher in the
                hierarchy can be inherited by
                descendant Tag Classes.
              </RelationshipNote>
            </div>

            <div className="data-model-center-column">
              <div className="data-model-horizontal-relation">
                <span>
                  assigns / inherits
                </span>
              </div>

              <ModelNode
                icon={BookOpen}
                eyebrow="Shared definition"
                title="Properties"
                count={counts.properties}
                description="Reusable information requirements with datatype, units, definitions and controlled values."
                route="/dictionary"
                onNavigate={navigate}
                emphasized
              />

              <RelationshipArrow
                label="controlled by"
                direction="vertical"
              />

              <ModelNode
                icon={ListChecks}
                eyebrow="Controlled vocabulary"
                title="Property Picklists"
                count={counts.picklists}
                description="Reusable controlled-value sets associated with properties."
                route="/dictionary"
                onNavigate={navigate}
              />
            </div>

            <div className="data-model-column">
              <ModelNode
                icon={Boxes}
                eyebrow="Class hierarchy"
                title="Equipment Classes"
                count={
                  counts.equipmentClasses
                }
                description="Equipment classification with parent-child inheritance and equipment-specific property relevance."
                route="/classes/equipment"
                onNavigate={navigate}
              />

              <RelationshipArrow
                label="parent / child"
                direction="vertical"
              />

              <RelationshipNote>
                Equipment Classes independently
                inherit effective properties from
                their ancestors.
              </RelationshipNote>
            </div>
          </div>
        </section>


        <section className="data-model-section">
          <SectionHeading
            eyebrow="Measurement semantics"
            title="Properties, dimensions & units"
            description="Properties declare a CFIHOS measurement dimension, while class-property assignments reference concrete SI and Imperial Units of Measure."
          />

          <div className="data-model-measurement-flow">
            <ModelNode
              icon={BookOpen}
              eyebrow="Information definition"
              title="Properties"
              count={counts.properties}
              description="Property definitions identify the applicable measurement dimension where physical quantities are involved."
              route="/dictionary"
              onNavigate={navigate}
            />

            <RelationshipArrow
              label="classified by"
            />

            <ModelNode
              icon={Layers3}
              eyebrow="Measurement dimension"
              title="Dimensions"
              count={counts.dimensions}
              description="Reusable quantity dimensions such as length, pressure, temperature and power per area."
              route="/units"
              onNavigate={navigate}
              emphasized
            />

            <RelationshipArrow
              label="contains"
            />

            <ModelNode
              icon={Ruler}
              eyebrow="Reference domain"
              title="Units of Measure"
              count={counts.unitsOfMeasure}
              description="CFIHOS units, symbols and reference identifiers grouped by measurement dimension."
              route="/units"
              onNavigate={navigate}
            />
          </div>

          <div className="data-model-measurement-strip">
            <div>
              <div className="data-model-eyebrow">
                Assignment semantics
              </div>
              <strong>Class Property → Unit of Measure</strong>
              <span>Tag SI</span>
              <span>Tag Imperial</span>
              <span>Equipment SI</span>
              <span>Equipment Imperial</span>
            </div>

            <button
              type="button"
              onClick={() => navigate("/units")}
            >
              Open Units of Measure
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="data-model-section">
          <SectionHeading
            eyebrow="Information requirements"
            title="Disciplines, documents & lifecycle"
            description="The Discipline–Document Type relationship provides the context in which document requirements and lifecycle statuses are defined."
          />

          <div className="data-model-document-flow">
            <ModelNode
              icon={Shapes}
              eyebrow="Engineering domain"
              title="Disciplines"
              count={counts.disciplines}
              description="Engineering and project disciplines that require information."
              route="/disciplines"
              onNavigate={navigate}
            />

            <RelationshipArrow
              label="requires"
            />

            <ModelNode
              icon={Workflow}
              eyebrow="Relationship entity"
              title="Discipline × Document Type"
              count={
                counts.disciplineDocumentRelationships
              }
              description="Context, asset type, representation, delivery timing and lifecycle requirements."
              route="/lifecycle"
              onNavigate={navigate}
              emphasized
            />

            <RelationshipArrow
              label="references"
            />

            <ModelNode
              icon={FileText}
              eyebrow="Information deliverable"
              title="Document Types"
              count={counts.documentTypes}
              description="Reusable CFIHOS document definitions associated with one or more disciplines."
              route="/documents"
              onNavigate={navigate}
            />
          </div>

          <div className="data-model-lifecycle-strip">
            <div>
              <div className="data-model-eyebrow">
                Lifecycle attributes
              </div>

              <strong>
                Required document status
              </strong>

              {handoverEvents.map((event) => (
                <span key={event.id}>
                  {displayHandoverEventName(event.name)}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/lifecycle")
              }
            >
              Open Lifecycle Requirements
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="data-model-section">
          <SectionHeading
            eyebrow="Specification overlay"
            title="JIP33 information requirements"
            description="JIP33 specifications add detailed document and data requirements for selected Tag Classes. This layer remains distinct from CFIHOS CORE class-document requirements."
          />

          <div className="data-model-classification-map">
            <div className="data-model-column">
              <ModelNode
                icon={Database}
                eyebrow="Specification source"
                title="JIP33 Source Standards"
                count={counts.jip33SourceStandards}
                description="JIP33 specifications that define detailed information requirements."
                route="/standards"
                onNavigate={navigate}
              />
            </div>

            <div className="data-model-center-column">
              <div className="data-model-horizontal-relation">
                <span>defines</span>
              </div>

              <ModelNode
                icon={FileText}
                eyebrow="Specification requirement"
                title="JIP33 Requirements"
                count={counts.jip33Requirements}
                description={`${counts.jip33Mappings} mappings connect requirement entities to Tag Classes and Document Types.`}
                route="/classes/tag"
                onNavigate={navigate}
                emphasized
              />
            </div>

            <div className="data-model-column">
              <ModelNode
                icon={Tags}
                eyebrow="Applicability"
                title="Covered Tag Classes"
                count={counts.jip33TagClasses}
                description={`${counts.jip33DocumentTypes} Document Types are used by the JIP33 requirement mappings.`}
                route="/classes/tag"
                onNavigate={navigate}
              />
            </div>
          </div>

          <div className="data-model-lifecycle-strip">
            <div>
              <span className="data-model-lifecycle-label">Relationship semantics</span>
              <strong>JIP33 Requirement → Tag Class × Document Type</strong>
            </div>
            <span>separate from CORE</span>
          </div>
        </section>

        <section className="data-model-section">
          <SectionHeading
            eyebrow="Traceability"
            title="Source Standards & provenance"
            description="Source Standards provide traceability from CFIHOS classes, properties and controlled values back to the originating technical references."
          />

          <div className="data-model-provenance-layout">
            <ModelNode
              icon={Database}
              eyebrow="Reference source"
              title="Source Standards"
              count={
                counts.sourceStandards
              }
              description="Standards, specifications and external references used to define CFIHOS requirements."
              route="/standards"
              onNavigate={navigate}
              emphasized
            />

            <div className="data-model-provenance-arrows">
              <RelationshipLine>
                Class → Standard
              </RelationshipLine>

              <RelationshipLine>
                Class → Property → Standard
              </RelationshipLine>

              <RelationshipLine>
                Picklist Value → Standard
              </RelationshipLine>
            </div>

            <div className="data-model-provenance-targets">
              <MiniNode
                icon={Tags}
                title="Tag Classes"
              />

              <MiniNode
                icon={Boxes}
                title="Equipment Classes"
              />

              <MiniNode
                icon={BookOpen}
                title="Properties"
              />

              <MiniNode
                icon={ListChecks}
                title="Controlled Values"
              />
            </div>
          </div>
        </section>

        <section className="data-model-section">
          <SectionHeading
            eyebrow="Relationship catalogue"
            title="Implemented relationships"
            description="A semantic summary of the relationships currently used by the Explorer."
          />

          <div className="data-model-relationship-table-wrapper">
            <table className="data-model-relationship-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Relationship</th>
                  <th>To</th>
                  <th>Explorer behaviour</th>
                </tr>
              </thead>

              <tbody>
                <RelationshipRow
                  from="Tag Class"
                  relationship="parent / child"
                  to="Tag Class"
                  behaviour="Hierarchy with inherited effective properties"
                />

                <RelationshipRow
                  from="Equipment Class"
                  relationship="parent / child"
                  to="Equipment Class"
                  behaviour="Hierarchy with inherited effective properties"
                />

                <RelationshipRow
                  from="Tag Class"
                  relationship="has property"
                  to="Property"
                  behaviour="Direct and inherited information requirements"
                />

                <RelationshipRow
                  from="Equipment Class"
                  relationship="has property"
                  to="Property"
                  behaviour="Direct and inherited information requirements"
                />

                <RelationshipRow
                  from="Property"
                  relationship="uses"
                  to="Property Picklist"
                  behaviour="Controlled value definition"
                />

                <RelationshipRow
                  from="Property"
                  relationship="has dimension"
                  to="Measurement Dimension"
                  behaviour="Quantity semantics from the property master"
                />

                <RelationshipRow
                  from="Measurement Dimension"
                  relationship="contains"
                  to="Unit of Measure"
                  behaviour="Dimension family of compatible CFIHOS units"
                />

                <RelationshipRow
                  from="Class Property"
                  relationship="uses"
                  to="Unit of Measure"
                  behaviour="Explicit SI and Imperial unit assignment"
                />

                <RelationshipRow
                  from="Discipline"
                  relationship="requires"
                  to="Document Type"
                  behaviour="Resolved through Discipline × Document Type context"
                />

                <RelationshipRow
                  from="Discipline × Document Type"
                  relationship="defines"
                  to="Lifecycle Status"
                  behaviour="Required status per project phase"
                />

                <RelationshipRow
                  from="JIP33 Source Standard"
                  relationship="defines"
                  to="JIP33 Requirement"
                  behaviour="Specification-specific document and data requirement"
                />

                <RelationshipRow
                  from="JIP33 Requirement"
                  relationship="applies to"
                  to="Tag Class"
                  behaviour="Explicit JIP33 applicability mapping"
                />

                <RelationshipRow
                  from="JIP33 Requirement"
                  relationship="uses"
                  to="Document Type"
                  behaviour="Specification deliverable classification; distinct from CORE class requirements"
                />

                <RelationshipRow
                  from="Class"
                  relationship="references"
                  to="Source Standard"
                  behaviour="Direct class-standard provenance"
                />

                <RelationshipRow
                  from="Class Property"
                  relationship="derived from"
                  to="Source Standard"
                  behaviour="Property-level provenance including source section"
                />

                <RelationshipRow
                  from="Picklist Value"
                  relationship="derived from"
                  to="Source Standard"
                  behaviour="Controlled-value provenance"
                />
              </tbody>
            </table>
          </div>
        </section>

        <div className="data-model-scope-note">
          <GitBranch size={17} />

          <div>
            <strong>
              Model scope
            </strong>

            <span>
              This view intentionally represents
              relationships already validated and
              implemented in the Explorer. It is
              not intended to reproduce every
              worksheet in the CFIHOS workbook as
              a database ERD.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type ModelNodeProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  count: number;
  description: string;
  route: string;
  onNavigate: (route: string) => void;
  emphasized?: boolean;
};

function ModelNode({
  icon: Icon,
  eyebrow,
  title,
  count,
  description,
  route,
  onNavigate,
  emphasized = false,
}: ModelNodeProps) {
  return (
    <button
      type="button"
      className={`data-model-node ${
        emphasized
          ? "data-model-node-emphasized"
          : ""
      }`}
      onClick={() =>
        onNavigate(route)
      }
    >
      <div className="data-model-node-top">
        <div className="data-model-node-icon">
          <Icon size={19} />
        </div>

        <span className="data-model-node-count">
          {count}
        </span>
      </div>

      <div className="data-model-node-eyebrow">
        {eyebrow}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      <div className="data-model-node-open">
        Explore
        <ArrowRight size={13} />
      </div>
    </button>
  );
}

function MiniNode({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="data-model-mini-node">
      <Icon size={16} />
      <span>{title}</span>
    </div>
  );
}

function RelationshipArrow({
  label,
  direction = "horizontal",
}: {
  label: string;
  direction?: "horizontal" | "vertical";
}) {
  return (
    <div
      className={`data-model-arrow data-model-arrow-${direction}`}
    >
      <span>{label}</span>
      <ArrowRight size={15} />
    </div>
  );
}

function RelationshipLine({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="data-model-relationship-line">
      <span>{children}</span>
      <ArrowRight size={14} />
    </div>
  );
}

function RelationshipNote({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="data-model-relationship-note">
      <Layers3 size={15} />
      <span>{children}</span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="data-model-section-heading">
      <div className="data-model-eyebrow">
        {eyebrow}
      </div>

      <h2>{title}</h2>

      <p>{description}</p>
    </div>
  );
}

function SummaryMetric({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="data-model-summary-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RelationshipRow({
  from,
  relationship,
  to,
  behaviour,
}: {
  from: string;
  relationship: string;
  to: string;
  behaviour: string;
}) {
  return (
    <tr>
      <td>
        <strong>{from}</strong>
      </td>

      <td>
        <span className="data-model-relation-badge">
          {relationship}
        </span>
      </td>

      <td>
        <strong>{to}</strong>
      </td>

      <td>{behaviour}</td>
    </tr>
  );
}

function displayHandoverEventName(name: string): string {
  const prefix = "handover for ";
  const normalized = name.trim();
  const phaseName = normalized.toLowerCase().startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;

  return phaseName.replace(/(^|[\s-])\S/g, (match) => match.toUpperCase());
}

function ModelStatus({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="data-model-status">
      <div className="data-model-status-icon">
        {icon}
      </div>

      <h1>{title}</h1>
      <p>{message}</p>
    </div>
  );
}