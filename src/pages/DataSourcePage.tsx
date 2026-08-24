import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Database,
  GitBranch,
  LoaderCircle,
  Rows3,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CFIHOS_SOURCE } from "../cfihos/source";
import {
  getCfihosSheetNames,
  getCfihosWorksheetRows,
  inspectCfihosWorksheet,
  type CfihosWorksheetInspection,
} from "../cfihos/workbook";
import {
  cfihosRepository,
  type CfihosHierarchyDiagnostics,
  type CfihosInheritanceExample,
} from "../cfihos/repository/CfihosRepository";
import {
  cfihosEquipmentRepository,
  type CfihosEquipmentHierarchyDiagnostics,
  type CfihosEquipmentInheritanceExample,
} from "../cfihos/repository/CfihosEquipmentRepository";
import {
  cfihosClassRelationshipRepository,
} from "../cfihos/repository/CfihosClassRelationshipRepository";
import type {
  CfihosClassRelationshipDiagnostics,
} from "../cfihos/model/classRelationship";
import {
  cfihosClassDocumentRepository,
} from "../cfihos/repository/CfihosClassDocumentRepository";
import type {
  CfihosClassDocumentDiagnostics,
} from "../cfihos/model/classDocumentRequirement";
import {
  cfihosUnitOfMeasureRepository,
} from "../cfihos/repository/CfihosUnitOfMeasureRepository";
import type {
  CfihosUnitOfMeasureDiagnostics,
} from "../cfihos/model/unitOfMeasure";
import {
  cfihosPropertyGroupingRepository,
} from "../cfihos/repository/CfihosPropertyGroupingRepository";
import type {
  CfihosPropertyGroupingDiagnostics,
} from "../cfihos/model/propertyGrouping";
import { cfihosJip33RequirementRepository } from "../cfihos/repository/CfihosJip33RequirementRepository";
import type { CfihosJip33RequirementDiagnostics } from "../cfihos/model/jip33Requirement";
import { cfihosHandoverEventRepository } from "../cfihos/repository/CfihosHandoverEventRepository";
import type { CfihosHandoverEventDiagnostics } from "../cfihos/model/handoverEvent";
import { cfihosRdlObjectRegistryRepository } from "../cfihos/repository/CfihosRdlObjectRegistryRepository";
import type { CfihosRdlObjectRegistryDiagnostics } from "../cfihos/model/rdlObjectRegistry";
import { cfihosSourceStandardRequirementCoverageRepository } from "../cfihos/repository/CfihosSourceStandardRequirementCoverageRepository";
import type { CfihosSourceStandardRequirementCoverageDiagnostics } from "../cfihos/model/sourceStandardRequirementCoverage";
import { cfihosSourceStandardRequirementOrphanAuditRepository } from "../cfihos/repository/CfihosSourceStandardRequirementOrphanAuditRepository";
import type { CfihosSourceStandardRequirementOrphanAuditDiagnostics } from "../cfihos/model/sourceStandardRequirementOrphanAudit";
import { cfihosTagOrEquipmentClassFamilyRepository } from "../cfihos/repository/CfihosTagOrEquipmentClassFamilyRepository";
import type { CfihosTagOrEquipmentClassFamilyDiagnostics } from "../cfihos/model/tagOrEquipmentClassFamily";
import { cfihosEntityAttributeFamilyRepository } from "../cfihos/repository/CfihosEntityAttributeFamilyRepository";
import type { CfihosEntityAttributeFamilyDiagnostics } from "../cfihos/model/entityAttributeFamily";
import { cfihosApplicationConditionFamilyRepository } from "../cfihos/repository/CfihosApplicationConditionFamilyRepository";
import type { CfihosApplicationConditionFamilyDiagnostics } from "../cfihos/model/applicationConditionFamily";
import { cfihosSubmissionReferenceDateFamilyRepository } from "../cfihos/repository/CfihosSubmissionReferenceDateFamilyRepository";
import type { CfihosSubmissionReferenceDateFamilyDiagnostics } from "../cfihos/model/submissionReferenceDateFamily";
import { cfihosPropertyPicklistFamilyRepository } from "../cfihos/repository/CfihosPropertyPicklistFamilyRepository";
import type { CfihosPropertyPicklistFamilyDiagnostics } from "../cfihos/model/propertyPicklistFamily";
import { cfihosPropertyGroupingPurposeFamilyRepository } from "../cfihos/repository/CfihosPropertyGroupingPurposeFamilyRepository";
import type { CfihosPropertyGroupingPurposeFamilyDiagnostics } from "../cfihos/model/propertyGroupingPurposeFamily";
import { cfihosUnitOfMeasureDimensionFamilyRepository } from "../cfihos/repository/CfihosUnitOfMeasureDimensionFamilyRepository";
import type { CfihosUnitOfMeasureDimensionFamilyDiagnostics } from "../cfihos/model/unitOfMeasureDimensionFamily";
import { cfihosUnitDimensionIdentifierReconciliationRepository } from "../cfihos/repository/CfihosUnitDimensionIdentifierReconciliationRepository";
import type { CfihosUnitDimensionIdentifierReconciliationDiagnostics } from "../cfihos/model/unitDimensionIdentifierReconciliation";
import { cfihosExternalEquivalenceOrphanAuditRepository } from "../cfihos/repository/CfihosExternalEquivalenceOrphanAuditRepository";
import type { CfihosExternalEquivalenceOrphanAuditDiagnostics } from "../cfihos/model/externalEquivalenceOrphanAudit";
import { cfihosConditionModelSemanticAuditRepository } from "../cfihos/repository/CfihosConditionModelSemanticAuditRepository";
import type { CfihosConditionModelSemanticAuditDiagnostics } from "../cfihos/model/conditionModelSemanticAudit";

const TAG_CLASS_INSPECTION_SHEETS = [
  "tag class",
  "tag class property",
  "property",
  "property picklist values",
] as const;

const EQUIPMENT_CLASS_INSPECTION_SHEETS = [
  "equipment class",
  "equipment class property",
  "tag equipment class relationshi",
] as const;

const DOCUMENT_REQUIREMENT_INSPECTION_SHEETS = [
  "document required per class",
] as const;

const UNIT_OF_MEASURE_INSPECTION_SHEETS = [
  "unit of measure",
] as const;

const JIP33_INSPECTION_SHEETS = [
  "Jip33 info required spec",
] as const;

const HANDOVER_EVENT_INSPECTION_SHEETS = [
  "handover event",
] as const;

const OBJECT_EQUIVALENT_MAPPING_INSPECTION_SHEETS = [
  "CFIHOS object equivalent mappin",
] as const;

const RDL_MASTER_OBJECT_INSPECTION_SHEETS = [
  "RDL master object",
] as const;

const INSPECTION_SHEETS = [
  ...TAG_CLASS_INSPECTION_SHEETS,
  ...EQUIPMENT_CLASS_INSPECTION_SHEETS,
  ...DOCUMENT_REQUIREMENT_INSPECTION_SHEETS,
  ...UNIT_OF_MEASURE_INSPECTION_SHEETS,
  ...JIP33_INSPECTION_SHEETS,
  ...HANDOVER_EVENT_INSPECTION_SHEETS,
  ...OBJECT_EQUIVALENT_MAPPING_INSPECTION_SHEETS,
  ...RDL_MASTER_OBJECT_INSPECTION_SHEETS,
] as const;

type CfihosEquipmentRequirementDomainMismatchRow = {
  classId: string;
  className: string;
  requirementCount: number;
  documentTypes: string[];
  tagClassName: string | null;
  equipmentClassName: string | null;
  mappedEquipmentClasses: Array<{ id: string; name: string }>;
  classification: "tag-only" | "equipment-present" | "both-domains" | "absent-from-both";
};

type CfihosEquipmentRequirementDomainMismatchDiagnostics = {
  unresolvedEquipmentRequirementCount: number;
  distinctClassCount: number;
  tagOnlyClassCount: number;
  equipmentPresentClassCount: number;
  bothDomainsClassCount: number;
  absentFromBothClassCount: number;
  tagOnlyRequirementCount: number;
  absentFromBothRequirementCount: number;
  classesWithEquipmentMappingCount: number;
  rows: CfihosEquipmentRequirementDomainMismatchRow[];
};

type CfihosJip33DuplicateGroupRow = {
  requirementId: string;
  rowCount: number;
  classification: "exact-duplicate" | "context-variant" | "semantic-conflict";
  tagClasses: string[];
  sourceStandards: string[];
  documentTypes: string[];
  disciplines: string[];
  differingColumns: string[];
  requirementNumber: string;
  title: string;
};

type CfihosJip33DuplicateAuditDiagnostics = {
  requirementRowCount: number;
  uniqueRequirementIdCount: number;
  duplicateRequirementIdCount: number;
  duplicateGroupRowCount: number;
  excessRowCount: number;
  pairOnlyGroupCount: number;
  exactDuplicateGroupCount: number;
  contextVariantGroupCount: number;
  semanticConflictGroupCount: number;
  groupsWithMultipleTagClassesCount: number;
  groupsWithMultipleDocumentTypesCount: number;
  groupsWithMultipleSourceStandardsCount: number;
  groups: CfihosJip33DuplicateGroupRow[];
};

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      sheetNames: string[];
      inspections: CfihosWorksheetInspection[];

      hierarchyDiagnostics: CfihosHierarchyDiagnostics;
      inheritanceExample: CfihosInheritanceExample | null;

      equipmentHierarchyDiagnostics: CfihosEquipmentHierarchyDiagnostics;
      equipmentInheritanceExample: CfihosEquipmentInheritanceExample | null;

      classRelationshipDiagnostics: CfihosClassRelationshipDiagnostics;
      classDocumentDiagnostics: CfihosClassDocumentDiagnostics;
      unitOfMeasureDiagnostics: CfihosUnitOfMeasureDiagnostics;
      propertyGroupingDiagnostics: CfihosPropertyGroupingDiagnostics;
      jip33Diagnostics: CfihosJip33RequirementDiagnostics;
      handoverEventDiagnostics: CfihosHandoverEventDiagnostics;
      rdlObjectRegistryDiagnostics: CfihosRdlObjectRegistryDiagnostics;
      sourceStandardRequirementCoverageDiagnostics: CfihosSourceStandardRequirementCoverageDiagnostics;
      sourceStandardRequirementOrphanAuditDiagnostics: CfihosSourceStandardRequirementOrphanAuditDiagnostics;
      tagOrEquipmentClassFamilyDiagnostics: CfihosTagOrEquipmentClassFamilyDiagnostics;
      entityAttributeFamilyDiagnostics: CfihosEntityAttributeFamilyDiagnostics;
      applicationConditionFamilyDiagnostics: CfihosApplicationConditionFamilyDiagnostics;
      submissionReferenceDateFamilyDiagnostics: CfihosSubmissionReferenceDateFamilyDiagnostics;
      propertyPicklistFamilyDiagnostics: CfihosPropertyPicklistFamilyDiagnostics;
      propertyGroupingPurposeFamilyDiagnostics: CfihosPropertyGroupingPurposeFamilyDiagnostics;
      unitOfMeasureDimensionFamilyDiagnostics: CfihosUnitOfMeasureDimensionFamilyDiagnostics;
      unitDimensionIdentifierReconciliationDiagnostics: CfihosUnitDimensionIdentifierReconciliationDiagnostics;
      externalEquivalenceOrphanAuditDiagnostics: CfihosExternalEquivalenceOrphanAuditDiagnostics;
      conditionModelSemanticAuditDiagnostics: CfihosConditionModelSemanticAuditDiagnostics;
      equipmentRequirementDomainMismatchDiagnostics: CfihosEquipmentRequirementDomainMismatchDiagnostics;
      jip33DuplicateAuditDiagnostics: CfihosJip33DuplicateAuditDiagnostics;
    }
  | { status: "error"; message: string };

export function DataSourcePage() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [
          sheetNames,
          inspections,
          hierarchyDiagnostics,
          inheritanceExample,
          equipmentHierarchyDiagnostics,
          equipmentInheritanceExample,
          classRelationshipDiagnostics,
          classDocumentDiagnostics,
          unitOfMeasureDiagnostics,
          propertyGroupingDiagnostics,
          jip33Diagnostics,
          handoverEventDiagnostics,
          rdlObjectRegistryDiagnostics,
          sourceStandardRequirementCoverageDiagnostics,
          sourceStandardRequirementOrphanAuditDiagnostics,
          tagOrEquipmentClassFamilyDiagnostics,
          entityAttributeFamilyDiagnostics,
          applicationConditionFamilyDiagnostics,
          submissionReferenceDateFamilyDiagnostics,
          propertyPicklistFamilyDiagnostics,
          propertyGroupingPurposeFamilyDiagnostics,
          unitOfMeasureDimensionFamilyDiagnostics,
          unitDimensionIdentifierReconciliationDiagnostics,
          externalEquivalenceOrphanAuditDiagnostics,
          conditionModelSemanticAuditDiagnostics,
        ] = await Promise.all([
          getCfihosSheetNames(),

          Promise.all(
            INSPECTION_SHEETS.map((sheetName) =>
              inspectCfihosWorksheet(sheetName, 5),
            ),
          ),

          cfihosRepository.getHierarchyDiagnostics(),

          cfihosRepository.findTagClassWithMixedPropertyInheritance(),

          cfihosEquipmentRepository.getHierarchyDiagnostics(),

          cfihosEquipmentRepository.findEquipmentClassWithMixedPropertyInheritance(),

          cfihosClassRelationshipRepository.getDiagnostics(),

          cfihosClassDocumentRepository.getDiagnostics(),

          cfihosUnitOfMeasureRepository.getDiagnostics(),

          cfihosPropertyGroupingRepository.getDiagnostics(),
          cfihosJip33RequirementRepository.getDiagnostics(),
          cfihosHandoverEventRepository.getDiagnostics(),
          cfihosRdlObjectRegistryRepository.getDiagnostics(),
          cfihosSourceStandardRequirementCoverageRepository.getDiagnostics(),
          cfihosSourceStandardRequirementOrphanAuditRepository.getDiagnostics(),
          cfihosTagOrEquipmentClassFamilyRepository.getDiagnostics(),
          cfihosEntityAttributeFamilyRepository.getDiagnostics(),
          cfihosApplicationConditionFamilyRepository.getDiagnostics(),
          cfihosSubmissionReferenceDateFamilyRepository.getDiagnostics(),
          cfihosPropertyPicklistFamilyRepository.getDiagnostics(),
          cfihosPropertyGroupingPurposeFamilyRepository.getDiagnostics(),
          cfihosUnitOfMeasureDimensionFamilyRepository.getDiagnostics(),
          cfihosUnitDimensionIdentifierReconciliationRepository.getDiagnostics(),
          cfihosExternalEquivalenceOrphanAuditRepository.getDiagnostics(),
          cfihosConditionModelSemanticAuditRepository.getDiagnostics(),
        ]);

        const equipmentRequirementDomainMismatchDiagnostics =
          await buildEquipmentRequirementDomainMismatchDiagnostics(
            classDocumentDiagnostics,
          );

        const jip33DuplicateAuditDiagnostics =
          await buildJip33DuplicateAuditDiagnostics();

        if (active) {
          setState({
            status: "success",
            sheetNames,
            inspections,
            hierarchyDiagnostics,
            inheritanceExample,
            equipmentHierarchyDiagnostics,
            equipmentInheritanceExample,
            classRelationshipDiagnostics,
            classDocumentDiagnostics,
            unitOfMeasureDiagnostics,
            propertyGroupingDiagnostics,
            jip33Diagnostics,
            handoverEventDiagnostics,
            rdlObjectRegistryDiagnostics,
            sourceStandardRequirementCoverageDiagnostics,
            sourceStandardRequirementOrphanAuditDiagnostics,
            tagOrEquipmentClassFamilyDiagnostics,
            entityAttributeFamilyDiagnostics,
            applicationConditionFamilyDiagnostics,
            submissionReferenceDateFamilyDiagnostics,
            propertyPicklistFamilyDiagnostics,
            propertyGroupingPurposeFamilyDiagnostics,
            unitOfMeasureDimensionFamilyDiagnostics,
            unitDimensionIdentifierReconciliationDiagnostics,
            externalEquivalenceOrphanAuditDiagnostics,
            conditionModelSemanticAuditDiagnostics,
            equipmentRequirementDomainMismatchDiagnostics,
            jip33DuplicateAuditDiagnostics,
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error while loading the CFIHOS workbook.",
          });
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const equipmentInspections =
    state.status === "success"
      ? state.inspections.filter((inspection) =>
          EQUIPMENT_CLASS_INSPECTION_SHEETS.includes(
            inspection.sheetName as
              (typeof EQUIPMENT_CLASS_INSPECTION_SHEETS)[number],
          ),
        )
      : [];

  const existingInspections =
    state.status === "success"
      ? state.inspections.filter(
          (inspection) =>
            !EQUIPMENT_CLASS_INSPECTION_SHEETS.includes(
              inspection.sheetName as
                (typeof EQUIPMENT_CLASS_INSPECTION_SHEETS)[number],
            ),
        )
      : [];

  return (
    <div className="placeholder-page">
      <div className="eyebrow">Data source</div>

      <h1>CFIHOS Reference Data Library</h1>

      <p>
        The Explorer is reading the official CFIHOS {CFIHOS_SOURCE.version} CORE
        Reference Data Library, validating class hierarchies and inspecting the
        worksheets required for the application domain models.
      </p>

      <div className="placeholder-panel">
        {state.status === "loading" && (
          <>
            <LoaderCircle className="spin" size={22} />

            <div>
              <strong>Loading official CFIHOS workbook</strong>
              <span>
                Downloading, indexing and validating the Excel reference
                library…
              </span>
            </div>
          </>
        )}

        {state.status === "success" && (
          <>
            <CheckCircle2 size={22} />

            <div>
              <strong>Reference Data Library loaded successfully</strong>

              <span>
                Found {state.sheetNames.length} worksheets, validated{" "}
                {state.hierarchyDiagnostics.tagClassCount} Tag Classes and{" "}
                {state.equipmentHierarchyDiagnostics.equipmentClassCount}{" "}
                Equipment Classes.
              </span>
            </div>
          </>
        )}

        {state.status === "error" && (
          <>
            <XCircle size={22} />

            <div>
              <strong>Unable to load the Reference Data Library</strong>
              <span>{state.message}</span>
            </div>
          </>
        )}
      </div>

      {state.status === "success" && (
        <>
          <ClassRelationshipDiagnosticsPanel
            diagnostics={state.classRelationshipDiagnostics}
          />

          <ClassDocumentDiagnosticsPanel
            diagnostics={state.classDocumentDiagnostics}
          />

          <EquipmentRequirementDomainMismatchDiagnosticsPanel
            diagnostics={state.equipmentRequirementDomainMismatchDiagnostics}
          />

          <UnitOfMeasureDiagnosticsPanel
            diagnostics={state.unitOfMeasureDiagnostics}
          />

          <PropertyGroupingDiagnosticsPanel
            diagnostics={state.propertyGroupingDiagnostics}
          />

          <Jip33DiagnosticsPanel diagnostics={state.jip33Diagnostics} />
          <Jip33DuplicateAuditPanel
            diagnostics={state.jip33DuplicateAuditDiagnostics}
          />

          <HandoverEventDiagnosticsPanel diagnostics={state.handoverEventDiagnostics} />

          <RdlObjectRegistryDiagnosticsPanel diagnostics={state.rdlObjectRegistryDiagnostics} />
          <ExternalEquivalenceOrphanAuditDiagnosticsPanel
            diagnostics={state.externalEquivalenceOrphanAuditDiagnostics}
          />
          <SourceStandardRequirementCoverageDiagnosticsPanel
            diagnostics={state.sourceStandardRequirementCoverageDiagnostics}
          />
          <SourceStandardRequirementOrphanAuditDiagnosticsPanel
            diagnostics={state.sourceStandardRequirementOrphanAuditDiagnostics}
          />

          <TagOrEquipmentClassFamilyDiagnosticsPanel
            diagnostics={state.tagOrEquipmentClassFamilyDiagnostics}
          />

          <EntityAttributeFamilyDiagnosticsPanel
            diagnostics={state.entityAttributeFamilyDiagnostics}
          />

          <ApplicationConditionFamilyDiagnosticsPanel
            diagnostics={state.applicationConditionFamilyDiagnostics}
          />
          <ConditionModelSemanticAuditDiagnosticsPanel
            diagnostics={state.conditionModelSemanticAuditDiagnostics}
          />

          <SubmissionReferenceDateFamilyDiagnosticsPanel
            diagnostics={state.submissionReferenceDateFamilyDiagnostics}
          />

          <PropertyGroupingPurposeFamilyDiagnosticsPanel
            diagnostics={state.propertyGroupingPurposeFamilyDiagnostics}
          />

          <UnitOfMeasureDimensionFamilyDiagnosticsPanel
            diagnostics={state.unitOfMeasureDimensionFamilyDiagnostics}
          />

          <UnitDimensionIdentifierReconciliationDiagnosticsPanel
            diagnostics={state.unitDimensionIdentifierReconciliationDiagnostics}
          />

          <PropertyPicklistFamilyDiagnosticsPanel
            diagnostics={state.propertyPicklistFamilyDiagnostics}
          />

          <EquipmentHierarchyDiagnosticsPanel
            diagnostics={state.equipmentHierarchyDiagnostics}
          />

          <EquipmentInheritanceExamplePanel
            example={state.equipmentInheritanceExample}
          />

          <EquipmentInspectionIntro
            inspections={equipmentInspections}
          />

          {equipmentInspections.map((inspection) => (
            <WorksheetInspection
              key={inspection.sheetName}
              inspection={inspection}
              accent="equipment"
            />
          ))}

          <HierarchyDiagnosticsPanel
            diagnostics={state.hierarchyDiagnostics}
          />

          <InheritanceExamplePanel
            example={state.inheritanceExample}
          />

          <WorkbookOverview sheetNames={state.sheetNames} />

          {existingInspections.map((inspection) => (
            <WorksheetInspection
              key={inspection.sheetName}
              inspection={inspection}
            />
          ))}
        </>
      )}
    </div>
  );
}






