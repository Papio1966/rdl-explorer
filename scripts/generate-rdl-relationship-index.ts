import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readWorkbook, worksheetRows } from "./rdl-ingestion/workbookReader.ts";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusCfihosFormatProfile.ts";
import { CCUS_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusV2CfihosFormatProfile.ts";
import { WATER_DESALINATION_PROFILE } from "./rdl-ingestion/WaterDesalinationProfile.ts";
import { WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/WaterDesalinationV2CfihosFormatProfile.ts";
import type { RdlWorkbookMappingProfile } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";
import { mappedText } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";

type Row = Record<string, unknown>;
type Attributes = Record<string, string>;

type RelationshipOut = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  attributes: Attributes;
  sourceSheet: string;
};

const output = new Map<string, RelationshipOut>();

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function first(row: Row, aliases: string[]): string {
  for (const alias of aliases) {
    const value = text(row[alias]);
    if (value) return value;
  }
  return "";
}

function stableDerivedId(sourceKey: string, kind: string, parts: string[]): string {
  const seed = parts.map((part) => part.trim().toLowerCase()).join("|");
  return `${sourceKey}:${kind}:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

function same(value: string, candidate: string): boolean {
  return Boolean(value && candidate && value.trim().toLowerCase() === candidate.trim().toLowerCase());
}

function compactAttributes(values: Record<string, unknown>): Attributes {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, text(value)] as const)
      .filter(([, value]) => Boolean(value)),
  );
}

function addRelationship(
  context: Pick<RelationshipOut, "sourceKey" | "sourceName" | "releaseKey" | "releaseStatus" | "versionLabel" | "packageKey">,
  relationshipType: string,
  sourceEntityType: string,
  sourceNativeIdentifier: string,
  targetEntityType: string,
  targetNativeIdentifier: string,
  attributes: Record<string, unknown>,
  sourceSheet: string,
) {
  if (!sourceNativeIdentifier || !targetNativeIdentifier) return;
  const record: RelationshipOut = {
    ...context,
    relationshipType,
    sourceEntityType,
    sourceNativeIdentifier,
    targetEntityType,
    targetNativeIdentifier,
    attributes: compactAttributes(attributes),
    sourceSheet,
  };
  const key = [
    record.packageKey,
    record.relationshipType,
    record.sourceEntityType,
    record.sourceNativeIdentifier,
    record.targetEntityType,
    record.targetNativeIdentifier,
    record.relationshipType.startsWith("mapping_") ? (record.attributes.mappingId ?? "") : "",
  ].join("|");
  output.set(key, record);
}

async function addProfile(profile: RdlWorkbookMappingProfile) {
  const bytes = readFileSync(profile.workbookPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const workbook = await readWorkbook(bytes);
  const packageKey = `${profile.sourceKey}-${profile.versionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${sha256.slice(0, 12)}`;
  const releaseStatus = profile.releaseKey.endsWith("0.1-draft") ? "superseded" : profile.releaseStatus;
  const context = {
    sourceKey: profile.sourceKey,
    sourceName: profile.sourceName,
    releaseKey: profile.releaseKey,
    releaseStatus,
    versionLabel: profile.versionLabel,
    packageKey,
  };
  const rows = (key: string): Row[] => {
    const sheetName = profile.sheetNames[key];
    if (!sheetName) return [];
    const sheet = workbook.sheets[sheetName];
    return sheet ? worksheetRows<Row>(sheet) : [];
  };
  const t = (row: Row, field: string) => mappedText(row, profile.fields[field] ?? [field]);

  const tagRows = rows("tagClass");
  const equipmentRows = rows("equipmentClass");
  const propertyRows = rows("property");
  const documentRows = rows("documentType");
  const standardRows = rows("sourceStandard");
  const informationRows = rows("informationRequirement");
  const unitRows = rows("unit");
  const controlledRows = rows("controlledValue");
  const sourceMappingRows = rows("sourceMapping");
  const tagIds = new Set(tagRows.map((row) => t(row, "tagClassId")).filter(Boolean));
  const equipmentIds = new Set(equipmentRows.map((row) => t(row, "equipmentClassId")).filter(Boolean));
  const propertyIds = new Set(propertyRows.map((row) => t(row, "propertyId")).filter(Boolean));
  const documentIds = new Set(documentRows.map((row) => t(row, "documentId")).filter(Boolean));
  const standardIds = new Set(standardRows.map((row) => t(row, "sourceStandardId")).filter(Boolean));
  const informationIds = new Set(informationRows.map((row) => t(row, "informationRequirementId")).filter(Boolean));
  const unitIds = new Set(unitRows.map((row) => t(row, "unitId")).filter(Boolean));

  const informationAttributes = (row: Row) => ({
    requirementNumber: t(row, "informationRequirementNumber"),
    requirementTitle: t(row, "informationRequirementTitle"),
    requirementLevel: t(row, "informationRequirementLevel"),
    requirementGroup: first(row, ["requirement group code", "requirement group", "requirement category"]),
    typicalDeliverable: first(row, ["typical deliverable"]),
    submitAtProposal: first(row, ["submit at proposal indicator", "submit at proposal"]),
    submitForReview: first(row, ["submit for review indicator", "submit for review"]),
    submitAtDelivery: first(row, ["submit at delivery indicator", "submit at delivery"]),
    requiredHandoverStatus: first(row, ["required handover status code"]),
    requiredTranslation: first(row, ["required translation indicator"]),
    deliverableFormat: first(row, ["deliverable format code"]),
    sourceChapter: first(row, ["engineering standard source chapter", "source chapter"]),
    reviewWeeks: first(row, ["issue for review number of weeks"]),
    reviewReferenceDate: first(row, ["issue for review reference date"]),
    approvalWeeks: first(row, ["issue for approval number of weeks"]),
    approvalReferenceDate: first(row, ["issue for approval reference date"]),
    informationWeeks: first(row, ["for information number of weeks"]),
    informationReferenceDate: first(row, ["for information reference date"]),
  });

  function hierarchy(data: Row[], entityType: string, idField: string, nameField: string, parentNameField: string, parentIdField: string, sheetKey: string) {
    const byName = new Map(data.map((row) => [t(row, nameField).toLowerCase(), t(row, idField)]));
    const ids = new Set(data.map((row) => t(row, idField)).filter(Boolean));
    data.forEach((row) => {
      const child = t(row, idField);
      const explicitParent = t(row, parentIdField);
      const namedParent = byName.get(t(row, parentNameField).toLowerCase()) ?? "";
      const parent = explicitParent && ids.has(explicitParent) ? explicitParent : namedParent;
      if (parent) addRelationship(context, "entity_parent", entityType, child, entityType, parent, {}, profile.sheetNames[sheetKey]);
    });
  }

  hierarchy(tagRows, "tag_class", "tagClassId", "tagClassName", "tagParentName", "tagParentId", "tagClass");
  hierarchy(equipmentRows, "equipment_class", "equipmentClassId", "equipmentClassName", "equipmentParentName", "equipmentParentId", "equipmentClass");

  rows("tagClassProperty").forEach((row) => {
    const classId = t(row, "tagClassId");
    const propertyId = t(row, "propertyId");
    if (tagIds.has(classId) && propertyIds.has(propertyId)) {
      addRelationship(context, "class_property", "tag_class", classId, "property", propertyId, {
        mandatory: t(row, "mandatory"),
        relevance: t(row, "relevance"),
        sequence: text(row["property sequence number"]),
      }, profile.sheetNames.tagClassProperty);
    }
  });

  rows("equipmentClassProperty").forEach((row) => {
    const classId = t(row, "equipmentClassId");
    const propertyId = t(row, "propertyId");
    if (equipmentIds.has(classId) && propertyIds.has(propertyId)) {
      addRelationship(context, "class_property", "equipment_class", classId, "property", propertyId, {
        mandatory: t(row, "mandatory") || text(row["mandatory indicator"]),
        relevance: t(row, "relevance"),
        sequence: text(row["property sequence number"]),
      }, profile.sheetNames.equipmentClassProperty);
    }
  });

  const disciplineByCode = new Map(rows("discipline").map((row) => [t(row, "disciplineCode").toLowerCase(), t(row, "disciplineId")]));
  rows("disciplineDocument").forEach((row) => {
    const documentId = t(row, "documentId");
    const disciplineId = disciplineByCode.get(t(row, "disciplineRefCode").toLowerCase()) ?? "";
    if (documentIds.has(documentId) && disciplineId) {
      addRelationship(context, "document_discipline", "document_type", documentId, "discipline", disciplineId, {
        requirementLevel: t(row, "requirementLevel"),
        contextCode: first(row, ["discipline document type short code"]),
        assetType: first(row, ["asset type reference"]),
        representationType: first(row, ["representation type"]),
        nativeFileDeliveryTiming: first(row, ["native file delivery timing"]),
        nativeDocumentFormat: first(row, ["native document format"]),
        authenticatedRecordFormat: first(row, ["authenticated record format"]),
        detailedEngineeringStatus: first(row, ["required document status for detailed engineering"]),
        constructionStatus: first(row, ["required document status for construction"]),
        commissioningStatus: first(row, ["required document status for commissioning"]),
        startupStatus: first(row, ["required document status for startup"]),
        operationsStatus: first(row, ["required document status for operations"]),
        reviewType: first(row, ["review type"]),
        comment: first(row, ["discipline document type comment"]),
      }, profile.sheetNames.disciplineDocument);
    }
  });

  rows("tagEquipment").forEach((row) => {
    const tagId = t(row, "tagClassId");
    const equipmentId = t(row, "equipmentClassId");
    if (tagIds.has(tagId) && equipmentIds.has(equipmentId)) {
      addRelationship(context, "tag_equipment_mapping", "tag_class", tagId, "equipment_class", equipmentId, {
        mappingId: t(row, "relationshipId"),
        relationshipType: t(row, "relationshipType"),
        reason: text(row["relationship reason for mapping"]),
      }, profile.sheetNames.tagEquipment);
    }
  });

  rows("classDocument").forEach((row) => {
    const classId = t(row, "classId");
    const documentId = t(row, "documentId");
    const informationRequirementId = t(row, "informationRequirementId");
    const sourceStandardId = t(row, "sourceStandardId");
    if (!documentIds.has(documentId)) return;
    const classTypes = [
      ...(tagIds.has(classId) ? ["tag_class"] : []),
      ...(equipmentIds.has(classId) ? ["equipment_class"] : []),
    ];
    for (const classType of classTypes) {
      addRelationship(context, "class_document", classType, classId, "document_type", documentId, {
        requirementId: informationRequirementId,
        requirementLevel: t(row, "requirementLevel"),
      }, profile.sheetNames.classDocument);
      if (informationRequirementId && informationIds.has(informationRequirementId)) {
        addRelationship(context, "information_requirement_class", "information_requirement", informationRequirementId, classType, classId, { requirementLevel: t(row, "requirementLevel") }, profile.sheetNames.classDocument);
      }
    }
    if (informationRequirementId && informationIds.has(informationRequirementId)) {
      addRelationship(context, "information_requirement_document", "information_requirement", informationRequirementId, "document_type", documentId, { requirementLevel: t(row, "requirementLevel") }, profile.sheetNames.classDocument);
      if (sourceStandardId && standardIds.has(sourceStandardId)) {
        addRelationship(context, "information_requirement_standard", "information_requirement", informationRequirementId, "source_standard", sourceStandardId, {}, profile.sheetNames.classDocument);
      }
    }
  });

  rows("classSourceStandard").forEach((row) => {
    const classId = t(row, "classId");
    const standardId = t(row, "sourceStandardId");
    if (!standardIds.has(standardId)) return;
    if (tagIds.has(classId)) {
      addRelationship(context, "entity_source_standard", "tag_class", classId, "source_standard", standardId, { mappingNote: t(row, "mappingNote") }, profile.sheetNames.classSourceStandard);
    }
    if (equipmentIds.has(classId)) {
      addRelationship(context, "entity_source_standard", "equipment_class", classId, "source_standard", standardId, { mappingNote: t(row, "mappingNote") }, profile.sheetNames.classSourceStandard);
    }
  });

  // RDL-032: project normalized measurement, controlled-value and source-mapping semantics
  // into static browser relationships without introducing synthetic controlled-list/search entities.
  propertyRows.forEach((row) => {
    const propertyId = t(row, "propertyId");
    if (!propertyIds.has(propertyId)) return;

    const unitReference = t(row, "propertyUnitId");
    const propertyDimensionReferences = [
      unitReference,
      first(row, ["unit of measure dimension code CFIHOS unique code", "unit of measure dimension code", "quantity kind", "unit class or picklist reference"]),
    ].filter(Boolean);
    const matchedUnitIds = new Set<string>();
    if (unitIds.has(unitReference)) matchedUnitIds.add(unitReference);
    for (const unitRow of unitRows) {
      const unitId = t(unitRow, "unitId");
      if (!unitIds.has(unitId)) continue;
      const unitDimensionReferences = [
        t(unitRow, "unitDimensionName"),
        first(unitRow, ["unit of measure dimension code CFIHOS unique code", "unit of measure dimension CFIHOS unique code", "unit of measure dimension code", "unit of measure dimension name", "quantity kind", "Unit Class ID"]),
      ].filter(Boolean);
      if (propertyDimensionReferences.some((left) => unitDimensionReferences.some((right) => same(left, right)))) matchedUnitIds.add(unitId);
    }
    for (const unitId of matchedUnitIds) {
      const unitRow = unitRows.find((candidate) => t(candidate, "unitId") === unitId);
      addRelationship(context, "property_unit", "property", propertyId, "unit_of_measure", unitId, {
        symbol: unitRow ? t(unitRow, "unitSymbol") : "",
        dimension: unitRow ? t(unitRow, "unitDimensionName") : unitReference,
      }, profile.sheetNames.property);
    }

    const controlledListReference = t(row, "propertyPicklistId");
    if (!controlledListReference) return;
    controlledRows.forEach((valueRow) => {
      const listId = t(valueRow, "picklistId");
      const listName = t(valueRow, "picklistName");
      if (!same(controlledListReference, listId) && !same(controlledListReference, listName)) return;
      const valueCode = t(valueRow, "picklistValueCode");
      const valueId = t(valueRow, "picklistValueId") || stableDerivedId(profile.sourceKey, "controlled-value", [listId, valueCode, t(valueRow, "picklistValueSequence")]);
      addRelationship(context, "property_controlled_value", "property", propertyId, "controlled_value", valueId, {
        controlledListId: listId,
        controlledListName: listName,
        sequence: t(valueRow, "picklistValueSequence"),
        sourceStandardId: t(valueRow, "sourceStandardId"),
        sourceStandardCode: t(valueRow, "sourceStandardCode"),
      }, profile.sheetNames.controlledValue);
    });
  });

  controlledRows.forEach((row) => {
    const listId = t(row, "picklistId");
    const valueCode = t(row, "picklistValueCode");
    const valueId = t(row, "picklistValueId") || stableDerivedId(profile.sourceKey, "controlled-value", [listId, valueCode, t(row, "picklistValueSequence")]);
    const standardId = t(row, "sourceStandardId");
    if (standardId && standardIds.has(standardId)) {
      addRelationship(context, "controlled_value_source_standard", "controlled_value", valueId, "source_standard", standardId, {
        controlledListId: listId,
        controlledListName: t(row, "picklistName"),
        sourceStandardCode: t(row, "sourceStandardCode"),
      }, profile.sheetNames.controlledValue);
    }
  });

  sourceMappingRows.forEach((row) => {
    const classId = t(row, "classId");
    const propertyId = t(row, "propertyId");
    const standardId = t(row, "sourceStandardId");
    if (!propertyIds.has(propertyId) || !standardIds.has(standardId)) return;
    const mappingId = t(row, "mappingId") || stableDerivedId(profile.sourceKey, "source-mapping", [classId, propertyId, standardId, t(row, "mappingNote")]);
    const attributes = {
      mappingId,
      classId,
      propertyId,
      sourceStandardId: standardId,
      sourceStandardCode: t(row, "sourceStandardCode"),
      sourceSection: first(row, ["source standard section"]),
      sourcePropertyName: first(row, ["property name in source standard", "source standard field"]),
      sequence: first(row, ["property sequence number"]),
      mappingNote: t(row, "mappingNote"),
    };
    addRelationship(context, "mapping_property_standard", "property", propertyId, "source_standard", standardId, attributes, profile.sheetNames.sourceMapping);
    if (tagIds.has(classId)) {
      addRelationship(context, "mapping_class_property", "tag_class", classId, "property", propertyId, attributes, profile.sheetNames.sourceMapping);
      addRelationship(context, "mapping_class_standard", "tag_class", classId, "source_standard", standardId, attributes, profile.sheetNames.sourceMapping);
    }
    if (equipmentIds.has(classId)) {
      addRelationship(context, "mapping_class_property", "equipment_class", classId, "property", propertyId, attributes, profile.sheetNames.sourceMapping);
      addRelationship(context, "mapping_class_standard", "equipment_class", classId, "source_standard", standardId, attributes, profile.sheetNames.sourceMapping);
    }
  });

  informationRows.forEach((row) => {
    const requirementId = t(row, "informationRequirementId");
    if (!informationIds.has(requirementId)) return;
    const classId = t(row, "informationRequirementClassId");
    const propertyId = t(row, "informationRequirementPropertyId");
    if (classId && tagIds.has(classId)) {
      addRelationship(context, "information_requirement_class", "information_requirement", requirementId, "tag_class", classId, informationAttributes(row), profile.sheetNames.informationRequirement);
    } else if (classId && equipmentIds.has(classId)) {
      addRelationship(context, "information_requirement_class", "information_requirement", requirementId, "equipment_class", classId, informationAttributes(row), profile.sheetNames.informationRequirement);
    }
    if (propertyId && propertyIds.has(propertyId)) {
      addRelationship(context, "information_requirement_property", "information_requirement", requirementId, "property", propertyId, informationAttributes(row), profile.sheetNames.informationRequirement);
    }
  });
}

function pick(row: Row, aliases: string[]): string {
  for (const alias of aliases) {
    const value = text(row[alias]);
    if (value) return value;
  }
  return "";
}

function addCfihos() {
  const snapshot = JSON.parse(readFileSync("public/cfihos-workbook.json", "utf8")) as {
    source: { sha256: string };
    sheets: Record<string, { rows: Row[] }>;
  };
  const packageKey = `cfihos-2.0-${String(snapshot.source.sha256).slice(0, 12)}`;
  const context = {
    sourceKey: "cfihos",
    sourceName: "CFIHOS",
    releaseKey: "cfihos-2.0",
    releaseStatus: "reviewed",
    versionLabel: "2.0",
    packageKey,
  };
  const rows = (sheet: string) => snapshot.sheets[sheet]?.rows ?? [];
  const tagRows = rows("tag class");
  const equipmentRows = rows("equipment class");
  const propertyRows = rows("property");
  const documentRows = rows("document type");
  const standardRows = rows("source standard");
  const informationRows = rows("Jip33 info required spec");
  const unitRows = rows("unit of measure");
  const controlledRows = rows("property picklist values");
  const sourceMappingRows = rows("tag equip class prop src std");
  const tagIds = new Set(tagRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const equipmentIds = new Set(equipmentRows.map((row) => pick(row, ["equipment class CFIHOS unique code"])).filter(Boolean));
  const propertyIds = new Set(propertyRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const documentIds = new Set(documentRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const standardIds = new Set(standardRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const informationIds = new Set(informationRows.map((row) => pick(row, ["Source standard document and data requirement CFIHOS unique code", "source standard document and data requirement CFIHOS unique code"])).filter(Boolean));
  const unitIds = new Set(unitRows.map((row) => pick(row, ["CFIHOS unique code", "unit of measure CFIHOS unique code"])).filter(Boolean));
  const cfihosInformationAttributes = (row: Row) => ({
    requirementNumber: pick(row, ["source standard document and data requirement number"]),
    requirementTitle: pick(row, ["source standard document and data requirement title"]),
    requirementGroup: pick(row, ["requirement group code", "requirement group"]),
    typicalDeliverable: pick(row, ["typical deliverable"]),
    submitAtProposal: pick(row, ["submit at proposal indicator", "submit at proposal"]),
    submitForReview: pick(row, ["submit for review indicator", "submit for review"]),
    submitAtDelivery: pick(row, ["submit at delivery indicator", "submit at delivery"]),
    requiredHandoverStatus: pick(row, ["required handover status code"]),
    requiredTranslation: pick(row, ["required translation indicator"]),
    deliverableFormat: pick(row, ["deliverable format code"]),
    sourceChapter: pick(row, ["engineering standard source chapter", "source chapter"]),
    reviewWeeks: pick(row, ["issue for review number of weeks"]),
    reviewReferenceDate: pick(row, ["issue for review reference date"]),
    approvalWeeks: pick(row, ["issue for approval number of weeks"]),
    approvalReferenceDate: pick(row, ["issue for approval reference date"]),
    informationWeeks: pick(row, ["for information number of weeks"]),
    informationReferenceDate: pick(row, ["for information reference date"]),
  });

  function hierarchy(data: Row[], type: string, idField: string, nameField: string, parentField: string, sheet: string) {
    const byName = new Map(data.map((row) => [text(row[nameField]).toLowerCase(), text(row[idField])]));
    data.forEach((row) => {
      const child = text(row[idField]);
      const parent = byName.get(text(row[parentField]).toLowerCase()) ?? "";
      if (parent) addRelationship(context, "entity_parent", type, child, type, parent, {}, sheet);
    });
  }

  hierarchy(tagRows, "tag_class", "CFIHOS unique code", "tag class name", "parent tag class name", "tag class");
  hierarchy(equipmentRows, "equipment_class", "equipment class CFIHOS unique code", "equipment class name", "parent equipment class name", "equipment class");

  rows("tag class property").forEach((row) => {
    const classId = pick(row, ["tag class CFIHOS unique code"]);
    const propertyId = pick(row, ["property CFIHOS unique code"]);
    if (tagIds.has(classId) && propertyIds.has(propertyId)) {
      addRelationship(context, "class_property", "tag_class", classId, "property", propertyId, {
        siUnitId: row["SI unit of measure CFIHOS unique code"],
        siUnitName: row["SI unit of measure name"],
        imperialUnitId: row["imperial unit of measure CFIHOS unique code"],
        imperialUnitName: row["imperial unit of measure name"],
      }, "tag class property");
      for (const [unitId, system] of [[pick(row, ["SI unit of measure CFIHOS unique code"]), "SI"], [pick(row, ["imperial unit of measure CFIHOS unique code"]), "Imperial"]] as const) {
        if (unitIds.has(unitId)) addRelationship(context, "property_unit", "property", propertyId, "unit_of_measure", unitId, { system }, "tag class property");
      }
    }
  });

  rows("equipment class property").forEach((row) => {
    const classId = pick(row, ["equipment class CFIHOS unique code"]);
    const propertyId = pick(row, ["property CFIHOS unique code"]);
    if (equipmentIds.has(classId) && propertyIds.has(propertyId)) {
      addRelationship(context, "class_property", "equipment_class", classId, "property", propertyId, {
        equipmentRelevant: row["property relevant for equipment indicator"],
        modelPartRelevant: row["property relevant for model / part indicator"],
        siUnitId: row["SI unit of measure CFIHOS unique code"],
        siUnitName: row["SI unit of measure name"],
      }, "equipment class property");
      for (const [unitId, system] of [[pick(row, ["SI unit of measure CFIHOS unique code"]), "SI"], [pick(row, ["imperial unit of measure CFIHOS unique code"]), "Imperial"]] as const) {
        if (unitIds.has(unitId)) addRelationship(context, "property_unit", "property", propertyId, "unit_of_measure", unitId, { system }, "equipment class property");
      }
    }
  });

  const disciplineIdsByCode = new Map(rows("discipline").map((row) => [text(row["discipline code"]).toLowerCase(), text(row["CFIHOS unique code"])]));
  rows("discipline document type").forEach((row) => {
    const documentId = pick(row, ["document type CFIHOS unique code", "CFIHOS unique code"]);
    const disciplineId = disciplineIdsByCode.get(pick(row, ["discipline code"]).toLowerCase()) ?? "";
    if (documentIds.has(documentId) && disciplineId) {
      addRelationship(context, "document_discipline", "document_type", documentId, "discipline", disciplineId, {
        relationshipId: pick(row, ["discipline document type CFIHOS unique code"]),
        requirementLevel: pick(row, ["required status code", "requirement level"]),
        contextCode: pick(row, ["discipline document type short code"]),
        assetType: pick(row, ["asset type reference"]),
        representationType: pick(row, ["representation type"]),
        nativeFileDeliveryTiming: pick(row, ["native file delivery timing"]),
        nativeDocumentFormat: pick(row, ["native document format"]),
        authenticatedRecordFormat: pick(row, ["authenticated record format"]),
        detailedEngineeringStatus: pick(row, ["required document status for detailed engineering"]),
        constructionStatus: pick(row, ["required document status for construction"]),
        commissioningStatus: pick(row, ["required document status for commissioning"]),
        startupStatus: pick(row, ["required document status for startup"]),
        operationsStatus: pick(row, ["required document status for operations"]),
        reviewType: pick(row, ["review type"]),
        comment: pick(row, ["discipline document type comment"]),
      }, "discipline document type");
    }
  });

  rows("tag equipment class relationshi").forEach((row) => {
    const tagId = pick(row, ["tag class CFIHOS unique code"]);
    const equipmentId = pick(row, ["equipment class CFIHOS unique code"]);
    if (tagIds.has(tagId) && equipmentIds.has(equipmentId)) {
      addRelationship(context, "tag_equipment_mapping", "tag_class", tagId, "equipment_class", equipmentId, {
        reason: row["tag or equipment class relationship reason for mapping"],
      }, "tag equipment class relationshi");
    }
  });

  rows("document required per class").forEach((row) => {
    const classId = pick(row, ["tag or equipment class CFIHOS unique code"]);
    const documentId = pick(row, ["document type CFIHOS unique code"]);
    const requirementId = pick(row, ["source standard document and data requirement CFIHOS unique code"]);
    const standardId = pick(row, ["source standard CFIHOS unique code"]);
    const assetType = pick(row, ["asset type reference"]).toLowerCase();
    if (!documentIds.has(documentId)) return;
    const classTypes = assetType === "tag"
      ? (tagIds.has(classId) ? ["tag_class"] : [])
      : assetType === "equipment"
        ? (equipmentIds.has(classId) ? ["equipment_class"] : [])
        : [
            ...(tagIds.has(classId) ? ["tag_class"] : []),
            ...(equipmentIds.has(classId) ? ["equipment_class"] : []),
          ];
    for (const classType of classTypes) {
      addRelationship(context, "class_document", classType, classId, "document_type", documentId, {
        requirementId,
        sourceStandardId: standardId,
        sourceStandardCode: row["source standard code"],
        assetType: row["asset type reference"],
      }, "document required per class");
      if (requirementId && informationIds.has(requirementId)) {
        addRelationship(context, "information_requirement_class", "information_requirement", requirementId, classType, classId, {}, "document required per class");
      }
    }
    if (requirementId && informationIds.has(requirementId)) {
      addRelationship(context, "information_requirement_document", "information_requirement", requirementId, "document_type", documentId, {}, "document required per class");
      if (standardId && standardIds.has(standardId)) {
        addRelationship(context, "information_requirement_standard", "information_requirement", requirementId, "source_standard", standardId, {}, "document required per class");
      }
    }
  });

  rows("tag or equip class src standard").forEach((row) => {
    const classId = pick(row, ["tag or equipment class CFIHOS unique code"]);
    const standardId = pick(row, ["source standard CFIHOS unique code"]);
    if (!standardIds.has(standardId)) return;
    if (tagIds.has(classId)) addRelationship(context, "entity_source_standard", "tag_class", classId, "source_standard", standardId, {}, "tag or equip class src standard");
    if (equipmentIds.has(classId)) addRelationship(context, "entity_source_standard", "equipment_class", classId, "source_standard", standardId, {}, "tag or equip class src standard");
  });

  // RDL-032 CFIHOS parity projection. All joins use explicit workbook identifiers/dimension codes.
  propertyRows.forEach((row) => {
    const propertyId = pick(row, ["CFIHOS unique code"]);
    if (!propertyIds.has(propertyId)) return;
    const dimensionReferences = [
      pick(row, ["unit of measure dimension code CFIHOS unique code"]),
      pick(row, ["unit of measure dimension code"]),
    ].filter(Boolean);
    for (const unitRow of unitRows) {
      const unitId = pick(unitRow, ["CFIHOS unique code", "unit of measure CFIHOS unique code"]);
      if (!unitIds.has(unitId)) continue;
      const unitDimensionReferences = [
        pick(unitRow, ["unit of measure dimension code CFIHOS unique code", "unit of measure dimension CFIHOS unique code"]),
        pick(unitRow, ["unit of measure dimension code"]),
        pick(unitRow, ["unit of measure dimension name"]),
      ].filter(Boolean);
      if (dimensionReferences.some((left) => unitDimensionReferences.some((right) => same(left, right)))) {
        addRelationship(context, "property_unit", "property", propertyId, "unit_of_measure", unitId, {
          symbol: pick(unitRow, ["unit of measure symbol"]),
          dimension: pick(unitRow, ["unit of measure dimension name", "unit of measure dimension code"]),
        }, "property");
      }
    }

    const picklistId = pick(row, ["property picklist name CFIHOS unique code"]);
    if (!picklistId) return;
    controlledRows.forEach((valueRow) => {
      const listId = pick(valueRow, ["property picklist CFIHOS unique code"]);
      if (!same(picklistId, listId)) return;
      const valueId = pick(valueRow, ["property picklist value CFIHOS unique code"]);
      if (!valueId) return;
      addRelationship(context, "property_controlled_value", "property", propertyId, "controlled_value", valueId, {
        controlledListId: listId,
        controlledListName: pick(valueRow, ["property picklist name"]),
        sequence: pick(valueRow, ["property picklist value sequence number", "property picklist value sequence"]),
        sourceStandardId: pick(valueRow, ["Source standard CFIHOS unique code", "source standard CFIHOS unique code"]),
        sourceStandardCode: pick(valueRow, ["source standard code"]),
      }, "property picklist values");
    });
  });

  controlledRows.forEach((row) => {
    const valueId = pick(row, ["property picklist value CFIHOS unique code"]);
    const standardId = pick(row, ["Source standard CFIHOS unique code", "source standard CFIHOS unique code"]);
    if (valueId && standardId && standardIds.has(standardId)) {
      addRelationship(context, "controlled_value_source_standard", "controlled_value", valueId, "source_standard", standardId, {
        controlledListId: pick(row, ["property picklist CFIHOS unique code"]),
        controlledListName: pick(row, ["property picklist name"]),
        sourceStandardCode: pick(row, ["source standard code"]),
      }, "property picklist values");
    }
  });

  sourceMappingRows.forEach((row) => {
    const classId = pick(row, ["tag or equipment class CFIHOS unique code"]);
    const propertyId = pick(row, ["property CFIHOS unique code"]);
    const standardId = pick(row, ["source standard code CFIHOS unique code", "source standard CFIHOS unique code"]);
    if (!propertyIds.has(propertyId) || !standardIds.has(standardId)) return;
    const mappingId = pick(row, ["CFIHOS unique code", "tag or equipment class property source standard CFIHOS unique code"]);
    const attributes = {
      mappingId,
      classId,
      className: pick(row, ["tag or equipment class name"]),
      propertyId,
      propertyName: pick(row, ["property name"]),
      sourceStandardId: standardId,
      sourceStandardCode: pick(row, ["source standard code"]),
      sourceSection: pick(row, ["source standard section"]),
      sourcePropertyName: pick(row, ["property name in source standard"]),
      sequence: pick(row, ["property sequence number"]),
    };
    addRelationship(context, "mapping_property_standard", "property", propertyId, "source_standard", standardId, attributes, "tag equip class prop src std");
    if (tagIds.has(classId)) {
      addRelationship(context, "mapping_class_property", "tag_class", classId, "property", propertyId, attributes, "tag equip class prop src std");
      addRelationship(context, "mapping_class_standard", "tag_class", classId, "source_standard", standardId, attributes, "tag equip class prop src std");
    }
    if (equipmentIds.has(classId)) {
      addRelationship(context, "mapping_class_property", "equipment_class", classId, "property", propertyId, attributes, "tag equip class prop src std");
      addRelationship(context, "mapping_class_standard", "equipment_class", classId, "source_standard", standardId, attributes, "tag equip class prop src std");
    }
  });

  informationRows.forEach((row) => {
    const requirementId = pick(row, ["Source standard document and data requirement CFIHOS unique code", "source standard document and data requirement CFIHOS unique code"]);
    if (!informationIds.has(requirementId)) return;
    const tagId = pick(row, ["tag class CFIHOS unique code"]);
    const propertyId = pick(row, ["property CFIHOS unique code"]);
    const documentId = pick(row, ["document type CFIHOS unique code"]);
    const standardId = pick(row, ["source standard CFIHOS unique code"]);
    const attributes = cfihosInformationAttributes(row);
    if (tagIds.has(tagId)) addRelationship(context, "information_requirement_class", "information_requirement", requirementId, "tag_class", tagId, attributes, "Jip33 info required spec");
    if (propertyIds.has(propertyId)) addRelationship(context, "information_requirement_property", "information_requirement", requirementId, "property", propertyId, attributes, "Jip33 info required spec");
    if (documentIds.has(documentId)) addRelationship(context, "information_requirement_document", "information_requirement", requirementId, "document_type", documentId, attributes, "Jip33 info required spec");
    if (standardIds.has(standardId)) addRelationship(context, "information_requirement_standard", "information_requirement", requirementId, "source_standard", standardId, attributes, "Jip33 info required spec");
  });
}

addCfihos();
await addProfile(CCUS_CFIHOS_FORMAT_PROFILE);
await addProfile(CCUS_V2_CFIHOS_FORMAT_PROFILE);
await addProfile(WATER_DESALINATION_PROFILE);
await addProfile(WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE);

const records = [...output.values()].sort((a, b) =>
  a.sourceKey.localeCompare(b.sourceKey)
  || a.releaseKey.localeCompare(b.releaseKey)
  || a.relationshipType.localeCompare(b.relationshipType)
  || a.sourceEntityType.localeCompare(b.sourceEntityType)
  || a.sourceNativeIdentifier.localeCompare(b.sourceNativeIdentifier)
  || a.targetEntityType.localeCompare(b.targetEntityType)
  || a.targetNativeIdentifier.localeCompare(b.targetNativeIdentifier),
);

type SearchIdentity = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
};
const searchRecords = JSON.parse(readFileSync("public/rdl-search-index.json", "utf8")) as SearchIdentity[];
const entityKeys = new Set(searchRecords.map((record) => [
  record.sourceKey,
  record.releaseKey,
  record.packageKey,
  record.entityType,
  record.nativeIdentifier,
].join("|")));
for (const relationship of records) {
  const prefix = [relationship.sourceKey, relationship.releaseKey, relationship.packageKey];
  const sourceKey = [...prefix, relationship.sourceEntityType, relationship.sourceNativeIdentifier].join("|");
  const targetKey = [...prefix, relationship.targetEntityType, relationship.targetNativeIdentifier].join("|");
  if (!entityKeys.has(sourceKey) || !entityKeys.has(targetKey)) {
    throw new Error(`Relationship endpoint is not present in the exact release package: ${relationship.relationshipType} ${relationship.sourceEntityType}:${relationship.sourceNativeIdentifier} -> ${relationship.targetEntityType}:${relationship.targetNativeIdentifier}`);
  }
}

writeFileSync("public/rdl-relationship-index.json", JSON.stringify(records));
console.log(`Generated ${records.length} release-aware RDL relationship records with exact endpoint integrity.`);
