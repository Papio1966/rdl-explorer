import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
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
  ].join("|");
  output.set(key, record);
}

function addProfile(profile: RdlWorkbookMappingProfile) {
  const bytes = readFileSync(profile.workbookPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const workbook = XLSX.read(bytes, { type: "buffer" });
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
    const sheet = workbook.Sheets[sheetName];
    return sheet ? XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: false }) : [];
  };
  const t = (row: Row, field: string) => mappedText(row, profile.fields[field] ?? [field]);

  const tagRows = rows("tagClass");
  const equipmentRows = rows("equipmentClass");
  const propertyRows = rows("property");
  const documentRows = rows("documentType");
  const standardRows = rows("sourceStandard");
  const informationRows = rows("informationRequirement");
  const tagIds = new Set(tagRows.map((row) => t(row, "tagClassId")).filter(Boolean));
  const equipmentIds = new Set(equipmentRows.map((row) => t(row, "equipmentClassId")).filter(Boolean));
  const propertyIds = new Set(propertyRows.map((row) => t(row, "propertyId")).filter(Boolean));
  const documentIds = new Set(documentRows.map((row) => t(row, "documentId")).filter(Boolean));
  const standardIds = new Set(standardRows.map((row) => t(row, "sourceStandardId")).filter(Boolean));
  const informationIds = new Set(informationRows.map((row) => t(row, "informationRequirementId")).filter(Boolean));

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
        addRelationship(context, "information_requirement_class", "information_requirement", informationRequirementId, classType, classId, {}, profile.sheetNames.classDocument);
      }
    }
    if (informationRequirementId && informationIds.has(informationRequirementId)) {
      addRelationship(context, "information_requirement_document", "information_requirement", informationRequirementId, "document_type", documentId, {}, profile.sheetNames.classDocument);
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

  informationRows.forEach((row) => {
    const requirementId = t(row, "informationRequirementId");
    if (!informationIds.has(requirementId)) return;
    const classId = t(row, "informationRequirementClassId");
    const propertyId = t(row, "informationRequirementPropertyId");
    if (classId && tagIds.has(classId)) {
      addRelationship(context, "information_requirement_class", "information_requirement", requirementId, "tag_class", classId, { requirementLevel: t(row, "informationRequirementLevel") }, profile.sheetNames.informationRequirement);
    } else if (classId && equipmentIds.has(classId)) {
      addRelationship(context, "information_requirement_class", "information_requirement", requirementId, "equipment_class", classId, { requirementLevel: t(row, "informationRequirementLevel") }, profile.sheetNames.informationRequirement);
    }
    if (propertyId && propertyIds.has(propertyId)) {
      addRelationship(context, "information_requirement_property", "information_requirement", requirementId, "property", propertyId, { requirementLevel: t(row, "informationRequirementLevel") }, profile.sheetNames.informationRequirement);
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
  const tagIds = new Set(tagRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const equipmentIds = new Set(equipmentRows.map((row) => pick(row, ["equipment class CFIHOS unique code"])).filter(Boolean));
  const propertyIds = new Set(propertyRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const documentIds = new Set(documentRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const standardIds = new Set(standardRows.map((row) => pick(row, ["CFIHOS unique code"])).filter(Boolean));
  const informationIds = new Set(informationRows.map((row) => pick(row, ["Source standard document and data requirement CFIHOS unique code", "source standard document and data requirement CFIHOS unique code"])).filter(Boolean));

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
    }
  });

  const disciplineIdsByCode = new Map(rows("discipline").map((row) => [text(row["discipline code"]).toLowerCase(), text(row["CFIHOS unique code"])]));
  rows("discipline document type").forEach((row) => {
    const documentId = pick(row, ["document type CFIHOS unique code", "CFIHOS unique code"]);
    const disciplineId = disciplineIdsByCode.get(pick(row, ["discipline code"]).toLowerCase()) ?? "";
    if (documentIds.has(documentId) && disciplineId) {
      addRelationship(context, "document_discipline", "document_type", documentId, "discipline", disciplineId, {
        requirementLevel: pick(row, ["required status code", "requirement level"]),
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

  informationRows.forEach((row) => {
    const requirementId = pick(row, ["Source standard document and data requirement CFIHOS unique code", "source standard document and data requirement CFIHOS unique code"]);
    if (!informationIds.has(requirementId)) return;
    const tagId = pick(row, ["tag class CFIHOS unique code"]);
    const propertyId = pick(row, ["property CFIHOS unique code"]);
    const documentId = pick(row, ["document type CFIHOS unique code"]);
    const standardId = pick(row, ["source standard CFIHOS unique code"]);
    if (tagIds.has(tagId)) addRelationship(context, "information_requirement_class", "information_requirement", requirementId, "tag_class", tagId, {}, "Jip33 info required spec");
    if (propertyIds.has(propertyId)) addRelationship(context, "information_requirement_property", "information_requirement", requirementId, "property", propertyId, {}, "Jip33 info required spec");
    if (documentIds.has(documentId)) addRelationship(context, "information_requirement_document", "information_requirement", requirementId, "document_type", documentId, {}, "Jip33 info required spec");
    if (standardIds.has(standardId)) addRelationship(context, "information_requirement_standard", "information_requirement", requirementId, "source_standard", standardId, {}, "Jip33 info required spec");
  });
}

addCfihos();
addProfile(CCUS_CFIHOS_FORMAT_PROFILE);
addProfile(CCUS_V2_CFIHOS_FORMAT_PROFILE);
addProfile(WATER_DESALINATION_PROFILE);
addProfile(WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE);

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