type UnitDimensionIdentifierReconciliationDiagnosticsPanelProps = {
  diagnostics: CfihosUnitDimensionIdentifierReconciliationDiagnostics;
};

function UnitDimensionIdentifierReconciliationDiagnosticsPanel({
  diagnostics,
}: UnitDimensionIdentifierReconciliationDiagnosticsPanelProps) {
  const needsReview =
    diagnostics.unresolvedComponentIdCount > 0 ||
    diagnostics.partiallyResolvedCompoundExpressionCount > 0 ||
    diagnostics.unresolvedAtomicExpressionCount > 0;

  const compoundIssues = diagnostics.issues.filter(
    (item) => item.componentIds.length > 1,
  );

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: needsReview ? "#ead7b7" : "#c8ddd8",
        background: needsReview
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Unit-dimension expression reconciliation</div>
          <h2 style={titleStyle}>Compound Unit dimension diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 920,
            }}
          >
            Distinguishes atomic Unit dimension references from semicolon-separated compound
            dimension expressions, then validates every component ID independently against the
            179 canonical RDL master dimensions.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: needsReview ? "#fff4e5" : "var(--brand-soft)",
            color: needsReview ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {needsReview ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {needsReview ? "Review unresolved components" : "Compound dimensions reconciled"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Expression population</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Units" value={diagnostics.unitCount} />
        <DiagnosticMetric label="Raw dimension expressions" value={diagnostics.rawExpressionCount} />
        <DiagnosticMetric label="Canonical master dimensions" value={diagnostics.canonicalMasterDimensionCount} />
        <DiagnosticMetric label="Atomic expressions" value={diagnostics.atomicExpressionCount} />
        <DiagnosticMetric label="Compound expressions" value={diagnostics.compoundExpressionCount} />
        <DiagnosticMetric label="Units using compounds" value={diagnostics.unitsUsingCompoundExpressionCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Component reconciliation</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Distinct component IDs" value={diagnostics.distinctComponentIdCount} />
        <DiagnosticMetric label="Resolved component IDs" value={diagnostics.resolvedComponentIdCount} />
        <DiagnosticMetric label="Unresolved component IDs" value={diagnostics.unresolvedComponentIdCount} warning={diagnostics.unresolvedComponentIdCount > 0} />
        <DiagnosticMetric label="Fully resolved compounds" value={diagnostics.fullyResolvedCompoundExpressionCount} />
        <DiagnosticMetric label="Partially resolved compounds" value={diagnostics.partiallyResolvedCompoundExpressionCount} warning={diagnostics.partiallyResolvedCompoundExpressionCount > 0} />
        <DiagnosticMetric label="Unresolved atomic expressions" value={diagnostics.unresolvedAtomicExpressionCount} warning={diagnostics.unresolvedAtomicExpressionCount > 0} />
      </div>

      {compoundIssues.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Compound expression detail</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Dimension expression</th>
                  <th style={tableHeaderStyle}>Codes / names</th>
                  <th style={tableHeaderStyle}>Components</th>
                  <th style={tableHeaderStyle}>Resolution</th>
                  <th style={tableHeaderStyle}>Units</th>
                  <th style={tableHeaderStyle}>Sample units</th>
                </tr>
              </thead>
              <tbody>
                {compoundIssues.map((item) => (
                  <tr key={item.expression}>
                    <td style={tableCellStyle}><strong>{item.expression}</strong></td>
                    <td style={tableCellStyle}>
                      <strong>{item.dimensionCodes.join("; ") || "—"}</strong>
                      {item.dimensionNames.length > 0 ? <div>{item.dimensionNames.join("; ")}</div> : null}
                    </td>
                    <td style={tableCellStyle}>{item.componentIds.join(" + ")}</td>
                    <td style={tableCellStyle}>
                      {item.unresolvedComponentIds.length === 0
                        ? `All ${item.resolvedComponentIds.length} components resolve`
                        : `Unresolved: ${item.unresolvedComponentIds.join(", ")}`}
                    </td>
                    <td style={tableCellStyle}>{item.unitCount}</td>
                    <td style={tableCellStyle}>{item.sampleUnits.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}


type UnitOfMeasureDimensionFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosUnitOfMeasureDimensionFamilyDiagnostics;
};

function UnitOfMeasureDimensionFamilyDiagnosticsPanel({ diagnostics }: UnitOfMeasureDimensionFamilyDiagnosticsPanelProps) {
  const hasIssues = diagnostics.duplicateMasterDimensionIdCount > 0 || diagnostics.unresolvedPropertyDimensionCount > 0 || diagnostics.unresolvedUnitDimensionCount > 0 || diagnostics.masterOnlyDimensionCount > 0;
  return (
    <section style={{ ...sectionStyle, borderColor: hasIssues ? "#ead7b7" : "#c8ddd8", background: hasIssues ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)" : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)" }}>
      <div style={headingStyle}><div><div style={eyebrowStyle}>Measurement-dimension completeness validation</div><h2 style={titleStyle}>Unit of Measure Dimension family diagnostics</h2><p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 900 }}>Reconciles the RDL master “unit of measure dimension” family against Property measurement-dimension references and the Unit of Measure catalogue.</p></div><div style={{ display:"inline-flex",alignItems:"center",gap:7,padding:"7px 10px",borderRadius:8,background:hasIssues?"#fff4e5":"var(--brand-soft)",color:hasIssues?"#9a6414":"var(--brand-dark)",fontSize:11,fontWeight:700 }}>{hasIssues?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>} {hasIssues?"Review dimension gaps":"Dimension family reconciled"}</div></div>
      <div style={diagnosticGroupLabelStyle}>Master family</div><div style={diagnosticMetricGridStyle}><DiagnosticMetric label="Master dimensions" value={diagnostics.masterDimensionCount}/><DiagnosticMetric label="Unique dimension IDs" value={diagnostics.uniqueMasterDimensionIdCount}/><DiagnosticMetric label="Duplicate dimension IDs" value={diagnostics.duplicateMasterDimensionIdCount} warning={diagnostics.duplicateMasterDimensionIdCount>0}/></div>
      <div style={diagnosticGroupLabelStyle}>Property → Dimension</div><div style={diagnosticMetricGridStyle}><DiagnosticMetric label="Properties" value={diagnostics.propertyCount}/><DiagnosticMetric label="Properties with dimension" value={diagnostics.propertiesWithDimensionCount}/><DiagnosticMetric label="Distinct dimensions" value={diagnostics.uniquePropertyDimensionCount}/><DiagnosticMetric label="Resolved dimensions" value={diagnostics.resolvedPropertyDimensionCount}/><DiagnosticMetric label="Unresolved dimensions" value={diagnostics.unresolvedPropertyDimensionCount} warning={diagnostics.unresolvedPropertyDimensionCount>0}/></div>
      <div style={diagnosticGroupLabelStyle}>Dimension → Unit of Measure</div><div style={diagnosticMetricGridStyle}><DiagnosticMetric label="Units" value={diagnostics.unitCount}/><DiagnosticMetric label="Units with dimension" value={diagnostics.unitsWithDimensionCount}/><DiagnosticMetric label="Distinct dimensions" value={diagnostics.uniqueUnitDimensionCount}/><DiagnosticMetric label="Resolved dimensions" value={diagnostics.resolvedUnitDimensionCount}/><DiagnosticMetric label="Unresolved dimensions" value={diagnostics.unresolvedUnitDimensionCount} warning={diagnostics.unresolvedUnitDimensionCount>0}/></div>
      <div style={diagnosticGroupLabelStyle}>Coverage</div><div style={diagnosticMetricGridStyle}><DiagnosticMetric label="Master dimensions referenced" value={diagnostics.referencedMasterDimensionCount}/><DiagnosticMetric label="Used by both" value={diagnostics.dimensionsUsedByBothCount}/><DiagnosticMetric label="Property only" value={diagnostics.propertyOnlyDimensionCount}/><DiagnosticMetric label="Unit only" value={diagnostics.unitOnlyDimensionCount}/><DiagnosticMetric label="Master-only dimensions" value={diagnostics.masterOnlyDimensionCount} warning={diagnostics.masterOnlyDimensionCount>0}/></div><div style={{marginTop:12,color:"var(--muted)",fontSize:11.5}}>Master-dimension coverage: <strong style={{color:"var(--ink)"}}>{diagnostics.masterCoveragePercent}%</strong></div>
      {diagnostics.representativeDimensions.length>0 && <><div style={diagnosticGroupLabelStyle}>Representative dimensions</div><div style={tableWrapperStyle}><table style={{...tableStyle,minWidth:850}}><thead><tr><th style={tableHeaderStyle}>Dimension</th><th style={tableHeaderStyle}>CFIHOS ID</th><th style={tableHeaderStyle}>Properties</th><th style={tableHeaderStyle}>Units</th></tr></thead><tbody>{diagnostics.representativeDimensions.map(item=><tr key={item.id}><td style={tableCellStyle}><strong>{item.name}</strong></td><td style={tableCellStyle}>{item.id}</td><td style={tableCellStyle}>{item.propertyCount}</td><td style={tableCellStyle}>{item.unitCount}</td></tr>)}</tbody></table></div></>}
      {(diagnostics.masterOnlyDimensions.length>0||diagnostics.unresolvedPropertyDimensionIds.length>0||diagnostics.unresolvedUnitDimensionIds.length>0)&&<div style={{marginTop:14,padding:"12px 14px",border:"1px solid #ead7b7",borderRadius:9,background:"#fffaf2",color:"#7c5a26",fontSize:11,lineHeight:1.55}}>{diagnostics.masterOnlyDimensions.length>0&&<div><strong>Master-only dimensions:</strong> {diagnostics.masterOnlyDimensions.map(x=>`${x.name} (${x.id})`).join(", ")}</div>}{diagnostics.unresolvedPropertyDimensionIds.length>0&&<div><strong>Unresolved Property dimensions:</strong> {diagnostics.unresolvedPropertyDimensionIds.join(", ")}</div>}{diagnostics.unresolvedUnitDimensionIds.length>0&&<div><strong>Unresolved Unit dimensions:</strong> {diagnostics.unresolvedUnitDimensionIds.join(", ")}</div>}</div>}
    </section>
  );
}

type PropertyGroupingPurposeFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosPropertyGroupingPurposeFamilyDiagnostics;
};

function PropertyGroupingPurposeFamilyDiagnosticsPanel({
  diagnostics,
}: PropertyGroupingPurposeFamilyDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.duplicateMasterPurposeIdCount > 0 ||
    diagnostics.unresolvedPurposeReferenceCount > 0 ||
    diagnostics.masterOnlyPurposeCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Grouping-purpose completeness validation</div>
          <h2 style={titleStyle}>Property Grouping Purpose family diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 880,
            }}
          >
            Reconciles the RDL master family “property grouping or decomposition purpose”
            against every Property Grouping assignment. This verifies whether the single
            purpose definition is the authoritative semantic parent of the grouping model.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review purpose mapping" : "Purpose family reconciled"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master family</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Master purposes" value={diagnostics.masterPurposeCount} />
        <DiagnosticMetric label="Unique purpose IDs" value={diagnostics.uniqueMasterPurposeIdCount} />
        <DiagnosticMetric label="Duplicate purpose IDs" value={diagnostics.duplicateMasterPurposeIdCount} warning={diagnostics.duplicateMasterPurposeIdCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Property Grouping usage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Grouping rows" value={diagnostics.groupingRowCount} />
        <DiagnosticMetric label="Rows with purpose" value={diagnostics.rowsWithPurposeReferenceCount} />
        <DiagnosticMetric label="Distinct purpose IDs" value={diagnostics.uniquePurposeReferenceCount} />
        <DiagnosticMetric label="Resolved purposes" value={diagnostics.resolvedPurposeReferenceCount} />
        <DiagnosticMetric label="Unresolved purposes" value={diagnostics.unresolvedPurposeReferenceCount} warning={diagnostics.unresolvedPurposeReferenceCount > 0} />
        <DiagnosticMetric label="Master-only purposes" value={diagnostics.masterOnlyPurposeCount} warning={diagnostics.masterOnlyPurposeCount > 0} />
      </div>

      <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 11.5 }}>
        Master-purpose coverage: <strong style={{ color: "var(--ink)" }}>{diagnostics.purposeCoveragePercent}%</strong>
      </div>

      {diagnostics.purposes.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Authoritative purpose definition</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>CFIHOS ID</th>
                  <th style={tableHeaderStyle}>Purpose</th>
                  <th style={tableHeaderStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.purposes.map((item) => (
                  <tr key={item.id}>
                    <td style={tableCellStyle}>{item.id}</td>
                    <td style={tableCellStyle}><strong>{item.name}</strong></td>
                    <td style={tableCellStyle}>{item.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(diagnostics.unresolvedPurposeIds.length > 0 || diagnostics.masterOnlyPurposes.length > 0) && (
        <div style={{ marginTop: 14, padding: "12px 14px", border: "1px solid #ead7b7", borderRadius: 9, background: "#fffaf2", color: "#7c5a26", fontSize: 11, lineHeight: 1.55 }}>
          {diagnostics.unresolvedPurposeIds.length > 0 && (
            <div><strong>Unresolved purpose IDs:</strong> {diagnostics.unresolvedPurposeIds.join(", ")}</div>
          )}
          {diagnostics.masterOnlyPurposes.length > 0 && (
            <div><strong>Master-only purposes:</strong> {diagnostics.masterOnlyPurposes.map((item) => `${item.name} (${item.id})`).join(", ")}</div>
          )}
        </div>
      )}
    </section>
  );
}


type PropertyPicklistFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosPropertyPicklistFamilyDiagnostics;
};

function PropertyPicklistFamilyDiagnosticsPanel({
  diagnostics,
}: PropertyPicklistFamilyDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.unresolvedPropertyPicklistReferenceCount > 0 ||
    diagnostics.unresolvedValueParentPicklistCount > 0 ||
    diagnostics.unresolvedValueMasterObjectCount > 0 ||
    diagnostics.masterOnlyPicklistCount > 0 ||
    diagnostics.picklistsWithoutValuesCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Controlled-vocabulary completeness validation</div>
          <h2 style={titleStyle}>Property Picklist family diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 900,
            }}
          >
            Reconciles RDL master Property Picklists and Property Picklist Values
            against Property definitions and the 3,027-row picklist-value worksheet.
            This validates the production chain Property → Picklist → Picklist Value.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review picklist gaps" : "Picklist chain reconciled"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master registry</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Property Picklists" value={diagnostics.masterPicklistCount} />
        <DiagnosticMetric label="Unique picklist IDs" value={diagnostics.uniqueMasterPicklistIdCount} />
        <DiagnosticMetric label="Duplicate picklist IDs" value={diagnostics.duplicateMasterPicklistIdCount} warning={diagnostics.duplicateMasterPicklistIdCount > 0} />
        <DiagnosticMetric label="Picklist Value objects" value={diagnostics.masterPicklistValueCount} />
        <DiagnosticMetric label="Unique value IDs" value={diagnostics.uniqueMasterPicklistValueIdCount} />
        <DiagnosticMetric label="Duplicate value IDs" value={diagnostics.duplicateMasterPicklistValueIdCount} warning={diagnostics.duplicateMasterPicklistValueIdCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Property → Picklist</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Properties" value={diagnostics.propertyCount} />
        <DiagnosticMetric label="Properties using picklists" value={diagnostics.propertiesWithPicklistCount} />
        <DiagnosticMetric label="Unique picklists referenced" value={diagnostics.uniquePropertyPicklistReferenceCount} />
        <DiagnosticMetric label="Resolved picklists" value={diagnostics.resolvedPropertyPicklistReferenceCount} />
        <DiagnosticMetric label="Unresolved picklists" value={diagnostics.unresolvedPropertyPicklistReferenceCount} warning={diagnostics.unresolvedPropertyPicklistReferenceCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Picklist → Picklist Value</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Value rows" value={diagnostics.picklistValueRowCount} />
        <DiagnosticMetric label="Parent picklists used" value={diagnostics.uniqueValueParentPicklistCount} />
        <DiagnosticMetric label="Resolved parent picklists" value={diagnostics.resolvedValueParentPicklistCount} />
        <DiagnosticMetric label="Unresolved parent picklists" value={diagnostics.unresolvedValueParentPicklistCount} warning={diagnostics.unresolvedValueParentPicklistCount > 0} />
        <DiagnosticMetric label="Value master objects resolved" value={diagnostics.resolvedValueMasterObjectCount} />
        <DiagnosticMetric label="Value IDs outside master" value={diagnostics.unresolvedValueMasterObjectCount} warning={diagnostics.unresolvedValueMasterObjectCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Coverage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Master picklists referenced" value={diagnostics.referencedMasterPicklistCount} />
        <DiagnosticMetric label="Master-only picklists" value={diagnostics.masterOnlyPicklistCount} warning={diagnostics.masterOnlyPicklistCount > 0} />
        <DiagnosticMetric label="Picklists without values" value={diagnostics.picklistsWithoutValuesCount} warning={diagnostics.picklistsWithoutValuesCount > 0} />
        <DiagnosticMetric label="Relationship chain complete" value={diagnostics.propertyToPicklistToValueComplete ? 1 : 0} warning={!diagnostics.propertyToPicklistToValueComplete} />
      </div>

      {diagnostics.representativePicklists.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Representative production picklists</div>
          <div style={{ ...tableWrapperStyle, marginBottom: 14 }}>
            <table style={{ ...tableStyle, minWidth: 850 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Picklist</th>
                  <th style={tableHeaderStyle}>CFIHOS ID</th>
                  <th style={tableHeaderStyle}>Properties</th>
                  <th style={tableHeaderStyle}>Values</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.representativePicklists.map((item) => (
                  <tr key={item.picklistId}>
                    <td style={tableCellStyle}><strong>{item.picklistName}</strong></td>
                    <td style={tableCellStyle}>{item.picklistId}</td>
                    <td style={tableCellStyle}>{item.propertyCount}</td>
                    <td style={tableCellStyle}>{item.valueCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(diagnostics.masterOnlyPicklists.length > 0 || diagnostics.picklistsWithoutValues.length > 0) && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            border: "1px solid #ead7b7",
            borderRadius: 9,
            background: "#fffaf2",
            color: "#7c5a26",
            fontSize: 11,
            lineHeight: 1.55,
          }}
        >
          {diagnostics.masterOnlyPicklists.length > 0 && (
            <div><strong>Master-only picklists:</strong> {diagnostics.masterOnlyPicklists.map((item) => `${item.name} (${item.id})`).join(", ")}</div>
          )}
          {diagnostics.picklistsWithoutValues.length > 0 && (
            <div><strong>Picklists without values:</strong> {diagnostics.picklistsWithoutValues.map((item) => `${item.name} (${item.id})`).join(", ")}</div>
          )}
        </div>
      )}
    </section>
  );
}

type SubmissionReferenceDateFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosSubmissionReferenceDateFamilyDiagnostics;
};

function SubmissionReferenceDateFamilyDiagnosticsPanel({
  diagnostics,
}: SubmissionReferenceDateFamilyDiagnosticsPanelProps) {
  const hasMasterOnlyObjects = diagnostics.masterOnlyObjectCount > 0;
  const hasSemanticUsage = diagnostics.referencedMasterObjectCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasMasterOnlyObjects ? "#ead7b7" : "#c8ddd8",
        background: hasMasterOnlyObjects
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Reference-date semantics discovery</div>
          <h2 style={titleStyle}>Submission Reference Date family diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 860,
            }}
          >
            Reconciles the seven RDL master objects classified as “submission reference
            date” against all workbook worksheets, while separately inspecting populated
            columns whose headers contain “reference date”. This distinguishes identifier
            usage from literal date/value fields such as the JIP33 timing attributes.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: hasMasterOnlyObjects ? "#fff4e5" : "var(--brand-soft)",
            color: hasMasterOnlyObjects ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasMasterOnlyObjects ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasMasterOnlyObjects
            ? "Review master-only objects"
            : hasSemanticUsage
              ? "Reference-date objects used"
              : "Family reconciled"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master family</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Submission Reference Dates" value={diagnostics.masterObjectCount} />
        <DiagnosticMetric label="Worksheets scanned" value={diagnostics.worksheetsScannedCount} />
        <DiagnosticMetric label="ID occurrences" value={diagnostics.idOccurrenceCount} />
        <DiagnosticMetric label="Name occurrences" value={diagnostics.nameOccurrenceCount} />
        <DiagnosticMetric label="Referenced objects" value={diagnostics.referencedMasterObjectCount} />
        <DiagnosticMetric
          label="Master-only objects"
          value={diagnostics.masterOnlyObjectCount}
          warning={diagnostics.masterOnlyObjectCount > 0}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Workbook reference-date fields</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Reference-date columns" value={diagnostics.referenceDateFieldCount} />
        <DiagnosticMetric label="Populated values" value={diagnostics.populatedReferenceDateValueCount} />
        <DiagnosticMetric label="Values matching master IDs" value={diagnostics.referenceDateMasterIdMatchCount} />
        <DiagnosticMetric label="Values matching master names" value={diagnostics.referenceDateMasterNameMatchCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Authoritative master objects</div>
      <div style={{ ...tableWrapperStyle, marginBottom: 14 }}>
        <table style={{ ...tableStyle, minWidth: 850 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>CFIHOS ID</th>
              <th style={tableHeaderStyle}>Submission Reference Date</th>
              <th style={tableHeaderStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.masterObjects.map((item) => (
              <tr key={item.id}>
                <td style={tableCellStyle}>{item.id}</td>
                <td style={tableCellStyle}><strong>{item.name}</strong></td>
                <td style={tableCellStyle}>{item.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diagnostics.referenceDateFields.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Reference-date field usage</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Worksheet</th>
                  <th style={tableHeaderStyle}>Column</th>
                  <th style={tableHeaderStyle}>Populated</th>
                  <th style={tableHeaderStyle}>Unique values</th>
                  <th style={tableHeaderStyle}>Master ID matches</th>
                  <th style={tableHeaderStyle}>Master name matches</th>
                  <th style={tableHeaderStyle}>Sample values</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.referenceDateFields.map((field) => (
                  <tr key={`${field.sheetName}-${field.columnName}`}>
                    <td style={tableCellStyle}><strong>{field.sheetName}</strong></td>
                    <td style={tableCellStyle}>{field.columnName}</td>
                    <td style={tableCellStyle}>{field.nonEmptyValueCount}</td>
                    <td style={tableCellStyle}>{field.uniqueValueCount}</td>
                    <td style={tableCellStyle}>{field.masterIdMatchCount}</td>
                    <td style={tableCellStyle}>{field.masterNameMatchCount}</td>
                    <td style={tableCellStyle}>{field.sampleValues.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {diagnostics.occurrences.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Master-object occurrences outside RDL master</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Object</th>
                  <th style={tableHeaderStyle}>Worksheet</th>
                  <th style={tableHeaderStyle}>Excel row</th>
                  <th style={tableHeaderStyle}>Column</th>
                  <th style={tableHeaderStyle}>Matched by</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.occurrences.map((item, index) => (
                  <tr key={`${item.sheetName}-${item.excelRow}-${item.columnName}-${index}`}>
                    <td style={tableCellStyle}><strong>{item.objectName}</strong><div>{item.objectId}</div></td>
                    <td style={tableCellStyle}>{item.sheetName}</td>
                    <td style={tableCellStyle}>{item.excelRow}</td>
                    <td style={tableCellStyle}>{item.columnName}</td>
                    <td style={tableCellStyle}>{item.matchedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}


type ConditionModelSemanticAuditDiagnosticsPanelProps = {
  diagnostics: CfihosConditionModelSemanticAuditDiagnostics;
};

function ConditionModelSemanticAuditDiagnosticsPanel({
  diagnostics,
}: ConditionModelSemanticAuditDiagnosticsPanelProps) {
  const allDescriptionsPresent =
    diagnostics.applicationConditionsWithDescriptionCount === diagnostics.applicationConditionCount &&
    diagnostics.requirementConditionsWithDescriptionCount === diagnostics.requirementConditionCount &&
    diagnostics.conditionGroupsWithDescriptionCount === diagnostics.conditionGroupCount;
  const noDuplicateNames =
    diagnostics.duplicateApplicationConditionNameCount === 0 &&
    diagnostics.duplicateRequirementConditionNameCount === 0 &&
    diagnostics.duplicateConditionGroupNameCount === 0;

  const renderTerms = (items: { term: string; count: number }[]) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {items.map((item) => (
        <span
          key={item.term}
          style={{
            display: "inline-flex",
            gap: 5,
            alignItems: "center",
            padding: "5px 8px",
            borderRadius: 999,
            background: "var(--brand-soft)",
            color: "var(--brand-dark)",
            fontSize: 10.5,
            fontWeight: 650,
          }}
        >
          {item.term} <span style={{ opacity: 0.7 }}>{item.count}</span>
        </span>
      ))}
    </div>
  );

  const renderObjects = (
    title: string,
    items: { id: string; name: string; description: string | null }[],
  ) => (
    <div style={{ marginTop: 14 }}>
      <div style={subheadingStyle}>{title}</div>
      <div style={tableWrapperStyle}>
        <table style={{ ...tableStyle, minWidth: 920 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>CFIHOS ID</th>
              <th style={tableHeaderStyle}>Name</th>
              <th style={tableHeaderStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={tableCellStyle}>{item.id}</td>
                <td style={tableCellStyle}><strong>{item.name}</strong></td>
                <td style={tableCellStyle}>{item.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: allDescriptionsPresent && noDuplicateNames ? "#c8ddd8" : "#ead7b7",
        background: allDescriptionsPresent && noDuplicateNames
          ? "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Dormant-model semantic profiling</div>
          <h2 style={titleStyle}>Condition Model semantic audit</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 900 }}>
            Profiles the 291 RDL master condition objects independently of workbook usage.
            This does not infer missing relationships; it tests whether the three dormant
            families form populated, internally structured vocabularies whose content looks
            intentionally modelled rather than placeholder data.
          </p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: allDescriptionsPresent && noDuplicateNames ? "var(--brand-soft)" : "#fff4e5", color: allDescriptionsPresent && noDuplicateNames ? "var(--brand-dark)" : "#9a6414", fontSize: 11, fontWeight: 700 }}>
          {allDescriptionsPresent && noDuplicateNames ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {allDescriptionsPresent && noDuplicateNames ? "Dormant vocabulary profiled" : "Review vocabulary quality"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master vocabulary</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Application Conditions" value={diagnostics.applicationConditionCount} />
        <DiagnosticMetric label="Requirement Conditions" value={diagnostics.requirementConditionCount} />
        <DiagnosticMetric label="Condition Groups" value={diagnostics.conditionGroupCount} />
        <DiagnosticMetric label="Total condition objects" value={diagnostics.totalConditionObjectCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Definition quality</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="App descriptions" value={diagnostics.applicationConditionsWithDescriptionCount} warning={diagnostics.applicationConditionsWithDescriptionCount !== diagnostics.applicationConditionCount} />
        <DiagnosticMetric label="Requirement descriptions" value={diagnostics.requirementConditionsWithDescriptionCount} warning={diagnostics.requirementConditionsWithDescriptionCount !== diagnostics.requirementConditionCount} />
        <DiagnosticMetric label="Group descriptions" value={diagnostics.conditionGroupsWithDescriptionCount} warning={diagnostics.conditionGroupsWithDescriptionCount !== diagnostics.conditionGroupCount} />
        <DiagnosticMetric label="Duplicate App names" value={diagnostics.duplicateApplicationConditionNameCount} warning={diagnostics.duplicateApplicationConditionNameCount > 0} />
        <DiagnosticMetric label="Duplicate Requirement names" value={diagnostics.duplicateRequirementConditionNameCount} warning={diagnostics.duplicateRequirementConditionNameCount > 0} />
        <DiagnosticMetric label="Duplicate Group names" value={diagnostics.duplicateConditionGroupNameCount} warning={diagnostics.duplicateConditionGroupNameCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Cross-family lexical signal</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Requirement conditions sharing App vocabulary" value={diagnostics.requirementConditionsSharingApplicationVocabularyCount} />
        <DiagnosticMetric label="App conditions sharing Group vocabulary" value={diagnostics.applicationConditionsSharingGroupVocabularyCount} />
      </div>
      <p style={{ margin: "6px 0 14px", color: "var(--muted)", fontSize: 11.5, lineHeight: 1.55 }}>
        Lexical overlap is a heuristic only. It is useful for seeing whether the families use a common business vocabulary; it is not evidence that a specific relationship row is missing.
      </p>

      <div style={diagnosticGroupLabelStyle}>Recurring vocabulary</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        <div><div style={{ ...subheadingStyle, marginBottom: 7 }}>Application Conditions</div>{renderTerms(diagnostics.applicationConditionTopTerms)}</div>
        <div><div style={{ ...subheadingStyle, marginBottom: 7 }}>Requirement Conditions</div>{renderTerms(diagnostics.requirementConditionTopTerms)}</div>
        <div><div style={{ ...subheadingStyle, marginBottom: 7 }}>Condition Groups</div>{renderTerms(diagnostics.conditionGroupTopTerms)}</div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Representative master records</div>
      {renderObjects("Application Conditions", diagnostics.applicationConditionSamples)}
      {renderObjects("Requirement Conditions", diagnostics.requirementConditionSamples)}
      {renderObjects("Application Condition Groups", diagnostics.conditionGroupSamples)}
    </section>
  );
}

type ApplicationConditionFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosApplicationConditionFamilyDiagnostics;
};

function ApplicationConditionFamilyDiagnosticsPanel({
  diagnostics,
}: ApplicationConditionFamilyDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.masterOnlyApplicationConditionCount > 0 ||
    diagnostics.masterOnlyRequirementConditionCount > 0 ||
    diagnostics.masterOnlyConditionGroupCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Conditional applicability discovery</div>
          <h2 style={titleStyle}>Application Condition family diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 880,
            }}
          >
            Reconciles Application Conditions, Source Standard requirement conditions
            and Application Condition Groups from the RDL master, then scans all
            worksheets to discover how conditional requirement applicability is
            represented in the workbook.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review master-only objects" : "Condition usage discovered"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master families</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Application Conditions" value={diagnostics.masterApplicationConditionCount} />
        <DiagnosticMetric label="Requirement Conditions" value={diagnostics.masterRequirementConditionCount} />
        <DiagnosticMetric label="Condition Groups" value={diagnostics.masterConditionGroupCount} />
        <DiagnosticMetric label="Source Requirements" value={diagnostics.masterSourceRequirementCount} />
        <DiagnosticMetric label="Worksheets scanned" value={diagnostics.worksheetsScannedCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Application Condition usage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Occurrences" value={diagnostics.applicationConditionOccurrences} />
        <DiagnosticMetric label="Referenced objects" value={diagnostics.referencedApplicationConditionCount} />
        <DiagnosticMetric label="Master-only objects" value={diagnostics.masterOnlyApplicationConditionCount} warning={diagnostics.masterOnlyApplicationConditionCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Requirement Condition usage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Occurrences" value={diagnostics.requirementConditionOccurrences} />
        <DiagnosticMetric label="Referenced objects" value={diagnostics.referencedRequirementConditionCount} />
        <DiagnosticMetric label="Master-only objects" value={diagnostics.masterOnlyRequirementConditionCount} warning={diagnostics.masterOnlyRequirementConditionCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Condition Group usage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Occurrences" value={diagnostics.conditionGroupOccurrences} />
        <DiagnosticMetric label="Referenced objects" value={diagnostics.referencedConditionGroupCount} />
        <DiagnosticMetric label="Master-only objects" value={diagnostics.masterOnlyConditionGroupCount} warning={diagnostics.masterOnlyConditionGroupCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Discovered relationship chain</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Requirement + Condition rows" value={diagnostics.rowsWithRequirementAndConditionCount} />
        <DiagnosticMetric label="Requirement → Condition pairs" value={diagnostics.distinctRequirementConditionPairCount} />
        <DiagnosticMetric label="Condition + App Condition rows" value={diagnostics.rowsWithConditionAndApplicationConditionCount} />
        <DiagnosticMetric label="Condition → App Condition pairs" value={diagnostics.distinctConditionApplicationPairCount} />
        <DiagnosticMetric label="App Condition + Group rows" value={diagnostics.rowsWithApplicationConditionAndGroupCount} />
        <DiagnosticMetric label="App Condition → Group pairs" value={diagnostics.distinctApplicationGroupPairCount} />
        <DiagnosticMetric label="Rows with all layers" value={diagnostics.rowsWithAllConditionLayersCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Worksheet usage</div>
      <div style={{ ...tableWrapperStyle, marginBottom: 16 }}>
        <table style={{ ...tableStyle, minWidth: 1120 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Worksheet</th>
              <th style={tableHeaderStyle}>App conditions</th>
              <th style={tableHeaderStyle}>Requirement conditions</th>
              <th style={tableHeaderStyle}>Condition groups</th>
              <th style={tableHeaderStyle}>Source requirements</th>
              <th style={tableHeaderStyle}>Req + condition rows</th>
              <th style={tableHeaderStyle}>Condition + app rows</th>
              <th style={tableHeaderStyle}>App + group rows</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.worksheetUsage.map((item) => (
              <tr key={item.sheetName}>
                <td style={tableCellStyle}><strong>{item.sheetName}</strong></td>
                <td style={tableCellStyle}>{item.applicationConditionOccurrences} ({item.applicationConditionObjects} objects)</td>
                <td style={tableCellStyle}>{item.requirementConditionOccurrences} ({item.requirementConditionObjects} objects)</td>
                <td style={tableCellStyle}>{item.conditionGroupOccurrences} ({item.conditionGroupObjects} objects)</td>
                <td style={tableCellStyle}>{item.sourceRequirementOccurrences} ({item.sourceRequirementObjects} objects)</td>
                <td style={tableCellStyle}>{item.rowsWithRequirementAndCondition}</td>
                <td style={tableCellStyle}>{item.rowsWithConditionAndApplicationCondition}</td>
                <td style={tableCellStyle}>{item.rowsWithApplicationConditionAndGroup}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diagnostics.relationshipSamples.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Representative condition records</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Worksheet</th>
                  <th style={tableHeaderStyle}>Source Requirement</th>
                  <th style={tableHeaderStyle}>Requirement Condition</th>
                  <th style={tableHeaderStyle}>Application Condition</th>
                  <th style={tableHeaderStyle}>Condition Group</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.relationshipSamples.map((item, index) => (
                  <tr key={`${item.sheetName}-${index}`}>
                    <td style={tableCellStyle}>{item.sheetName}</td>
                    <td style={tableCellStyle}>{item.sourceRequirementName ?? "—"}{item.sourceRequirementId ? <div>{item.sourceRequirementId}</div> : null}</td>
                    <td style={tableCellStyle}>{item.requirementConditionName ?? "—"}{item.requirementConditionId ? <div>{item.requirementConditionId}</div> : null}</td>
                    <td style={tableCellStyle}>{item.applicationConditionName ?? "—"}{item.applicationConditionId ? <div>{item.applicationConditionId}</div> : null}</td>
                    <td style={tableCellStyle}>{item.conditionGroupName ?? "—"}{item.conditionGroupId ? <div>{item.conditionGroupId}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

type EntityAttributeFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosEntityAttributeFamilyDiagnostics;
};

function EntityAttributeFamilyDiagnosticsPanel({
  diagnostics,
}: EntityAttributeFamilyDiagnosticsPanelProps) {
  const hasDiscoveredUsage =
    diagnostics.referencedEntityObjectCount > 0 ||
    diagnostics.referencedAttributeObjectCount > 0;

  return (
    <section style={{ ...sectionStyle, borderColor: "#c8ddd8", background: "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)" }}>
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Generic information-model discovery</div>
          <h2 style={titleStyle}>Entity &amp; Entity Attribute family diagnostics</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 880 }}>
            The RDL master contains Entity and Entity Attribute object families but no
            worksheets named “entity” or “entity attribute”. This diagnostic scans every
            workbook worksheet for references to those master IDs and reports where the
            generic information-model objects are actually used.
          </p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: "var(--brand-soft)", color: "var(--brand-dark)", fontSize: 11, fontWeight: 700 }}>
          <CheckCircle2 size={15} />
          {hasDiscoveredUsage ? "Usage discovered" : "Master-only families"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master families and workbook scan</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Master Entity objects" value={diagnostics.masterEntityObjectCount} />
        <DiagnosticMetric label="Master Attribute objects" value={diagnostics.masterEntityAttributeObjectCount} />
        <DiagnosticMetric label="Worksheets scanned" value={diagnostics.worksheetsScannedCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Entity references outside RDL master</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Entity occurrences" value={diagnostics.entityOccurrenceCountOutsideMaster} />
        <DiagnosticMetric label="Referenced Entity objects" value={diagnostics.referencedEntityObjectCount} />
        <DiagnosticMetric label="Master-only Entity objects" value={diagnostics.masterOnlyEntityObjectCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Entity Attribute references outside RDL master</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Attribute occurrences" value={diagnostics.attributeOccurrenceCountOutsideMaster} />
        <DiagnosticMetric label="Referenced Attribute objects" value={diagnostics.referencedAttributeObjectCount} />
        <DiagnosticMetric label="Master-only Attribute objects" value={diagnostics.masterOnlyAttributeObjectCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Discovered Entity ↔ Attribute co-occurrence</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Rows containing both families" value={diagnostics.rowsWithEntityAndAttributeCount} />
        <DiagnosticMetric label="Distinct Entity-Attribute pairs" value={diagnostics.distinctEntityAttributePairCount} />
      </div>

      {diagnostics.worksheetUsage.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Worksheet usage</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 850 }}>
              <thead><tr><th style={tableHeaderStyle}>Worksheet</th><th style={tableHeaderStyle}>Entity occurrences</th><th style={tableHeaderStyle}>Entity objects</th><th style={tableHeaderStyle}>Attribute occurrences</th><th style={tableHeaderStyle}>Attribute objects</th><th style={tableHeaderStyle}>Rows with both</th></tr></thead>
              <tbody>{diagnostics.worksheetUsage.map((item) => (
                <tr key={item.sheetName}><td style={tableCellStyle}><strong>{item.sheetName}</strong></td><td style={tableCellStyle}>{item.entityOccurrenceCount}</td><td style={tableCellStyle}>{item.entityObjectCount}</td><td style={tableCellStyle}>{item.attributeOccurrenceCount}</td><td style={tableCellStyle}>{item.attributeObjectCount}</td><td style={tableCellStyle}>{item.rowsWithBothCount}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      {diagnostics.cooccurrenceSamples.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Representative discovered pairs</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 950 }}>
              <thead><tr><th style={tableHeaderStyle}>Worksheet</th><th style={tableHeaderStyle}>Entity</th><th style={tableHeaderStyle}>Entity ID</th><th style={tableHeaderStyle}>Attribute</th><th style={tableHeaderStyle}>Attribute ID</th></tr></thead>
              <tbody>{diagnostics.cooccurrenceSamples.map((item) => (
                <tr key={`${item.sheetName}-${item.entityId}-${item.attributeId}`}><td style={tableCellStyle}>{item.sheetName}</td><td style={tableCellStyle}><strong>{item.entityName}</strong></td><td style={tableCellStyle}>{item.entityId}</td><td style={tableCellStyle}>{item.attributeName}</td><td style={tableCellStyle}>{item.attributeId}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      {!hasDiscoveredUsage && (
        <div style={{ marginTop: 18, padding: 14, border: "1px solid var(--line)", borderRadius: 9, background: "#f8faf9", color: "var(--muted)", fontSize: 11.5, lineHeight: 1.6 }}>
          No Entity or Entity Attribute CFIHOS IDs are referenced outside the RDL master object worksheet.
          In that case these families are catalogue metadata rather than an application relationship domain.
        </div>
      )}
    </section>
  );
}


type TagOrEquipmentClassFamilyDiagnosticsPanelProps = {
  diagnostics: CfihosTagOrEquipmentClassFamilyDiagnostics;
};

function TagOrEquipmentClassFamilyDiagnosticsPanel({
  diagnostics,
}: TagOrEquipmentClassFamilyDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.neitherDomainMasterObjectCount > 0 ||
    diagnostics.tagClassesMissingFromMasterCount > 0 ||
    diagnostics.equipmentClassesMissingFromMasterCount > 0 ||
    diagnostics.relationshipEndpointOutsideMasterFamilyCount > 0;

  const sampleGroups = [
    { label: "Tag only", rows: diagnostics.tagOnlySamples },
    { label: "Equipment only", rows: diagnostics.equipmentOnlySamples },
    { label: "Both domains", rows: diagnostics.bothDomainSamples },
    { label: "Neither domain", rows: diagnostics.neitherDomainSamples },
  ];

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Class identity reconciliation</div>
          <h2 style={titleStyle}>Tag or Equipment Class family diagnostics</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 860 }}>
            Reconciles the RDL master family “tag or equipment class” against the
            separate Tag Class and Equipment Class catalogues and the explicit
            Tag ↔ Equipment relationship table.
          </p>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: hasIssues ? "#fff4e5" : "var(--brand-soft)", color: hasIssues ? "#9a6414" : "var(--brand-dark)", fontSize: 11, fontWeight: 700 }}>
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review required" : "Canonical class family reconciled"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master and class catalogues</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Master family objects" value={diagnostics.masterFamilyObjectCount} />
        <DiagnosticMetric label="Canonical master IDs" value={diagnostics.masterFamilyCanonicalObjectCount} />
        <DiagnosticMetric label="Tag Classes" value={diagnostics.tagClassCount} />
        <DiagnosticMetric label="Equipment Classes" value={diagnostics.equipmentClassCount} />
        <DiagnosticMetric label="Canonical class union" value={diagnostics.canonicalClassUnionCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Master-object resolution</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Tag only" value={diagnostics.tagOnlyMasterObjectCount} />
        <DiagnosticMetric label="Equipment only" value={diagnostics.equipmentOnlyMasterObjectCount} />
        <DiagnosticMetric label="Both domains" value={diagnostics.bothDomainsMasterObjectCount} />
        <DiagnosticMetric label="Neither domain" value={diagnostics.neitherDomainMasterObjectCount} warning={diagnostics.neitherDomainMasterObjectCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Catalogue coverage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Tag Classes covered" value={diagnostics.tagClassesCoveredByMasterCount} />
        <DiagnosticMetric label="Tag Classes outside master" value={diagnostics.tagClassesMissingFromMasterCount} warning={diagnostics.tagClassesMissingFromMasterCount > 0} />
        <DiagnosticMetric label="Equipment Classes covered" value={diagnostics.equipmentClassesCoveredByMasterCount} />
        <DiagnosticMetric label="Equipment Classes outside master" value={diagnostics.equipmentClassesMissingFromMasterCount} warning={diagnostics.equipmentClassesMissingFromMasterCount > 0} />
      </div>
      <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 11.5 }}>
        Master coverage of the canonical Tag/Equipment class union: <strong style={{ color: "var(--ink)" }}>{diagnostics.masterCoverageOfCanonicalClassUnionPercent}%</strong>
      </div>

      <div style={diagnosticGroupLabelStyle}>Explicit Tag ↔ Equipment mappings</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Resolved mappings" value={diagnostics.explicitRelationshipCount} />
        <DiagnosticMetric label="Same master object" value={diagnostics.sameMasterObjectRelationshipCount} />
        <DiagnosticMetric label="Different master objects" value={diagnostics.differentMasterObjectRelationshipCount} />
        <DiagnosticMetric label="Endpoint outside master family" value={diagnostics.relationshipEndpointOutsideMasterFamilyCount} warning={diagnostics.relationshipEndpointOutsideMasterFamilyCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Representative master objects</div>
      {sampleGroups.map((group) => (
        group.rows.length > 0 ? (
          <div key={group.label} style={{ marginBottom: 14 }}>
            <div style={{ ...subheadingStyle, marginBottom: 7 }}>{group.label}</div>
            <div style={tableWrapperStyle}>
              <table style={{ ...tableStyle, minWidth: 920 }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Master object</th>
                    <th style={tableHeaderStyle}>Master ID</th>
                    <th style={tableHeaderStyle}>Tag Class</th>
                    <th style={tableHeaderStyle}>Equipment Class</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((item) => (
                    <tr key={`${group.label}-${item.masterId}`}>
                      <td style={tableCellStyle}><strong>{item.masterName}</strong></td>
                      <td style={tableCellStyle}>{item.masterId}</td>
                      <td style={tableCellStyle}>{item.tagClassName ? `${item.tagClassName} (${item.tagClassId})` : "—"}</td>
                      <td style={tableCellStyle}>{item.equipmentClassName ? `${item.equipmentClassName} (${item.equipmentClassId})` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null
      ))}

      {(diagnostics.tagClassIdsMissingFromMaster.length > 0 ||
        diagnostics.equipmentClassIdsMissingFromMaster.length > 0) && (
        <div style={{ marginTop: 16, padding: 14, border: "1px solid #ead7b7", borderRadius: 9, background: "#fffaf2", color: "#76501a", fontSize: 11.5, lineHeight: 1.6 }}>
          <strong>Class IDs outside the RDL master family</strong>
          {diagnostics.tagClassIdsMissingFromMaster.length > 0 && (
            <div style={{ marginTop: 6 }}>Tag: {diagnostics.tagClassIdsMissingFromMaster.slice(0, 20).join(", ")}{diagnostics.tagClassIdsMissingFromMaster.length > 20 ? " ..." : ""}</div>
          )}
          {diagnostics.equipmentClassIdsMissingFromMaster.length > 0 && (
            <div style={{ marginTop: 4 }}>Equipment: {diagnostics.equipmentClassIdsMissingFromMaster.slice(0, 20).join(", ")}{diagnostics.equipmentClassIdsMissingFromMaster.length > 20 ? " ..." : ""}</div>
          )}
        </div>
      )}
    </section>
  );
}


type SourceStandardRequirementOrphanAuditDiagnosticsPanelProps = {
  diagnostics: CfihosSourceStandardRequirementOrphanAuditDiagnostics;
};

function SourceStandardRequirementOrphanAuditDiagnosticsPanel({
  diagnostics,
}: SourceStandardRequirementOrphanAuditDiagnosticsPanelProps) {
  const allMasterOnly =
    diagnostics.objectsWithOnlyMasterOccurrenceCount ===
      diagnostics.targetObjectCount &&
    diagnostics.objectsNotFoundCount === 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: allMasterOnly ? "#c8ddd8" : "#ead7b7",
        background: allMasterOnly
          ? "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Requirement orphan investigation</div>
          <h2 style={titleStyle}>Four-object requirement orphan audit</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 850,
            }}
          >
            Scans every worksheet for the four Source Standard requirement objects
            not referenced by either the CORE class-document layer or the JIP33
            overlay. Exact cell matches are reported with worksheet and row context.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: allMasterOnly ? "var(--brand-soft)" : "#fff4e5",
            color: allMasterOnly ? "var(--brand-dark)" : "#9a6414",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {allMasterOnly ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {allMasterOnly ? "Master-only objects confirmed" : "Additional occurrences found"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Workbook scan</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Target objects" value={diagnostics.targetObjectCount} />
        <DiagnosticMetric label="Worksheets scanned" value={diagnostics.workbookWorksheetCount} />
        <DiagnosticMetric label="Total occurrences" value={diagnostics.totalOccurrenceCount} />
        <DiagnosticMetric
          label="Master-only objects"
          value={diagnostics.objectsWithOnlyMasterOccurrenceCount}
        />
        <DiagnosticMetric
          label="Objects found elsewhere"
          value={diagnostics.objectsWithAdditionalOccurrencesCount}
          warning={diagnostics.objectsWithAdditionalOccurrencesCount > 0}
        />
        <DiagnosticMetric
          label="Objects not found"
          value={diagnostics.objectsNotFoundCount}
          warning={diagnostics.objectsNotFoundCount > 0}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Occurrence detail</div>
      <div style={tableWrapperStyle}>
        <table style={{ ...tableStyle, minWidth: 1040 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>CFIHOS ID</th>
              <th style={tableHeaderStyle}>Object name</th>
              <th style={tableHeaderStyle}>Worksheet</th>
              <th style={tableHeaderStyle}>Excel row</th>
              <th style={tableHeaderStyle}>Matching column(s)</th>
              <th style={tableHeaderStyle}>Context</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.objects.flatMap((item) => {
              if (item.occurrences.length === 0) {
                return [
                  <tr key={`${item.id}-missing`}>
                    <td style={tableCellStyle}>{item.id}</td>
                    <td style={tableCellStyle}>{item.name ?? "—"}</td>
                    <td style={tableCellStyle}>Not found</td>
                    <td style={tableCellStyle}>—</td>
                    <td style={tableCellStyle}>—</td>
                    <td style={tableCellStyle}>—</td>
                  </tr>,
                ];
              }

              return item.occurrences.map((occurrence, index) => (
                <tr key={`${item.id}-${occurrence.worksheetName}-${occurrence.rowNumber}-${index}`}>
                  <td style={tableCellStyle}>{item.id}</td>
                  <td style={tableCellStyle}>{item.name ?? "—"}</td>
                  <td style={tableCellStyle}>
                    <strong>{occurrence.worksheetName}</strong>
                  </td>
                  <td style={tableCellStyle}>{occurrence.rowNumber}</td>
                  <td style={tableCellStyle}>{occurrence.matchingColumns.join(", ")}</td>
                  <td style={tableCellStyle}>{occurrence.context}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


type SourceStandardRequirementCoverageDiagnosticsPanelProps = {
  diagnostics: CfihosSourceStandardRequirementCoverageDiagnostics;
};

function SourceStandardRequirementCoverageDiagnosticsPanel({
  diagnostics,
}: SourceStandardRequirementCoverageDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.unreferencedMasterRequirementCount > 0 ||
    diagnostics.referencesMissingFromMasterCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Requirement-family completeness validation</div>
          <h2 style={titleStyle}>Source Standard requirement family diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 850,
            }}
          >
            Reconciles the RDL master family “source standard document and data
            requirement” against CORE class-document requirements and the JIP33
            specification overlay.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review remaining objects" : "Requirement family covered"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master family reconciliation</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Master requirement objects" value={diagnostics.masterRequirementObjectCount} />
        <DiagnosticMetric label="CORE class rows" value={diagnostics.classRequirementRowCount} />
        <DiagnosticMetric label="Unique CORE requirement IDs" value={diagnostics.uniqueClassRequirementIdCount} />
        <DiagnosticMetric label="JIP33 requirement IDs" value={diagnostics.jip33RequirementCount} />
        <DiagnosticMetric label="CORE ↔ JIP33 ID overlap" value={diagnostics.classAndJip33OverlapCount} />
        <DiagnosticMetric label="Referenced master objects" value={diagnostics.referencedMasterRequirementCount} />
        <DiagnosticMetric label="Unreferenced master objects" value={diagnostics.unreferencedMasterRequirementCount} warning={diagnostics.unreferencedMasterRequirementCount > 0} />
        <DiagnosticMetric label="Refs missing from master" value={diagnostics.referencesMissingFromMasterCount} warning={diagnostics.referencesMissingFromMasterCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Requirement layers</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="CORE-only requirement IDs" value={diagnostics.classOnlyRequirementCount} />
        <DiagnosticMetric label="JIP33-only requirement IDs" value={diagnostics.jip33OnlyRequirementCount} />
      </div>

      <div
        style={{
          marginTop: 14,
          color: "var(--muted)",
          fontSize: 11.5,
          lineHeight: 1.55,
        }}
      >
        Master-family coverage: <strong style={{ color: "var(--ink)" }}>{diagnostics.masterCoveragePercent}%</strong>
      </div>

      {diagnostics.unreferencedMasterRequirements.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>Master requirements not referenced by either layer</div>
          <div style={tableWrapperStyle}>
            <table style={{ ...tableStyle, minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>CFIHOS ID</th>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={tableHeaderStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.unreferencedMasterRequirements.map((item) => (
                  <tr key={item.id}>
                    <td style={tableCellStyle}>{item.id}</td>
                    <td style={tableCellStyle}><strong>{item.name}</strong></td>
                    <td style={tableCellStyle}>{item.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {diagnostics.referencesMissingFromMaster.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid #ead7b7",
            borderRadius: 9,
            background: "#fffaf2",
            color: "#76501a",
            fontSize: 11.5,
            lineHeight: 1.6,
          }}
        >
          <strong>Referenced requirement IDs missing from RDL master:</strong>{" "}
          {diagnostics.referencesMissingFromMaster.slice(0, 30).join(", ")}
          {diagnostics.referencesMissingFromMaster.length > 30 ? " ..." : ""}
        </div>
      )}
    </section>
  );
}

type ExternalEquivalenceOrphanAuditDiagnosticsPanelProps = {
  diagnostics: CfihosExternalEquivalenceOrphanAuditDiagnostics;
};

function ExternalEquivalenceOrphanAuditDiagnosticsPanel({
  diagnostics,
}: ExternalEquivalenceOrphanAuditDiagnosticsPanelProps) {
  const hasUnresolved = diagnostics.unresolvedObjectCount > 0;
  const hasExternalReferences =
    diagnostics.unresolvedObjectsReferencedElsewhere > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasUnresolved ? "#ead7b7" : "#c8ddd8",
        background: hasUnresolved
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>External-reference orphan investigation</div>
          <h2 style={titleStyle}>External equivalence orphan diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 880,
            }}
          >
            Investigates equivalence mappings whose CFIHOS object ID is absent
            from the RDL master. Every unresolved ID is scanned across the
            remaining workbook, grouped by coding source and compared with its
            nearest numeric master-object neighbours.
          </p>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 10px",
            borderRadius: 8,
            background: hasUnresolved ? "#fff4e5" : "var(--brand-soft)",
            color: hasUnresolved ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasUnresolved ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasUnresolved ? "Review orphan mappings" : "All mappings resolve"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Mapping population</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Equivalence mappings" value={diagnostics.equivalenceMappingCount} />
        <DiagnosticMetric label="Resolved mappings" value={diagnostics.resolvedMappingCount} />
        <DiagnosticMetric label="Unresolved mappings" value={diagnostics.unresolvedMappingCount} warning={diagnostics.unresolvedMappingCount > 0} />
        <DiagnosticMetric label="Unresolved object IDs" value={diagnostics.unresolvedObjectCount} warning={diagnostics.unresolvedObjectCount > 0} />
        <DiagnosticMetric label="Worksheets scanned" value={diagnostics.worksheetsScanned} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Workbook cross-check</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric
          label="Referenced elsewhere"
          value={diagnostics.unresolvedObjectsReferencedElsewhere}
          warning={hasExternalReferences}
        />
        <DiagnosticMetric
          label="Mapping-only objects"
          value={diagnostics.mappingOnlyUnresolvedObjects}
        />
        <DiagnosticMetric
          label="Occurrences outside mapping"
          value={diagnostics.outsideMappingOccurrenceCount}
          warning={diagnostics.outsideMappingOccurrenceCount > 0}
        />
        <DiagnosticMetric
          label="Same-family neighbour gaps"
          value={diagnostics.sameFamilyNeighborGapCount}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Unresolved mappings by coding source</div>
      <div style={{ ...tableWrapperStyle, marginTop: 12 }}>
        <table style={{ ...tableStyle, minWidth: 620 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Coding source</th>
              <th style={tableHeaderStyle}>Mappings</th>
              <th style={tableHeaderStyle}>Object IDs</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.sourceSummaries.map((source) => (
              <tr key={source.codingSourceCode}>
                <td style={tableCellStyle}><strong>{source.codingSourceCode}</strong></td>
                <td style={tableCellStyle}>{source.unresolvedMappingCount}</td>
                <td style={tableCellStyle}>{source.unresolvedObjectCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={diagnosticGroupLabelStyle}>Orphan object detail</div>
      <div style={{ ...tableWrapperStyle, marginTop: 12 }}>
        <table style={{ ...tableStyle, minWidth: 1180 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>CFIHOS object ID</th>
              <th style={tableHeaderStyle}>Coding source</th>
              <th style={tableHeaderStyle}>Equivalent value</th>
              <th style={tableHeaderStyle}>Mappings</th>
              <th style={tableHeaderStyle}>Elsewhere</th>
              <th style={tableHeaderStyle}>Workbook locations</th>
              <th style={tableHeaderStyle}>Previous master</th>
              <th style={tableHeaderStyle}>Next master</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.details.map((detail) => (
              <tr key={detail.objectId}>
                <td style={tableCellStyle}><strong>{detail.objectId}</strong></td>
                <td style={tableCellStyle}>{detail.codingSourceCode}</td>
                <td style={tableCellStyle}>{detail.equivalentValue}</td>
                <td style={tableCellStyle}>{detail.mappingCount}</td>
                <td style={tableCellStyle}>
                  {detail.outsideMappingOccurrenceCount > 0
                    ? `${detail.outsideMappingOccurrenceCount} occurrence${detail.outsideMappingOccurrenceCount === 1 ? "" : "s"} / ${detail.outsideMappingWorksheetCount} sheet${detail.outsideMappingWorksheetCount === 1 ? "" : "s"}`
                    : "Mapping only"}
                </td>
                <td style={tableCellStyle}>
                  {detail.occurrences.length > 0
                    ? detail.occurrences
                        .slice(0, 4)
                        .map((occurrence) => `${occurrence.worksheet} · ${occurrence.column} (${occurrence.count})`)
                        .join("; ")
                    : "—"}
                </td>
                <td style={tableCellStyle}>
                  {detail.previousMasterObject
                    ? `${detail.previousMasterObject.id} · ${detail.previousMasterObject.name}${detail.previousMasterObject.definitionFile ? ` · ${detail.previousMasterObject.definitionFile}` : ""}`
                    : "—"}
                </td>
                <td style={tableCellStyle}>
                  {detail.nextMasterObject
                    ? `${detail.nextMasterObject.id} · ${detail.nextMasterObject.name}${detail.nextMasterObject.definitionFile ? ` · ${detail.nextMasterObject.definitionFile}` : ""}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type RdlObjectRegistryDiagnosticsPanelProps = {
  diagnostics: CfihosRdlObjectRegistryDiagnostics;
};

function RdlObjectRegistryDiagnosticsPanel({
  diagnostics,
}: RdlObjectRegistryDiagnosticsPanelProps) {
  const hasIntegrityIssues =
    diagnostics.duplicateMasterObjectIdCount > 0 ||
    diagnostics.missingNameCount > 0 ||
    diagnostics.missingDefinitionFileCount > 0 ||
    diagnostics.unresolvedEquivalenceMappingCount > 0 ||
    diagnostics.duplicateEquivalenceMappingCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIntegrityIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIntegrityIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>RDL completeness validation</div>
          <h2 style={titleStyle}>RDL Object Registry diagnostics</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 850 }}>
            Combines the RDL master object catalogue with external object-equivalence mappings to quantify object-family coverage, registry integrity and interoperability references.
          </p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: hasIntegrityIssues ? "#fff4e5" : "var(--brand-soft)", color: hasIntegrityIssues ? "#9a6414" : "var(--brand-dark)", fontSize: 11, fontWeight: 700 }}>
          {hasIntegrityIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIntegrityIssues ? "Review required" : "Registry integrity valid"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Master registry integrity</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Master objects" value={diagnostics.masterObjectCount} />
        <DiagnosticMetric label="Unique object IDs" value={diagnostics.uniqueMasterObjectIdCount} />
        <DiagnosticMetric label="Duplicate object IDs" value={diagnostics.duplicateMasterObjectIdCount} warning={diagnostics.duplicateMasterObjectIdCount > 0} />
        <DiagnosticMetric label="Duplicate object names" value={diagnostics.duplicateMasterObjectNameCount} />
        <DiagnosticMetric label="Missing names" value={diagnostics.missingNameCount} warning={diagnostics.missingNameCount > 0} />
        <DiagnosticMetric label="Missing descriptions" value={diagnostics.missingDescriptionCount} />
        <DiagnosticMetric label="Missing definition files" value={diagnostics.missingDefinitionFileCount} warning={diagnostics.missingDefinitionFileCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Object-family coverage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Definition-file families" value={diagnostics.definitionFileCount} />
        <DiagnosticMetric label="Implemented families" value={diagnostics.implementedFamilyCount} />
        <DiagnosticMetric label="Supporting families" value={diagnostics.supportingFamilyCount} />
        <DiagnosticMetric label="Unclassified families" value={diagnostics.unclassifiedFamilyCount} warning={diagnostics.unclassifiedFamilyCount > 0} />
      </div>

      <div style={{ ...tableWrapperStyle, marginTop: 12 }}>
        <table style={{ ...tableStyle, minWidth: 700 }}>
          <thead><tr><th style={tableHeaderStyle}>Definition file / object family</th><th style={tableHeaderStyle}>Objects</th><th style={tableHeaderStyle}>Explorer coverage</th></tr></thead>
          <tbody>{diagnostics.families.map((family) => (
            <tr key={family.definitionFile}>
              <td style={tableCellStyle}><strong>{family.definitionFile}</strong></td>
              <td style={tableCellStyle}>{family.objectCount}</td>
              <td style={tableCellStyle}>{family.explorerCoverage}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div style={diagnosticGroupLabelStyle}>External equivalence coverage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Equivalence mappings" value={diagnostics.equivalenceMappingCount} />
        <DiagnosticMetric label="Mapped CFIHOS objects" value={diagnostics.mappedObjectCount} />
        <DiagnosticMetric label="Coding sources" value={diagnostics.codingSourceCount} />
        <DiagnosticMetric label="Resolved mappings" value={diagnostics.resolvedEquivalenceMappingCount} />
        <DiagnosticMetric label="Unresolved mappings" value={diagnostics.unresolvedEquivalenceMappingCount} warning={diagnostics.unresolvedEquivalenceMappingCount > 0} />
        <DiagnosticMetric label="Duplicate mappings" value={diagnostics.duplicateEquivalenceMappingCount} warning={diagnostics.duplicateEquivalenceMappingCount > 0} />
      </div>

      <div style={{ ...tableWrapperStyle, marginTop: 12 }}>
        <table style={{ ...tableStyle, minWidth: 650 }}>
          <thead><tr><th style={tableHeaderStyle}>Coding source</th><th style={tableHeaderStyle}>Mappings</th><th style={tableHeaderStyle}>CFIHOS objects</th></tr></thead>
          <tbody>{diagnostics.codingSources.map((source) => (
            <tr key={source.codingSourceCode}>
              <td style={tableCellStyle}><strong>{source.codingSourceCode}</strong></td>
              <td style={tableCellStyle}>{source.mappingCount}</td>
              <td style={tableCellStyle}>{source.objectCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {diagnostics.unresolvedObjectIds.length > 0 && (
        <div style={{ marginTop: 20, padding: 14, border: "1px solid #ead7b7", borderRadius: 9, background: "#fffaf2", color: "#76501a", fontSize: 11.5, lineHeight: 1.6 }}>
          <strong>Unresolved equivalence object IDs</strong>
          <div style={{ marginTop: 6 }}>{diagnostics.unresolvedObjectIds.slice(0, 20).join(", ")}{diagnostics.unresolvedObjectIds.length > 20 ? " ..." : ""}</div>
        </div>
      )}
    </section>
  );
}

type HandoverEventDiagnosticsPanelProps = {
  diagnostics: CfihosHandoverEventDiagnostics;
};

function HandoverEventDiagnosticsPanel({
  diagnostics,
}: HandoverEventDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.duplicateIdCount > 0 ||
    diagnostics.duplicateNameCount > 0 ||
    diagnostics.duplicateSequenceCount > 0 ||
    diagnostics.missingSequenceCount > 0 ||
    diagnostics.invalidSequenceCount > 0 ||
    diagnostics.missingExpectedLifecyclePhaseCount > 0 ||
    diagnostics.unmappedEventCount > 0 ||
    !diagnostics.sequenceMatchesLifecycleOrder;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Lifecycle reference validation</div>
          <h2 style={titleStyle}>Handover Event diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 820,
            }}
          >
            Validates the authoritative CFIHOS Handover Event master, its reporting
            order and its one-to-one mapping to the five lifecycle status columns
            used by Discipline × Document Type requirements.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review required" : "Lifecycle mapping valid"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Handover Event master</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Source rows" value={diagnostics.sourceRowCount} />
        <DiagnosticMetric label="Mapped events" value={diagnostics.mappedLifecycleEventCount} />
        <DiagnosticMetric label="Expected lifecycle phases" value={diagnostics.expectedLifecyclePhaseCount} />
        <DiagnosticMetric label="Missing expected phases" value={diagnostics.missingExpectedLifecyclePhaseCount} warning={diagnostics.missingExpectedLifecyclePhaseCount > 0} />
        <DiagnosticMetric label="Unmapped events" value={diagnostics.unmappedEventCount} warning={diagnostics.unmappedEventCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Identity and sequence integrity</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Duplicate IDs" value={diagnostics.duplicateIdCount} warning={diagnostics.duplicateIdCount > 0} />
        <DiagnosticMetric label="Duplicate names" value={diagnostics.duplicateNameCount} warning={diagnostics.duplicateNameCount > 0} />
        <DiagnosticMetric label="Duplicate sequences" value={diagnostics.duplicateSequenceCount} warning={diagnostics.duplicateSequenceCount > 0} />
        <DiagnosticMetric label="Missing sequences" value={diagnostics.missingSequenceCount} warning={diagnostics.missingSequenceCount > 0} />
        <DiagnosticMetric label="Invalid sequences" value={diagnostics.invalidSequenceCount} warning={diagnostics.invalidSequenceCount > 0} />
        <DiagnosticMetric label="Sequence matches lifecycle" value={diagnostics.sequenceMatchesLifecycleOrder ? 1 : 0} warning={!diagnostics.sequenceMatchesLifecycleOrder} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Lifecycle usage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Discipline × Document relationships" value={diagnostics.lifecycleRelationshipCount} />
        <DiagnosticMetric label="Relationships with lifecycle status" value={diagnostics.lifecycleRelationshipsWithAnyStatusCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Authoritative event mapping</div>
      <div style={tableWrapperStyle}>
        <table style={{ ...tableStyle, minWidth: 900 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Sequence</th>
              <th style={tableHeaderStyle}>CFIHOS ID</th>
              <th style={tableHeaderStyle}>Handover Event</th>
              <th style={tableHeaderStyle}>Lifecycle route key</th>
              <th style={tableHeaderStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.events.map((event) => (
              <tr key={event.id}>
                <td style={tableCellStyle}>{event.reportingSequence ?? "—"}</td>
                <td style={tableCellStyle}>{event.id}</td>
                <td style={tableCellStyle}><strong>{event.name}</strong></td>
                <td style={tableCellStyle}>{event.lifecyclePhaseKey}</td>
                <td style={tableCellStyle}>{event.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(diagnostics.missingExpectedLifecyclePhases.length > 0 ||
        diagnostics.unmappedEventNames.length > 0) && (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            border: "1px solid #ead7b7",
            borderRadius: 9,
            background: "#fffaf2",
            color: "#76501a",
            fontSize: 11.5,
            lineHeight: 1.6,
          }}
        >
          <strong>Items requiring review</strong>
          {diagnostics.missingExpectedLifecyclePhases.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Missing phases: {diagnostics.missingExpectedLifecyclePhases.join(", ")}
            </div>
          )}
          {diagnostics.unmappedEventNames.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Unmapped events: {diagnostics.unmappedEventNames.join(", ")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}



const JIP33_REQUIREMENT_ID_COLUMN =
  "Source standard document and data requirement CFIHOS unique code";

const JIP33_CONTEXT_COLUMNS = new Set([
  "tag class CFIHOS unique code",
  "tag class name",
]);

const JIP33_DISPLAY_CONTEXT_COLUMNS = {
  tagClassId: "tag class CFIHOS unique code",
  tagClassName: "tag class name",
  sourceStandardId: "source standard CFIHOS unique code",
  sourceStandardCode: "source standard code",
  documentTypeId: "document type CFIHOS unique code",
  documentTypeName: "document type name",
  disciplineId: "discipline CFIHOS unique code",
  disciplineName: "discipline name",
} as const;

function valuesForColumn(rows: Array<Record<string, unknown>>, column: string): string[] {
  return [...new Set(rows.map((row) => textValue(row[column])).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function displayPairs(
  rows: Array<Record<string, unknown>>,
  idColumn: string,
  nameColumn: string,
): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const id = textValue(row[idColumn]);
    const name = textValue(row[nameColumn]);
    if (!id && !name) continue;
    values.add(name && id ? `${name} (${id})` : name || id);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

async function buildJip33DuplicateAuditDiagnostics(): Promise<CfihosJip33DuplicateAuditDiagnostics> {
  const rows = (await getCfihosWorksheetRows("Jip33 info required spec")) as Array<
    Record<string, unknown>
  >;

  const byRequirementId = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const requirementId = textValue(row[JIP33_REQUIREMENT_ID_COLUMN]);
    if (!requirementId) continue;
    const group = byRequirementId.get(requirementId) ?? [];
    group.push(row);
    byRequirementId.set(requirementId, group);
  }

  const duplicateGroups = [...byRequirementId.entries()].filter(([, group]) => group.length > 1);

  const groups: CfihosJip33DuplicateGroupRow[] = duplicateGroups
    .map(([requirementId, group]) => {
      const allColumns = [...new Set(group.flatMap((row) => Object.keys(row)))].filter(
        (column) => column !== JIP33_REQUIREMENT_ID_COLUMN,
      );

      const differingColumns = allColumns
        .filter((column) => valuesForColumn(group, column).length > 1)
        .sort((a, b) => a.localeCompare(b));

      const nonContextDifferences = differingColumns.filter(
        (column) => !JIP33_CONTEXT_COLUMNS.has(column),
      );

      const classification: CfihosJip33DuplicateGroupRow["classification"] =
        differingColumns.length === 0
          ? "exact-duplicate"
          : nonContextDifferences.length === 0
            ? "context-variant"
            : "semantic-conflict";

      return {
        requirementId,
        rowCount: group.length,
        classification,
        tagClasses: displayPairs(
          group,
          JIP33_DISPLAY_CONTEXT_COLUMNS.tagClassId,
          JIP33_DISPLAY_CONTEXT_COLUMNS.tagClassName,
        ),
        sourceStandards: displayPairs(
          group,
          JIP33_DISPLAY_CONTEXT_COLUMNS.sourceStandardId,
          JIP33_DISPLAY_CONTEXT_COLUMNS.sourceStandardCode,
        ),
        documentTypes: displayPairs(
          group,
          JIP33_DISPLAY_CONTEXT_COLUMNS.documentTypeId,
          JIP33_DISPLAY_CONTEXT_COLUMNS.documentTypeName,
        ),
        disciplines: displayPairs(
          group,
          JIP33_DISPLAY_CONTEXT_COLUMNS.disciplineId,
          JIP33_DISPLAY_CONTEXT_COLUMNS.disciplineName,
        ),
        differingColumns,
        requirementNumber:
          textValue(group[0]["source standard document and data requirement number"]) || "—",
        title:
          textValue(group[0]["source standard document and data requirement title"]) || "—",
      };
    })
    .sort((a, b) => {
      const rank = { "semantic-conflict": 0, "exact-duplicate": 1, "context-variant": 2 } as const;
      return rank[a.classification] - rank[b.classification] || a.requirementId.localeCompare(b.requirementId);
    });

  return {
    requirementRowCount: rows.length,
    uniqueRequirementIdCount: byRequirementId.size,
    duplicateRequirementIdCount: groups.length,
    duplicateGroupRowCount: groups.reduce((sum, group) => sum + group.rowCount, 0),
    excessRowCount: rows.length - byRequirementId.size,
    pairOnlyGroupCount: groups.filter((group) => group.rowCount === 2).length,
    exactDuplicateGroupCount: groups.filter((group) => group.classification === "exact-duplicate").length,
    contextVariantGroupCount: groups.filter((group) => group.classification === "context-variant").length,
    semanticConflictGroupCount: groups.filter((group) => group.classification === "semantic-conflict").length,
    groupsWithMultipleTagClassesCount: groups.filter((group) => group.tagClasses.length > 1).length,
    groupsWithMultipleDocumentTypesCount: groups.filter((group) => group.documentTypes.length > 1).length,
    groupsWithMultipleSourceStandardsCount: groups.filter((group) => group.sourceStandards.length > 1).length,
    groups,
  };
}

type Jip33DuplicateAuditPanelProps = {
  diagnostics: CfihosJip33DuplicateAuditDiagnostics;
};

function Jip33DuplicateAuditPanel({ diagnostics }: Jip33DuplicateAuditPanelProps) {
  const hasSemanticConflicts = diagnostics.semanticConflictGroupCount > 0;
  const hasExactDuplicates = diagnostics.exactDuplicateGroupCount > 0;
  const hasIssues = hasSemanticConflicts || hasExactDuplicates;

  const classificationLabel = (
    classification: CfihosJip33DuplicateGroupRow["classification"],
  ) =>
    classification === "context-variant"
      ? "Context mapping"
      : classification === "exact-duplicate"
        ? "Exact duplicate"
        : "Semantic conflict";

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>JIP33 duplicate-ID reconciliation</div>
          <h2 style={titleStyle}>JIP33 requirement duplicate-ID diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 900,
            }}
          >
            Distinguishes true duplicate requirement rows from intentional reuse of one JIP33
            requirement ID across multiple Tag Class contexts. A group is treated as a context
            mapping only when the duplicate rows differ solely in Tag Class ID/name.
          </p>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasSemanticConflicts
            ? "Review duplicate semantics"
            : hasExactDuplicates
              ? "Review exact duplicates"
              : "Duplicate IDs are contextual mappings"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Duplicate population</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Requirement rows" value={diagnostics.requirementRowCount} />
        <DiagnosticMetric label="Unique requirement IDs" value={diagnostics.uniqueRequirementIdCount} />
        <DiagnosticMetric label="Duplicate ID groups" value={diagnostics.duplicateRequirementIdCount} />
        <DiagnosticMetric label="Rows in duplicate groups" value={diagnostics.duplicateGroupRowCount} />
        <DiagnosticMetric label="Excess rows vs unique IDs" value={diagnostics.excessRowCount} />
        <DiagnosticMetric label="Two-row groups" value={diagnostics.pairOnlyGroupCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Duplicate classification</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric
          label="Context-mapping groups"
          value={diagnostics.contextVariantGroupCount}
        />
        <DiagnosticMetric
          label="Exact duplicate groups"
          value={diagnostics.exactDuplicateGroupCount}
          warning={diagnostics.exactDuplicateGroupCount > 0}
        />
        <DiagnosticMetric
          label="Semantic-conflict groups"
          value={diagnostics.semanticConflictGroupCount}
          warning={diagnostics.semanticConflictGroupCount > 0}
        />
        <DiagnosticMetric
          label="Multiple Tag Classes"
          value={diagnostics.groupsWithMultipleTagClassesCount}
        />
        <DiagnosticMetric
          label="Multiple Document Types"
          value={diagnostics.groupsWithMultipleDocumentTypesCount}
        />
        <DiagnosticMetric
          label="Multiple Source Standards"
          value={diagnostics.groupsWithMultipleSourceStandardsCount}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Duplicate-ID detail</div>
      <div style={{ ...tableWrapperStyle, marginBottom: 0 }}>
        <table style={{ ...tableStyle, minWidth: 1260 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Requirement ID</th>
              <th style={tableHeaderStyle}>Requirement</th>
              <th style={tableHeaderStyle}>Rows</th>
              <th style={tableHeaderStyle}>Classification</th>
              <th style={tableHeaderStyle}>Tag Class contexts</th>
              <th style={tableHeaderStyle}>Document Types</th>
              <th style={tableHeaderStyle}>Differing columns</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.groups.map((group) => (
              <tr key={group.requirementId}>
                <td style={tableCellStyle}>{group.requirementId}</td>
                <td style={tableCellStyle}>
                  <strong>{group.requirementNumber}</strong>
                  <div style={{ marginTop: 3 }}>{group.title}</div>
                </td>
                <td style={tableCellStyle}>{group.rowCount}</td>
                <td style={tableCellStyle}>{classificationLabel(group.classification)}</td>
                <td style={tableCellStyle}>{group.tagClasses.join("; ") || "—"}</td>
                <td style={tableCellStyle}>{group.documentTypes.join("; ") || "—"}</td>
                <td style={tableCellStyle}>{group.differingColumns.join("; ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Jip33DiagnosticsPanelProps = { diagnostics: CfihosJip33RequirementDiagnostics };

function Jip33DiagnosticsPanel({ diagnostics }: Jip33DiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.unresolvedTagClassReferenceCount > 0 ||
    diagnostics.unresolvedSourceStandardReferenceCount > 0 ||
    diagnostics.unresolvedDisciplineReferenceCount > 0 ||
    diagnostics.unresolvedDocumentTypeReferenceCount > 0 ||
    diagnostics.duplicateRequirementIdCount > 0;

  return (
    <section style={{ ...sectionStyle, borderColor: hasIssues ? "#ead7b7" : "#c8ddd8", background: hasIssues ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)" : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)" }}>
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Specification domain validation</div>
          <h2 style={titleStyle}>JIP33 information requirement diagnostics</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 820 }}>
            Cross-checks JIP33 document and data requirements against Tag Classes, Source Standards, Disciplines, Document Types and the generic class-document requirement relationship.
          </p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: hasIssues ? "#fff4e5" : "var(--brand-soft)", color: hasIssues ? "#9a6414" : "var(--brand-dark)", fontSize: 11, fontWeight: 700 }}>
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review required" : "References resolved"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Coverage</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Requirement rows" value={diagnostics.sourceRowCount} />
        <DiagnosticMetric label="Unique requirement IDs" value={diagnostics.uniqueRequirementIdCount} />
        <DiagnosticMetric label="Duplicate requirement IDs" value={diagnostics.duplicateRequirementIdCount} warning={diagnostics.duplicateRequirementIdCount > 0} />
        <DiagnosticMetric label="Tag Classes" value={diagnostics.tagClassCount} />
        <DiagnosticMetric label="Source Standards" value={diagnostics.sourceStandardCount} />
        <DiagnosticMetric label="Disciplines" value={diagnostics.disciplineCount} />
        <DiagnosticMetric label="Document Types" value={diagnostics.documentTypeCount} />
        <DiagnosticMetric label="Requirement types" value={diagnostics.requirementTypeCount} />
        <DiagnosticMetric label="Requirement groups" value={diagnostics.requirementGroupCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Reference resolution</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Resolved Tag refs" value={diagnostics.resolvedTagClassReferenceCount} />
        <DiagnosticMetric label="Unresolved Tag refs" value={diagnostics.unresolvedTagClassReferenceCount} warning={diagnostics.unresolvedTagClassReferenceCount > 0} />
        <DiagnosticMetric label="Resolved Standard refs" value={diagnostics.resolvedSourceStandardReferenceCount} />
        <DiagnosticMetric label="Unresolved Standard refs" value={diagnostics.unresolvedSourceStandardReferenceCount} warning={diagnostics.unresolvedSourceStandardReferenceCount > 0} />
        <DiagnosticMetric label="Resolved Discipline refs" value={diagnostics.resolvedDisciplineReferenceCount} />
        <DiagnosticMetric label="Unresolved Discipline refs" value={diagnostics.unresolvedDisciplineReferenceCount} warning={diagnostics.unresolvedDisciplineReferenceCount > 0} />
        <DiagnosticMetric label="Resolved Document refs" value={diagnostics.resolvedDocumentTypeReferenceCount} />
        <DiagnosticMetric label="Unresolved Document refs" value={diagnostics.unresolvedDocumentTypeReferenceCount} warning={diagnostics.unresolvedDocumentTypeReferenceCount > 0} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Class-document overlap</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="JIP33 class-document pairs" value={diagnostics.classDocumentCombinationCount} />
        <DiagnosticMetric label="Also in generic requirements" value={diagnostics.overlappingClassDocumentCombinationCount} />
        <DiagnosticMetric label="JIP33-only pairs" value={diagnostics.additionalClassDocumentCombinationCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Lifecycle and delivery population</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Proposal indicators" value={diagnostics.proposalSubmissionCount} />
        <DiagnosticMetric label="Review indicators" value={diagnostics.reviewSubmissionCount} />
        <DiagnosticMetric label="Delivery indicators" value={diagnostics.deliverySubmissionCount} />
        <DiagnosticMetric label="Review timing" value={diagnostics.reviewTimingCount} />
        <DiagnosticMetric label="Approval timing" value={diagnostics.approvalTimingCount} />
        <DiagnosticMetric label="Information timing" value={diagnostics.informationTimingCount} />
        <DiagnosticMetric label="Handover status" value={diagnostics.handoverStatusCount} />
        <DiagnosticMetric label="Translation indicator" value={diagnostics.translationIndicatorCount} />
        <DiagnosticMetric label="Deliverable format" value={diagnostics.deliverableFormatCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Requirement taxonomy</div>
      <div style={{ ...tableWrapperStyle, marginBottom: 12 }}>
        <table style={tableStyle}><thead><tr><th style={tableHeaderStyle}>Requirement type</th><th style={tableHeaderStyle}>Rows</th></tr></thead><tbody>
          {diagnostics.requirementTypes.map((item) => <tr key={item.code}><td style={tableCellStyle}>{item.code}</td><td style={tableCellStyle}>{item.count}</td></tr>)}
        </tbody></table>
      </div>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}><thead><tr><th style={tableHeaderStyle}>Requirement group</th><th style={tableHeaderStyle}>Rows</th></tr></thead><tbody>
          {diagnostics.requirementGroups.map((item) => <tr key={item.code}><td style={tableCellStyle}>{item.code}</td><td style={tableCellStyle}>{item.count}</td></tr>)}
        </tbody></table>
      </div>
    </section>
  );
}

type PropertyGroupingDiagnosticsPanelProps = {
  diagnostics: CfihosPropertyGroupingDiagnostics;
};

function PropertyGroupingDiagnosticsPanel({
  diagnostics,
}: PropertyGroupingDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.unresolvedClassCount > 0 ||
    diagnostics.unresolvedPropertyReferenceCount > 0 ||
    diagnostics.unresolvedSourceStandardReferenceCount > 0 ||
    diagnostics.invalidSequenceCount > 0 ||
    diagnostics.duplicateAssignmentCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Relationship domain validation</div>
          <h2 style={titleStyle}>Property grouping diagnostics</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
              maxWidth: 800,
            }}
          >
            Validates CFIHOS purpose-specific property grouping assignments,
            class and Property references, sequence ordering and Source Standard
            provenance before grouping is exposed in the production browsers.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review required" : "Relationships valid"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Grouping records</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Source rows" value={diagnostics.sourceRowCount} />
        <DiagnosticMetric label="Unique assignments" value={diagnostics.uniqueAssignmentCount} />
        <DiagnosticMetric
          label="Duplicate assignments"
          value={diagnostics.duplicateAssignmentCount}
          warning={diagnostics.duplicateAssignmentCount > 0}
        />
        <DiagnosticMetric label="Purposes" value={diagnostics.purposeCount} />
        <DiagnosticMetric label="Property groups" value={diagnostics.propertyGroupCount} />
        <DiagnosticMetric label="Classes referenced" value={diagnostics.classReferenceCount} />
        <DiagnosticMetric label="Properties referenced" value={diagnostics.propertyReferenceCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Class resolution</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Tag only" value={diagnostics.resolvedTagOnlyClassCount} />
        <DiagnosticMetric label="Equipment only" value={diagnostics.resolvedEquipmentOnlyClassCount} />
        <DiagnosticMetric label="Both domains" value={diagnostics.resolvedInBothClassCount} />
        <DiagnosticMetric
          label="Unresolved classes"
          value={diagnostics.unresolvedClassCount}
          warning={diagnostics.unresolvedClassCount > 0}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Property and provenance resolution</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Resolved Properties" value={diagnostics.resolvedPropertyReferenceCount} />
        <DiagnosticMetric
          label="Unresolved Properties"
          value={diagnostics.unresolvedPropertyReferenceCount}
          warning={diagnostics.unresolvedPropertyReferenceCount > 0}
        />
        <DiagnosticMetric label="Source Standards" value={diagnostics.sourceStandardReferenceCount} />
        <DiagnosticMetric label="Missing Source Standard" value={diagnostics.missingSourceStandardReferenceCount} />
        <DiagnosticMetric label="Resolved Source Standards" value={diagnostics.resolvedSourceStandardReferenceCount} />
        <DiagnosticMetric
          label="Unresolved Source Standards"
          value={diagnostics.unresolvedSourceStandardReferenceCount}
          warning={diagnostics.unresolvedSourceStandardReferenceCount > 0}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Sequence ordering</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Sequenced rows" value={diagnostics.sequencedRowCount} />
        <DiagnosticMetric label="No sequence" value={diagnostics.unsequencedRowCount} />
        <DiagnosticMetric
          label="Invalid sequences"
          value={diagnostics.invalidSequenceCount}
          warning={diagnostics.invalidSequenceCount > 0}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Purposes</div>
      <div style={{ ...tableWrapperStyle, marginBottom: 8 }}>
        <table style={{ ...tableStyle, minWidth: 860 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Purpose</th>
              <th style={tableHeaderStyle}>Purpose ID</th>
              <th style={tableHeaderStyle}>Rows</th>
              <th style={tableHeaderStyle}>Groups</th>
              <th style={tableHeaderStyle}>Classes</th>
              <th style={tableHeaderStyle}>Properties</th>
              <th style={tableHeaderStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.purposes.map((purpose) => (
              <tr key={purpose.purposeId ?? purpose.purposeCode}>
                <td style={tableCellStyle}><strong>{purpose.purposeCode}</strong></td>
                <td style={tableCellStyle}>{purpose.purposeId ?? "—"}</td>
                <td style={tableCellStyle}>{purpose.rowCount}</td>
                <td style={tableCellStyle}>{purpose.groupCount}</td>
                <td style={tableCellStyle}>{purpose.classCount}</td>
                <td style={tableCellStyle}>{purpose.propertyCount}</td>
                <td style={tableCellStyle}>{purpose.purposeDescription ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(diagnostics.unresolvedClassIds.length > 0 ||
        diagnostics.unresolvedPropertyIds.length > 0 ||
        diagnostics.unresolvedSourceStandardIds.length > 0) && (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            border: "1px solid #ead7b7",
            borderRadius: 9,
            background: "#fffaf2",
            color: "#76501a",
            fontSize: 11.5,
            lineHeight: 1.6,
          }}
        >
          <strong>Items requiring review</strong>
          {diagnostics.unresolvedClassIds.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Classes: {diagnostics.unresolvedClassIds.slice(0, 12).join(", ")}
              {diagnostics.unresolvedClassIds.length > 12 ? " ..." : ""}
            </div>
          )}
          {diagnostics.unresolvedPropertyIds.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Properties: {diagnostics.unresolvedPropertyIds.slice(0, 12).join(", ")}
              {diagnostics.unresolvedPropertyIds.length > 12 ? " ..." : ""}
            </div>
          )}
          {diagnostics.unresolvedSourceStandardIds.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Source Standards: {diagnostics.unresolvedSourceStandardIds.slice(0, 12).join(", ")}
              {diagnostics.unresolvedSourceStandardIds.length > 12 ? " ..." : ""}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type UnitOfMeasureDiagnosticsPanelProps = {
  diagnostics: CfihosUnitOfMeasureDiagnostics;
};

function UnitOfMeasureDiagnosticsPanel({
  diagnostics,
}: UnitOfMeasureDiagnosticsPanelProps) {
  const hasIssues =
    diagnostics.unresolvedUnitReferenceCount > 0 ||
    diagnostics.unresolvedPropertyDimensionReferenceCount > 0 ||
    diagnostics.duplicateUnitIdCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasIssues ? "#ead7b7" : "#c8ddd8",
        background: hasIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Reference domain validation</div>
          <h2 style={titleStyle}>Unit of Measure diagnostics</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 }}>
            Validates the CFIHOS Unit of Measure master and cross-checks every
            SI/Imperial class-property unit reference plus Property dimension
            references before Units become a production browser.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasIssues ? "#fff4e5" : "var(--brand-soft)",
            color: hasIssues ? "#9a6414" : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasIssues ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {hasIssues ? "Review required" : "References resolved"}
        </div>
      </div>

      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Units" value={diagnostics.sourceUnitCount} />
        <DiagnosticMetric label="Dimensions" value={diagnostics.dimensionCount} />
        <DiagnosticMetric label="Measurement systems" value={diagnostics.measurementSystemCount} />
        <DiagnosticMetric label="Duplicate unit IDs" value={diagnostics.duplicateUnitIdCount} />
        <DiagnosticMetric label="Duplicate names" value={diagnostics.duplicateUnitNameCount} />
        <DiagnosticMetric label="Missing symbols" value={diagnostics.missingSymbolCount} />
        <DiagnosticMetric label="Missing UNECE codes" value={diagnostics.missingUneceCodeCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Class-property unit references</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Tag SI" value={diagnostics.tagSiReferenceCount} />
        <DiagnosticMetric label="Tag Imperial" value={diagnostics.tagImperialReferenceCount} />
        <DiagnosticMetric label="Equipment SI" value={diagnostics.equipmentSiReferenceCount} />
        <DiagnosticMetric label="Equipment Imperial" value={diagnostics.equipmentImperialReferenceCount} />
        <DiagnosticMetric label="Resolved" value={diagnostics.resolvedUnitReferenceCount} />
        <DiagnosticMetric label="Unresolved" value={diagnostics.unresolvedUnitReferenceCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Property dimension references</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="References" value={diagnostics.propertyDimensionReferenceCount} />
        <DiagnosticMetric label="Resolved" value={diagnostics.resolvedPropertyDimensionReferenceCount} />
        <DiagnosticMetric label="Unresolved" value={diagnostics.unresolvedPropertyDimensionReferenceCount} />
      </div>

      {(diagnostics.unresolvedUnitIds.length > 0 ||
        diagnostics.unresolvedDimensionIds.length > 0) && (
        <div style={{ marginTop: 20, padding: 14, border: "1px solid #ead7b7", borderRadius: 9, background: "#fffaf2", fontSize: 11.5, lineHeight: 1.6 }}>
          {diagnostics.unresolvedUnitIds.length > 0 && (
            <div>
              <strong>Unresolved Unit IDs:</strong>{" "}
              {diagnostics.unresolvedUnitIds.join(", ")}
            </div>
          )}
          {diagnostics.unresolvedDimensionIds.length > 0 && (
            <div>
              <strong>Unresolved Dimension IDs:</strong>{" "}
              {diagnostics.unresolvedDimensionIds.join(", ")}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type ClassRelationshipDiagnosticsPanelProps = {
  diagnostics: CfihosClassRelationshipDiagnostics;
};

function ClassRelationshipDiagnosticsPanel({
  diagnostics,
}: ClassRelationshipDiagnosticsPanelProps) {
  const hasResolutionIssues =
    diagnostics.unresolvedTagReferenceCount > 0 ||
    diagnostics.unresolvedEquipmentReferenceCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasResolutionIssues ? "#ead7b7" : "#c8ddd8",
        background: hasResolutionIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 6,
            }}
          >
            <GitBranch size={19} />
            <strong>Tag ↔ Equipment relationship diagnostics</strong>
          </div>

          <div
            style={{
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            Validation of the explicit CFIHOS Tag Class to Equipment Class
            mappings before they are exposed in the production class browsers
            and Data Model.
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasResolutionIssues
              ? "#fff4e5"
              : "var(--brand-soft)",
            color: hasResolutionIssues
              ? "#9a6414"
              : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasResolutionIssues ? (
            <>
              <AlertTriangle size={15} />
              Review required
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Relationships valid
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 10,
        }}
      >
        <DiagnosticMetric
          label="Source mappings"
          value={diagnostics.sourceRelationshipCount}
        />

        <DiagnosticMetric
          label="Resolved mappings"
          value={diagnostics.resolvedRelationshipCount}
          warning={
            diagnostics.resolvedRelationshipCount !==
            diagnostics.sourceRelationshipCount
          }
        />

        <DiagnosticMetric
          label="Unique Tag Classes"
          value={diagnostics.uniqueTagClassCount}
        />

        <DiagnosticMetric
          label="Unique Equipment Classes"
          value={diagnostics.uniqueEquipmentClassCount}
        />

        <DiagnosticMetric
          label="Resolved Tag references"
          value={diagnostics.resolvedTagReferenceCount}
        />

        <DiagnosticMetric
          label="Resolved Equipment references"
          value={diagnostics.resolvedEquipmentReferenceCount}
        />

        <DiagnosticMetric
          label="Unresolved Tag references"
          value={diagnostics.unresolvedTagReferenceCount}
          warning={diagnostics.unresolvedTagReferenceCount > 0}
        />

        <DiagnosticMetric
          label="Unresolved Equipment references"
          value={diagnostics.unresolvedEquipmentReferenceCount}
          warning={diagnostics.unresolvedEquipmentReferenceCount > 0}
        />

        <DiagnosticMetric
          label="Same-ID mappings"
          value={diagnostics.sameCanonicalIdCount}
        />

        <DiagnosticMetric
          label="Different-ID mappings"
          value={diagnostics.differentCanonicalIdCount}
        />

        <DiagnosticMetric
          label="Mappings with reason"
          value={diagnostics.mappingReasonCount}
        />
      </div>

      {(diagnostics.unresolvedTagIds.length > 0 ||
        diagnostics.unresolvedEquipmentIds.length > 0) && (
        <div
          style={{
            marginTop: 22,
            padding: "14px 16px",
            border: "1px solid #ead7b7",
            borderRadius: 9,
            background: "#fffaf2",
            color: "#76501a",
            fontSize: 11,
            lineHeight: 1.55,
          }}
        >
          <strong>Unresolved IDs</strong>

          {diagnostics.unresolvedTagIds.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Tag: {diagnostics.unresolvedTagIds.slice(0, 12).join(", ")}
              {diagnostics.unresolvedTagIds.length > 12 ? " …" : ""}
            </div>
          )}

          {diagnostics.unresolvedEquipmentIds.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Equipment: {
                diagnostics.unresolvedEquipmentIds.slice(0, 12).join(", ")
              }
              {diagnostics.unresolvedEquipmentIds.length > 12 ? " …" : ""}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

async function buildEquipmentRequirementDomainMismatchDiagnostics(
  classDocumentDiagnostics: CfihosClassDocumentDiagnostics,
): Promise<CfihosEquipmentRequirementDomainMismatchDiagnostics> {
  const unresolved = classDocumentDiagnostics.unresolvedEquipmentRequirements;

  const [tagRows, equipmentRows, relationshipRows] = await Promise.all([
    getCfihosWorksheetRows("tag class"),
    getCfihosWorksheetRows("equipment class"),
    getCfihosWorksheetRows("tag equipment class relationshi"),
  ]);

  const tagClasses = new Map<string, string>();
  for (const row of tagRows) {
    const id = textValue(row["CFIHOS unique code"]);
    if (id) tagClasses.set(id, textValue(row["tag class name"]));
  }

  const equipmentClasses = new Map<string, string>();
  for (const row of equipmentRows) {
    const id = textValue(row["equipment class CFIHOS unique code"]);
    if (id) equipmentClasses.set(id, textValue(row["equipment class name"]));
  }

  const equipmentMappingsByTag = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of relationshipRows) {
    const tagId = textValue(row["tag class CFIHOS unique code"]);
    const equipmentId = textValue(row["equipment class CFIHOS unique code"]);
    if (!tagId || !equipmentId) continue;
    const list = equipmentMappingsByTag.get(tagId) ?? [];
    if (!list.some((item) => item.id === equipmentId)) {
      list.push({
        id: equipmentId,
        name:
          textValue(row["equipment class name"]) ||
          equipmentClasses.get(equipmentId) ||
          "",
      });
    }
    equipmentMappingsByTag.set(tagId, list);
  }

  const grouped = new Map<
    string,
    { className: string; requirementCount: number; documentTypes: Set<string> }
  >();
  for (const item of unresolved) {
    const current = grouped.get(item.classId) ?? {
      className: item.className,
      requirementCount: 0,
      documentTypes: new Set<string>(),
    };
    current.requirementCount += 1;
    if (item.documentTypeName) current.documentTypes.add(item.documentTypeName);
    grouped.set(item.classId, current);
  }

  const rows: CfihosEquipmentRequirementDomainMismatchRow[] = [...grouped.entries()]
    .map(([classId, item]) => {
      const tagClassName = tagClasses.get(classId) ?? null;
      const equipmentClassName = equipmentClasses.get(classId) ?? null;
      const tagPresent = tagClassName !== null;
      const equipmentPresent = equipmentClassName !== null;
      const classification: CfihosEquipmentRequirementDomainMismatchRow["classification"] =
        tagPresent && equipmentPresent
          ? "both-domains"
          : tagPresent
            ? "tag-only"
            : equipmentPresent
              ? "equipment-present"
              : "absent-from-both";

      return {
        classId,
        className: item.className,
        requirementCount: item.requirementCount,
        documentTypes: [...item.documentTypes].sort((a, b) => a.localeCompare(b)),
        tagClassName,
        equipmentClassName,
        mappedEquipmentClasses: equipmentMappingsByTag.get(classId) ?? [],
        classification,
      };
    })
    .sort((a, b) => b.requirementCount - a.requirementCount || a.classId.localeCompare(b.classId));

  const countRequirements = (classification: CfihosEquipmentRequirementDomainMismatchRow["classification"]) =>
    rows
      .filter((row) => row.classification === classification)
      .reduce((sum, row) => sum + row.requirementCount, 0);

  return {
    unresolvedEquipmentRequirementCount: unresolved.length,
    distinctClassCount: rows.length,
    tagOnlyClassCount: rows.filter((row) => row.classification === "tag-only").length,
    equipmentPresentClassCount: rows.filter((row) => row.classification === "equipment-present").length,
    bothDomainsClassCount: rows.filter((row) => row.classification === "both-domains").length,
    absentFromBothClassCount: rows.filter((row) => row.classification === "absent-from-both").length,
    tagOnlyRequirementCount: countRequirements("tag-only"),
    absentFromBothRequirementCount: countRequirements("absent-from-both"),
    classesWithEquipmentMappingCount: rows.filter((row) => row.mappedEquipmentClasses.length > 0).length,
    rows,
  };
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

type EquipmentRequirementDomainMismatchDiagnosticsPanelProps = {
  diagnostics: CfihosEquipmentRequirementDomainMismatchDiagnostics;
};

function EquipmentRequirementDomainMismatchDiagnosticsPanel({
  diagnostics,
}: EquipmentRequirementDomainMismatchDiagnosticsPanelProps) {
  const allTagOnly =
    diagnostics.unresolvedEquipmentRequirementCount > 0 &&
    diagnostics.tagOnlyRequirementCount === diagnostics.unresolvedEquipmentRequirementCount;
  const hasAbsent = diagnostics.absentFromBothRequirementCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: allTagOnly && !hasAbsent ? "#ead7b7" : hasAbsent ? "#e4b9b2" : "#c8ddd8",
        background:
          allTagOnly && !hasAbsent
            ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
            : hasAbsent
              ? "linear-gradient(135deg, #fff7f5 0%, #ffffff 70%)"
              : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>Class-domain mismatch investigation</div>
          <h2 style={titleStyle}>Equipment requirement class-domain diagnostics</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55, maxWidth: 900 }}>
            Cross-checks the class IDs behind the unresolved Equipment requirements against
            both the Tag Class and Equipment Class catalogues and the explicit Tag ↔ Equipment
            relationship table. This distinguishes a missing class from an asset-type/domain mismatch.
          </p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: allTagOnly && !hasAbsent ? "#fff4e5" : hasAbsent ? "#fff0ed" : "var(--brand-soft)", color: allTagOnly && !hasAbsent ? "#9a6414" : hasAbsent ? "#9b4437" : "var(--brand-dark)", fontSize: 11, fontWeight: 700 }}>
          {allTagOnly && !hasAbsent ? <AlertTriangle size={15} /> : hasAbsent ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
          {allTagOnly && !hasAbsent
            ? "Equipment rows reference Tag classes"
            : hasAbsent
              ? "Missing class IDs remain"
              : "No domain mismatch"}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Mismatch population</div>
      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric label="Unresolved Equipment rows" value={diagnostics.unresolvedEquipmentRequirementCount} warning={diagnostics.unresolvedEquipmentRequirementCount > 0} />
        <DiagnosticMetric label="Distinct class IDs" value={diagnostics.distinctClassCount} />
        <DiagnosticMetric label="Tag-only class IDs" value={diagnostics.tagOnlyClassCount} warning={diagnostics.tagOnlyClassCount > 0} />
        <DiagnosticMetric label="Equipment-present IDs" value={diagnostics.equipmentPresentClassCount} />
        <DiagnosticMetric label="Both-domain IDs" value={diagnostics.bothDomainsClassCount} />
        <DiagnosticMetric label="Absent from both" value={diagnostics.absentFromBothClassCount} warning={diagnostics.absentFromBothClassCount > 0} />
        <DiagnosticMetric label="Rows explained by Tag-only" value={diagnostics.tagOnlyRequirementCount} warning={diagnostics.tagOnlyRequirementCount > 0} />
        <DiagnosticMetric label="Classes with Tag↔Equipment mapping" value={diagnostics.classesWithEquipmentMappingCount} />
      </div>

      <div style={diagnosticGroupLabelStyle}>Class-domain detail</div>
      <div style={tableWrapperStyle}>
        <table style={{ ...tableStyle, minWidth: 1180 }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Class ID</th>
              <th style={tableHeaderStyle}>Requirement class name</th>
              <th style={tableHeaderStyle}>Rows</th>
              <th style={tableHeaderStyle}>Tag Class</th>
              <th style={tableHeaderStyle}>Equipment Class</th>
              <th style={tableHeaderStyle}>Tag ↔ Equipment counterpart(s)</th>
              <th style={tableHeaderStyle}>Classification</th>
              <th style={tableHeaderStyle}>Document Types</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.rows.map((row) => (
              <tr key={row.classId}>
                <td style={tableCellStyle}><strong>{row.classId}</strong></td>
                <td style={tableCellStyle}>{row.className || "—"}</td>
                <td style={tableCellStyle}>{row.requirementCount}</td>
                <td style={tableCellStyle}>{row.tagClassName ?? "—"}</td>
                <td style={tableCellStyle}>{row.equipmentClassName ?? "—"}</td>
                <td style={tableCellStyle}>
                  {row.mappedEquipmentClasses.length > 0
                    ? row.mappedEquipmentClasses.map((item) => `${item.name || item.id} (${item.id})`).join(", ")
                    : "—"}
                </td>
                <td style={tableCellStyle}>
                  {row.classification === "tag-only"
                    ? "Equipment requirement → Tag-only class"
                    : row.classification === "equipment-present"
                      ? "Equipment class exists"
                      : row.classification === "both-domains"
                        ? "Class exists in both domains"
                        : "Class absent from both catalogues"}
                </td>
                <td style={tableCellStyle}>{row.documentTypes.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ClassDocumentDiagnosticsPanelProps = {
  diagnostics: CfihosClassDocumentDiagnostics;
};

function ClassDocumentDiagnosticsPanel({
  diagnostics,
}: ClassDocumentDiagnosticsPanelProps) {
  const hasResolutionIssues =
    diagnostics.unresolvedClassReferenceCount > 0 ||
    diagnostics.unresolvedDocumentTypeReferenceCount > 0 ||
    diagnostics.unresolvedSourceStandardReferenceCount > 0 ||
    diagnostics.unknownAssetTypeRequirementCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: hasResolutionIssues ? "#ead7b7" : "#c8ddd8",
        background: hasResolutionIssues
          ? "linear-gradient(135deg, #fffaf2 0%, #ffffff 70%)"
          : "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 6,
            }}
          >
            <GitBranch size={19} />
            <strong>Class - Document requirement diagnostics</strong>
          </div>

          <div
            style={{
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            Validation of the CFIHOS document-required-per-class relationship
            before it is exposed in the production Class, Document and Data
            Model views.
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasResolutionIssues
              ? "#fff4e5"
              : "var(--brand-soft)",
            color: hasResolutionIssues
              ? "#9a6414"
              : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasResolutionIssues ? (
            <>
              <AlertTriangle size={15} />
              Review required
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Requirements valid
            </>
          )}
        </div>
      </div>

      <div style={diagnosticGroupLabelStyle}>Requirement records</div>

      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric
          label="Source requirements"
          value={diagnostics.sourceRequirementCount}
        />
        <DiagnosticMetric
          label="Unique semantic requirements"
          value={diagnostics.uniqueSemanticRequirementCount}
        />
        <DiagnosticMetric
          label="Duplicate semantic rows"
          value={diagnostics.duplicateSemanticRequirementCount}
          warning={diagnostics.duplicateSemanticRequirementCount > 0}
        />
        <DiagnosticMetric
          label="Resolved class references"
          value={diagnostics.resolvedClassReferenceCount}
        />
        <DiagnosticMetric
          label="Unresolved class references"
          value={diagnostics.unresolvedClassReferenceCount}
          warning={diagnostics.unresolvedClassReferenceCount > 0}
        />
        <DiagnosticMetric
          label="Resolved Document Types"
          value={diagnostics.resolvedDocumentTypeReferenceCount}
        />
        <DiagnosticMetric
          label="Unresolved Document Types"
          value={diagnostics.unresolvedDocumentTypeReferenceCount}
          warning={diagnostics.unresolvedDocumentTypeReferenceCount > 0}
        />
        <DiagnosticMetric
          label="Resolved Source Standards"
          value={diagnostics.resolvedSourceStandardReferenceCount}
        />
        <DiagnosticMetric
          label="Unresolved Source Standards"
          value={diagnostics.unresolvedSourceStandardReferenceCount}
          warning={diagnostics.unresolvedSourceStandardReferenceCount > 0}
        />
        <DiagnosticMetric
          label="Missing Source Standard"
          value={diagnostics.missingSourceStandardReferenceCount}
        />
      </div>

      <div style={diagnosticGroupLabelStyle}>Asset type breakdown</div>

      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric
          label="Tag requirements"
          value={diagnostics.tagRequirementCount}
        />
        <DiagnosticMetric
          label="Equipment requirements"
          value={diagnostics.equipmentRequirementCount}
        />
        <DiagnosticMetric
          label="Model / Part requirements"
          value={diagnostics.modelPartRequirementCount}
        />
        <DiagnosticMetric
          label="Plant requirements"
          value={diagnostics.plantRequirementCount}
        />
        <DiagnosticMetric
          label="Process Unit requirements"
          value={diagnostics.processUnitRequirementCount}
        />
        <DiagnosticMetric
          label="Other / unknown asset types"
          value={diagnostics.unknownAssetTypeRequirementCount}
          warning={diagnostics.unknownAssetTypeRequirementCount > 0}
        />
        <DiagnosticMetric
          label="Resolved Tag references"
          value={diagnostics.resolvedTagClassReferenceCount}
        />
        <DiagnosticMetric
          label="Unresolved Tag references"
          value={diagnostics.unresolvedTagClassReferenceCount}
          warning={diagnostics.unresolvedTagClassReferenceCount > 0}
        />
        <DiagnosticMetric
          label="Resolved Equipment references"
          value={diagnostics.resolvedEquipmentClassReferenceCount}
        />
        <DiagnosticMetric
          label="Unresolved Equipment references"
          value={diagnostics.unresolvedEquipmentClassReferenceCount}
          warning={diagnostics.unresolvedEquipmentClassReferenceCount > 0}
        />
      </div>

      {(diagnostics.plantRequirementCount > 0 ||
        diagnostics.processUnitRequirementCount > 0) && (
        <>
          <div style={diagnosticGroupLabelStyle}>Non-class asset contexts</div>

          <div
            style={{
              marginBottom: 20,
              padding: "13px 15px",
              border: "1px solid var(--line)",
              borderRadius: 9,
              background: "#f8faf9",
              color: "#5f6d69",
              fontSize: 11,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "#3f4d49" }}>
              Plant and Process Unit are preserved as explicit CFIHOS asset contexts.
            </strong>
            <div style={{ marginTop: 4 }}>
              They are not treated as unresolved Tag or Equipment Classes because
              the Explorer does not yet implement Plant or Process Unit entity
              browsers.
            </div>
          </div>
        </>
      )}

      <div style={diagnosticGroupLabelStyle}>Model / Part class resolution</div>

      <div style={diagnosticMetricGridStyle}>
        <DiagnosticMetric
          label="Tag domain only"
          value={diagnostics.modelPartResolvedAsTagOnlyCount}
        />
        <DiagnosticMetric
          label="Equipment domain only"
          value={diagnostics.modelPartResolvedAsEquipmentOnlyCount}
        />
        <DiagnosticMetric
          label="Both class domains"
          value={diagnostics.modelPartResolvedInBothDomainsCount}
        />
        <DiagnosticMetric
          label="Unresolved Model / Part"
          value={diagnostics.modelPartUnresolvedClassCount}
          warning={diagnostics.modelPartUnresolvedClassCount > 0}
        />
      </div>

      {diagnostics.unresolvedEquipmentRequirements.length > 0 && (
        <>
          <div style={diagnosticGroupLabelStyle}>
            Unresolved Equipment requirements
          </div>

          <div style={{ ...tableWrapperStyle, marginBottom: 20 }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Class ID</th>
                  <th style={tableHeaderStyle}>Class name</th>
                  <th style={tableHeaderStyle}>Document Type</th>
                  <th style={tableHeaderStyle}>Document ID</th>
                  <th style={tableHeaderStyle}>Source Standard</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.unresolvedEquipmentRequirements.map(
                  (item, index) => (
                    <tr key={`${item.requirementId}-${index}`}>
                      <td
                        style={{
                          ...tableCellStyle,
                          borderBottom:
                            index <
                            diagnostics.unresolvedEquipmentRequirements.length - 1
                              ? "1px solid var(--line)"
                              : "none",
                        }}
                      >
                        {item.classId}
                      </td>
                      <td style={tableCellStyle}>{item.className}</td>
                      <td style={tableCellStyle}>{item.documentTypeName}</td>
                      <td style={tableCellStyle}>{item.documentTypeId}</td>
                      <td style={tableCellStyle}>
                        {item.sourceStandardCode ??
                          item.sourceStandardId ??
                          "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(diagnostics.unknownAssetTypeValues.length > 0 ||
        diagnostics.unresolvedClassIds.length > 0 ||
        diagnostics.unresolvedDocumentTypeIds.length > 0 ||
        diagnostics.unresolvedSourceStandardIds.length > 0) && (
        <div
          style={{
            marginTop: 22,
            padding: "14px 16px",
            border: "1px solid #ead7b7",
            borderRadius: 9,
            background: "#fffaf2",
            color: "#76501a",
            fontSize: 11,
            lineHeight: 1.55,
          }}
        >
          <strong>Items requiring review</strong>

          {diagnostics.unknownAssetTypeValues.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Asset types: {diagnostics.unknownAssetTypeValues.join(", ")}
            </div>
          )}

          {diagnostics.unresolvedClassIds.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Classes: {diagnostics.unresolvedClassIds.slice(0, 12).join(", ")}
              {diagnostics.unresolvedClassIds.length > 12 ? " ..." : ""}
            </div>
          )}

          {diagnostics.unresolvedDocumentTypeIds.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Document Types: {diagnostics.unresolvedDocumentTypeIds
                .slice(0, 12)
                .join(", ")}
              {diagnostics.unresolvedDocumentTypeIds.length > 12 ? " ..." : ""}
            </div>
          )}

          {diagnostics.unresolvedSourceStandardIds.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Source Standards: {diagnostics.unresolvedSourceStandardIds
                .slice(0, 12)
                .join(", ")}
              {diagnostics.unresolvedSourceStandardIds.length > 12 ? " ..." : ""}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type EquipmentHierarchyDiagnosticsPanelProps = {
  diagnostics: CfihosEquipmentHierarchyDiagnostics;
};

function EquipmentHierarchyDiagnosticsPanel({
  diagnostics,
}: EquipmentHierarchyDiagnosticsPanelProps) {
  const hasStructuralIssues =
    diagnostics.unresolvedParentCount > 0 ||
    diagnostics.ambiguousParentCount > 0 ||
    diagnostics.selfParentCount > 0 ||
    diagnostics.cycleCount > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: "#c8ddd8",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 6,
            }}
          >
            <GitBranch size={19} />

            <strong>Equipment Class hierarchy diagnostics</strong>
          </div>

          <div
            style={{
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            Validation of the Equipment Class parent relationships before the
            hierarchy and property inheritance are enabled in the production
            browser.
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasStructuralIssues
              ? "#fff4e5"
              : "var(--brand-soft)",
            color: hasStructuralIssues
              ? "#9a6414"
              : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasStructuralIssues ? (
            <>
              <AlertTriangle size={15} />
              Review required
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Hierarchy valid
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <DiagnosticMetric
          label="Equipment Classes"
          value={diagnostics.equipmentClassCount}
        />

        <DiagnosticMetric
          label="Root classes"
          value={diagnostics.rootCount}
        />

        <DiagnosticMetric
          label="Resolved parents"
          value={diagnostics.resolvedParentCount}
        />

        <DiagnosticMetric
          label="Unresolved parents"
          value={diagnostics.unresolvedParentCount}
          warning={diagnostics.unresolvedParentCount > 0}
        />

        <DiagnosticMetric
          label="Ambiguous parents"
          value={diagnostics.ambiguousParentCount}
          warning={diagnostics.ambiguousParentCount > 0}
        />

        <DiagnosticMetric
          label="Self-parent"
          value={diagnostics.selfParentCount}
          warning={diagnostics.selfParentCount > 0}
        />

        <DiagnosticMetric
          label="Cycles"
          value={diagnostics.cycleCount}
          warning={diagnostics.cycleCount > 0}
        />

        <DiagnosticMetric
          label="Duplicate names"
          value={diagnostics.duplicateNameCount}
          warning={diagnostics.duplicateNameCount > 0}
        />
      </div>

      {diagnostics.issues.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={subheadingStyle}>
            Equipment hierarchy issues ({diagnostics.issues.length})
          </div>

          <div
            style={{
              overflowX: "auto",
              border: "1px solid var(--line)",
              borderRadius: 10,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 850,
              }}
            >
              <thead>
                <tr>
                  <th style={diagnosticTableHeaderStyle}>Issue</th>
                  <th style={diagnosticTableHeaderStyle}>
                    Equipment Class
                  </th>
                  <th style={diagnosticTableHeaderStyle}>CFIHOS code</th>
                  <th style={diagnosticTableHeaderStyle}>Parent name</th>
                  <th style={diagnosticTableHeaderStyle}>Details</th>
                </tr>
              </thead>

              <tbody>
                {diagnostics.issues.map((issue, index) => (
                  <tr
                    key={`${issue.type}-${issue.equipmentClassId}-${index}`}
                  >
                    <td style={diagnosticTableCellStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "5px 7px",
                          borderRadius: 6,
                          background: "#fff4e5",
                          color: "#9a6414",
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatEquipmentIssueType(issue.type)}
                      </span>
                    </td>

                    <td style={diagnosticTableCellStyle}>
                      {issue.equipmentClassName}
                    </td>

                    <td
                      style={{
                        ...diagnosticTableCellStyle,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 10.5,
                      }}
                    >
                      {issue.equipmentClassId}
                    </td>

                    <td style={diagnosticTableCellStyle}>
                      {issue.parentName ?? "—"}
                    </td>

                    <td
                      style={{
                        ...diagnosticTableCellStyle,
                        color: "var(--muted)",
                      }}
                    >
                      {issue.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type EquipmentInheritanceExamplePanelProps = {
  example: CfihosEquipmentInheritanceExample | null;
};

function EquipmentInheritanceExamplePanel({
  example,
}: EquipmentInheritanceExamplePanelProps) {
  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: "#c8ddd8",
        background:
          "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 6,
        }}
      >
        <Sparkles size={19} />

        <strong>Equipment property inheritance example</strong>
      </div>

      <div
        style={{
          color: "var(--muted)",
          fontSize: 12.5,
          lineHeight: 1.55,
          marginBottom: 22,
        }}
      >
        A real Equipment Class from the official RDL containing both direct and
        inherited effective properties.
      </div>

      {example ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(240px, 1.5fr) repeat(3, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: 16,
              border: "1px solid var(--line)",
              borderRadius: 9,
              background: "#f8faf9",
            }}
          >
            <div
              style={{
                color: "var(--brand)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Suggested test class
            </div>

            <div
              style={{
                color: "var(--ink)",
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 5,
              }}
            >
              {example.equipmentClassName}
            </div>

            <div
              style={{
                color: "var(--muted)",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 10.5,
              }}
            >
              {example.equipmentClassId}
            </div>
          </div>

          <DiagnosticMetric
            label="Direct properties"
            value={example.directPropertyCount}
          />

          <DiagnosticMetric
            label="Inherited properties"
            value={example.inheritedPropertyCount}
          />

          <DiagnosticMetric
            label="Effective properties"
            value={example.effectivePropertyCount}
          />

          {example.inheritedFrom.length > 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                marginTop: 8,
                padding: "14px 16px",
                border: "1px solid var(--line)",
                borderRadius: 9,
                background: "#f8faf9",
              }}
            >
              <div style={subheadingStyle}>
                Inherited from
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {example.inheritedFrom.map((source) => (
                  <span
                    key={source.equipmentClassId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 9px",
                      borderRadius: 7,
                      background: "var(--brand-soft)",
                      color: "var(--brand-dark)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {source.equipmentClassName}

                    <span
                      style={{
                        color: "var(--muted)",
                        fontWeight: 500,
                      }}
                    >
                      {source.propertyCount}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--line)",
            borderRadius: 9,
            background: "#f8faf9",
            color: "var(--muted)",
            fontSize: 12.5,
          }}
        >
          No Equipment Class containing both direct and inherited properties
          was found.
        </div>
      )}
    </section>
  );
}

type EquipmentInspectionIntroProps = {
  inspections: CfihosWorksheetInspection[];
};

function EquipmentInspectionIntro({
  inspections,
}: EquipmentInspectionIntroProps) {
  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: "#c8ddd8",
        background:
          "linear-gradient(135deg, #f7fbfa 0%, #ffffff 70%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              color: "var(--brand)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Equipment domain
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 24,
            }}
          >
            Equipment Class schema inspection
          </h2>

          <p
            style={{
              maxWidth: 720,
              margin: "10px 0 0",
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            Source worksheets defining the Equipment Class domain model,
            hierarchy, property relationships and applicability indicators.
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            flex: "0 0 auto",
            alignItems: "center",
            minHeight: 28,
            padding: "0 9px",
            borderRadius: 7,
            background: "var(--brand-soft)",
            color: "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {inspections.length} worksheets
        </span>
      </div>
    </section>
  );
}

type HierarchyDiagnosticsPanelProps = {
  diagnostics: CfihosHierarchyDiagnostics;
};

function HierarchyDiagnosticsPanel({
  diagnostics,
}: HierarchyDiagnosticsPanelProps) {
  const hasStructuralIssues =
    diagnostics.unresolvedParentCount > 0 ||
    diagnostics.ambiguousParentCount > 0 ||
    diagnostics.selfParentCount > 0 ||
    diagnostics.cycleCount > 0;

  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 6,
            }}
          >
            <GitBranch size={19} />

            <strong>Tag Class hierarchy diagnostics</strong>
          </div>

          <div
            style={{
              color: "var(--muted)",
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            Validation of parent relationships used to construct the Tag Class
            hierarchy and inherited property chain.
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            flex: "0 0 auto",
            padding: "7px 10px",
            borderRadius: 8,
            background: hasStructuralIssues
              ? "#fff4e5"
              : "var(--brand-soft)",
            color: hasStructuralIssues
              ? "#9a6414"
              : "var(--brand-dark)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {hasStructuralIssues ? (
            <>
              <AlertTriangle size={15} />
              Review required
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Hierarchy valid
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <DiagnosticMetric
          label="Tag Classes"
          value={diagnostics.tagClassCount}
        />

        <DiagnosticMetric
          label="Root classes"
          value={diagnostics.rootCount}
        />

        <DiagnosticMetric
          label="Resolved parents"
          value={diagnostics.resolvedParentCount}
        />

        <DiagnosticMetric
          label="Unresolved parents"
          value={diagnostics.unresolvedParentCount}
          warning={diagnostics.unresolvedParentCount > 0}
        />

        <DiagnosticMetric
          label="Ambiguous parents"
          value={diagnostics.ambiguousParentCount}
          warning={diagnostics.ambiguousParentCount > 0}
        />

        <DiagnosticMetric
          label="Self-parent"
          value={diagnostics.selfParentCount}
          warning={diagnostics.selfParentCount > 0}
        />

        <DiagnosticMetric
          label="Cycles"
          value={diagnostics.cycleCount}
          warning={diagnostics.cycleCount > 0}
        />

        <DiagnosticMetric
          label="Duplicate names"
          value={diagnostics.duplicateNameCount}
          warning={diagnostics.duplicateNameCount > 0}
        />
      </div>

      {diagnostics.issues.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={subheadingStyle}>
            Hierarchy issues ({diagnostics.issues.length})
          </div>

          <div
            style={{
              overflowX: "auto",
              border: "1px solid var(--line)",
              borderRadius: 10,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 850,
              }}
            >
              <thead>
                <tr>
                  <th style={diagnosticTableHeaderStyle}>Issue</th>
                  <th style={diagnosticTableHeaderStyle}>Tag Class</th>
                  <th style={diagnosticTableHeaderStyle}>CFIHOS code</th>
                  <th style={diagnosticTableHeaderStyle}>Parent name</th>
                  <th style={diagnosticTableHeaderStyle}>Details</th>
                </tr>
              </thead>

              <tbody>
                {diagnostics.issues.map((issue, index) => (
                  <tr
                    key={`${issue.type}-${issue.tagClassId}-${index}`}
                  >
                    <td style={diagnosticTableCellStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "5px 7px",
                          borderRadius: 6,
                          background: "#fff4e5",
                          color: "#9a6414",
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatIssueType(issue.type)}
                      </span>
                    </td>

                    <td style={diagnosticTableCellStyle}>
                      {issue.tagClassName}
                    </td>

                    <td
                      style={{
                        ...diagnosticTableCellStyle,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 10.5,
                      }}
                    >
                      {issue.tagClassId}
                    </td>

                    <td style={diagnosticTableCellStyle}>
                      {issue.parentName ?? "—"}
                    </td>

                    <td
                      style={{
                        ...diagnosticTableCellStyle,
                        color: "var(--muted)",
                      }}
                    >
                      {issue.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type InheritanceExamplePanelProps = {
  example: CfihosInheritanceExample | null;
};

function InheritanceExamplePanel({
  example,
}: InheritanceExamplePanelProps) {
  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 6,
        }}
      >
        <Sparkles size={19} />

        <strong>Tag Class property inheritance example</strong>
      </div>

      <div
        style={{
          color: "var(--muted)",
          fontSize: 12.5,
          lineHeight: 1.55,
          marginBottom: 22,
        }}
      >
        A real Tag Class from the official RDL that contains both direct and
        inherited effective properties.
      </div>

      {example ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(240px, 1.5fr) repeat(3, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: 16,
              border: "1px solid var(--line)",
              borderRadius: 9,
              background: "#f8faf9",
            }}
          >
            <div
              style={{
                color: "var(--brand)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Suggested test class
            </div>

            <div
              style={{
                color: "var(--ink)",
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 5,
              }}
            >
              {example.tagClassName}
            </div>

            <div
              style={{
                color: "var(--muted)",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 10.5,
                marginBottom: 12,
              }}
            >
              {example.tagClassId}
            </div>

            <Link
              to={`/classes/tag/${encodeURIComponent(example.tagClassId)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 30,
                padding: "0 10px",
                borderRadius: 7,
                background: "var(--brand)",
                color: "white",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Open Tag Class
            </Link>
          </div>

          <DiagnosticMetric
            label="Direct properties"
            value={example.directPropertyCount}
          />

          <DiagnosticMetric
            label="Inherited properties"
            value={example.inheritedPropertyCount}
          />

          <DiagnosticMetric
            label="Effective properties"
            value={example.effectivePropertyCount}
          />

          {example.inheritedFrom.length > 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                marginTop: 8,
                padding: "14px 16px",
                border: "1px solid var(--line)",
                borderRadius: 9,
                background: "#f8faf9",
              }}
            >
              <div style={subheadingStyle}>
                Inherited from
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {example.inheritedFrom.map((source) => (
                  <span
                    key={source.tagClassId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 9px",
                      borderRadius: 7,
                      background: "var(--brand-soft)",
                      color: "var(--brand-dark)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {source.tagClassName}

                    <span
                      style={{
                        color: "var(--muted)",
                        fontWeight: 500,
                      }}
                    >
                      {source.propertyCount}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--line)",
            borderRadius: 9,
            background: "#f8faf9",
            color: "var(--muted)",
            fontSize: 12.5,
          }}
        >
          No Tag Class containing both direct and inherited properties was
          found.
        </div>
      )}
    </section>
  );
}

type DiagnosticMetricProps = {
  label: string;
  value: number;
  warning?: boolean;
};

function DiagnosticMetric({
  label,
  value,
  warning = false,
}: DiagnosticMetricProps) {
  return (
    <div
      style={{
        padding: "15px 16px",
        border: "1px solid var(--line)",
        borderRadius: 9,
        background: warning ? "#fffaf2" : "#f8faf9",
      }}
    >
      <div
        style={{
          color: warning ? "#9a6414" : "var(--ink)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 3,
          color: "var(--muted)",
          fontSize: 10.5,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

type WorkbookOverviewProps = {
  sheetNames: string[];
};

function WorkbookOverview({
  sheetNames,
}: WorkbookOverviewProps) {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>
        <Database size={19} />
        <strong>Workbook worksheets</strong>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
        }}
      >
        {sheetNames.map((sheetName) => {
          const isInspected =
            INSPECTION_SHEETS.includes(
              sheetName as
                (typeof INSPECTION_SHEETS)[number],
            );

          return (
            <div
              key={sheetName}
              style={{
                padding: "10px 12px",
                background: isInspected
                  ? "var(--brand-soft)"
                  : "#f6f8f7",
                color: isInspected
                  ? "var(--brand-dark)"
                  : "inherit",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: isInspected
                  ? 600
                  : 400,
              }}
            >
              {sheetName}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type WorksheetInspectionProps = {
  inspection: CfihosWorksheetInspection;
  accent?: "default" | "equipment";
};

function WorksheetInspection({
  inspection,
  accent = "default",
}: WorksheetInspectionProps) {
  const isEquipment =
    accent === "equipment";

  return (
    <section
      style={{
        ...sectionStyle,
        borderColor: isEquipment
          ? "#c8ddd8"
          : "var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--brand)",
              marginBottom: 6,
            }}
          >
            {isEquipment
              ? "Equipment schema inspection"
              : "Worksheet inspection"}
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 24,
            }}
          >
            {inspection.sheetName}
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            gap: 18,
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          <span style={statStyle}>
            <Columns3 size={16} />
            {inspection.headers.length} columns
          </span>

          <span style={statStyle}>
            <Rows3 size={16} />
            {inspection.rowCount} rows
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={subheadingStyle}>
          Column headers
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {inspection.headers.map((header) => (
            <span
              key={header}
              style={{
                padding: "7px 10px",
                background: "var(--brand-soft)",
                color: "var(--brand-dark)",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {header}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div style={subheadingStyle}>
          First {inspection.sampleRows.length} rows
        </div>

        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--line)",
            borderRadius: 10,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: Math.max(
                900,
                inspection.headers.length * 160,
              ),
            }}
          >
            <thead>
              <tr>
                {inspection.headers.map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      padding: "11px 12px",
                      borderBottom:
                        "1px solid var(--line)",
                      background: "#f6f8f7",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {inspection.sampleRows.map(
                (row, rowIndex) => (
                  <tr key={rowIndex}>
                    {inspection.headers.map(
                      (header) => (
                        <td
                          key={header}
                          style={{
                            padding: "11px 12px",
                            borderBottom:
                              rowIndex <
                              inspection.sampleRows.length - 1
                                ? "1px solid var(--line)"
                                : "none",
                            verticalAlign: "top",
                            color: "var(--muted)",
                            minWidth: 140,
                            maxWidth: 320,
                            wordBreak: "break-word",
                          }}
                        >
                          {formatCellValue(
                            row[header],
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const sectionStyle = {
  marginTop: 32,
  maxWidth: 1200,
  background: "white",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 24,
};

const headingStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 24,
  marginBottom: 22,
};

const eyebrowStyle = {
  marginBottom: 6,
  color: "var(--brand)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const titleStyle = {
  margin: 0,
  fontSize: 24,
  fontWeight: 600,
};

const sectionTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 18,
};

const statStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const subheadingStyle = {
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 10,
};

const diagnosticMetricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 10,
};

const diagnosticGroupLabelStyle = {
  marginTop: 20,
  marginBottom: 9,
  color: "#687572",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
};

const tableWrapperStyle = {
  width: "100%",
  maxWidth: "100%",
  overflowX: "auto" as const,
  overflowY: "hidden" as const,
  border: "1px solid var(--line)",
  borderRadius: 10,
  WebkitOverflowScrolling: "touch" as const,
};

const tableStyle = {
  width: "100%",
  minWidth: 760,
  borderCollapse: "collapse" as const,
  fontSize: 12,
};

const tableHeaderStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--line)",
  background: "#f6f8f7",
  color: "#35423f",
  textAlign: "left" as const,
  verticalAlign: "top" as const,
  fontSize: 10.5,
  fontWeight: 700,
  lineHeight: 1.35,
};

const tableCellStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--line)",
  color: "var(--muted)",
  verticalAlign: "top" as const,
  lineHeight: 1.45,
};

const diagnosticTableHeaderStyle = {
  padding: "11px 12px",
  borderBottom: "1px solid var(--line)",
  background: "#f6f8f7",
  color: "#687572",
  textAlign: "left" as const,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  whiteSpace: "nowrap" as const,
};

const diagnosticTableCellStyle = {
  padding: "11px 12px",
  borderBottom: "1px solid #edf1f0",
  verticalAlign: "top" as const,
  fontSize: 12,
};

function formatIssueType(
  type: CfihosHierarchyDiagnostics["issues"][number]["type"],
): string {
  switch (type) {
    case "unresolved-parent":
      return "Unresolved parent";

    case "ambiguous-parent":
      return "Ambiguous parent";

    case "self-parent":
      return "Self-parent";

    case "cycle":
      return "Cycle";

    default:
      return type;
  }
}

function formatEquipmentIssueType(
  type: CfihosEquipmentHierarchyDiagnostics["issues"][number]["type"],
): string {
  switch (type) {
    case "unresolved-parent":
      return "Unresolved parent";

    case "ambiguous-parent":
      return "Ambiguous parent";

    case "self-parent":
      return "Self-parent";

    case "cycle":
      return "Cycle";

    default:
      return type;
  }
}

function formatCellValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}