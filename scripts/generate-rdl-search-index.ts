import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readWorkbook, worksheetRows } from "./rdl-ingestion/workbookReader.ts";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusCfihosFormatProfile.ts";
import { CCUS_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusV2CfihosFormatProfile.ts";
import { WATER_DESALINATION_PROFILE } from "./rdl-ingestion/WaterDesalinationProfile.ts";
import { WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/WaterDesalinationV2CfihosFormatProfile.ts";
import type { RdlWorkbookMappingProfile } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";
import { mappedText } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";

type FacetValue = { value: string; label?: string };
type BrowseMetadata = {
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: string[];
  facets?: Record<string, FacetValue>;
};
type RecordOut = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  sourceSheet: string;
} & BrowseMetadata;
type Row = Record<string, unknown>;

const output = new Map<string, RecordOut>();
const entitySpecs = [
  ["tagClass", "tag_class", "tagClassId", "tagClassName", "tagClassDefinition"],
  ["equipmentClass", "equipment_class", "equipmentClassId", "equipmentClassName", "equipmentClassDefinition"],
  ["property", "property", "propertyId", "propertyName", "propertyDefinition"],
  ["documentType", "document_type", "documentId", "documentName", "documentDefinition"],
  ["discipline", "discipline", "disciplineId", "disciplineName", "disciplineDescription"],
  ["unit", "unit_of_measure", "unitId", "unitName", "unitDescription"],
  ["sourceStandard", "source_standard", "sourceStandardId", "sourceStandardName", "sourceStandardDescription"],
  ["handoverEvent", "handover_event", "handoverId", "handoverName", "handoverDescription"],
  ["informationRequirement", "information_requirement", "informationRequirementId", "informationRequirementTitle", "informationRequirementDescription"],
] as const;

function stable(source: string, kind: string, parts: string[]) {
  const seed = parts.map((value) => value.trim().toLowerCase()).join("|");
  return `${source}:${kind}:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function rowText(row: Row, candidates: string[]): string {
  for (const candidate of candidates) {
    const direct = text(row[candidate]);
    if (direct) return direct;
  }
  const keys = new Map(Object.keys(row).map((key) => [normalizedKey(key), key]));
  for (const candidate of candidates) {
    const actual = keys.get(normalizedKey(candidate));
    if (!actual) continue;
    const value = text(row[actual]);
    if (value) return value;
  }
  return "";
}

function rowTextContaining(row: Row, requiredTokens: string[]): string {
  const tokens = requiredTokens.map((token) => normalizedKey(token));
  for (const [key, rawValue] of Object.entries(row)) {
    const normalized = normalizedKey(key);
    if (!tokens.every((token) => normalized.includes(token))) continue;
    const value = text(rawValue);
    if (value) return value;
  }
  return "";
}

function truthy(value: string): boolean {
  return ["yes", "y", "true", "1"].includes(value.trim().toLocaleLowerCase());
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))];
}

function aliases(value: string): string[] {
  if (!value) return [];
  return unique(value.split(/[;|\n]+/));
}

function compactMetadata(metadata: BrowseMetadata): BrowseMetadata {
  const result: BrowseMetadata = {};
  const aliasValues = unique(metadata.aliases ?? []);
  const searchValues = unique(metadata.searchText ?? []);
  const badges = unique(metadata.badges ?? []);
  if (aliasValues.length) result.aliases = aliasValues;
  if (searchValues.length) result.searchText = searchValues;
  if (metadata.secondaryLabel?.trim()) result.secondaryLabel = metadata.secondaryLabel.trim();
  if (metadata.tertiaryLabel?.trim()) result.tertiaryLabel = metadata.tertiaryLabel.trim();
  if (badges.length) result.badges = badges;
  const facets = Object.fromEntries(
    Object.entries(metadata.facets ?? {}).filter(([, facet]) => facet.value.trim()),
  );
  if (Object.keys(facets).length) result.facets = facets;
  return result;
}

function add(
  sourceKey: string,
  sourceName: string,
  releaseKey: string,
  releaseStatus: string,
  versionLabel: string,
  packageKey: string,
  entityType: string,
  nativeIdentifier: string,
  name: string,
  definition: string,
  sourceSheet: string,
  metadata: BrowseMetadata = {},
) {
  if (!nativeIdentifier) return;
  const record: RecordOut = {
    sourceKey,
    sourceName,
    releaseKey,
    releaseStatus,
    versionLabel,
    packageKey,
    entityType,
    nativeIdentifier,
    name: name || nativeIdentifier,
    definition,
    sourceSheet,
    ...compactMetadata(metadata),
  };
  output.set(`${packageKey}:${entityType}:${nativeIdentifier}`, record);
}

function genericBrowseMetadata(entityType: string, row: Row, get: (field: string) => string): BrowseMetadata {
  switch (entityType) {
    case "tag_class": {
      const parent = get("tagParentName") || get("tagParentId") || rowText(row, ["parent tag class name", "parent class code"]);
      const synonym = rowText(row, ["tag class synonym", "tag class synonym name", "synonym"]);
      const existenceReason = rowText(row, ["tag class existence reason", "existence reason"]) || rowTextContaining(row, ["existence", "reason"]);
      return {
        aliases: aliases(synonym),
        searchText: unique([parent, existenceReason]),
        secondaryLabel: parent ? `Parent: ${parent}` : undefined,
        badges: truthy(rowText(row, ["abstract class indicator", "abstract"])) ? ["Abstract"] : [],
      };
    }
    case "equipment_class": {
      const parent = get("equipmentParentName") || get("equipmentParentId") || rowText(row, ["parent equipment class name", "parent class code"]);
      const synonym = rowText(row, ["equipment class synonym name", "equipment class synonym", "synonym"]);
      const existenceReason = rowText(row, ["equipment class existence reason", "existence reason"]) || rowTextContaining(row, ["existence", "reason"]);
      return {
        aliases: aliases(synonym),
        searchText: unique([parent, existenceReason]),
        secondaryLabel: parent ? `Parent: ${parent}` : undefined,
        badges: truthy(rowText(row, ["abstract class indicator", "abstract"])) ? ["Abstract"] : [],
      };
    }
    case "document_type": {
      const shortCode = get("documentShortCode") || rowText(row, ["document type short code", "short code"]);
      const classification = get("documentClassification") || rowText(row, ["document type classification", "classification", "definition file"]);
      const synonym = rowText(row, ["document type synonym name", "document type synonym", "synonym"]);
      return {
        aliases: aliases(synonym),
        searchText: unique([shortCode, classification]),
        secondaryLabel: shortCode || undefined,
        tertiaryLabel: classification || undefined,
      };
    }
    case "property": {
      const dataType = get("propertyDataType") || rowText(row, ["property data type", "data type"]);
      const dimension = rowText(row, ["unit of measure dimension code", "unit of measure dimension name", "quantity kind"]);
      const picklist = rowText(row, ["property picklist name", "picklist name"]) || get("propertyPicklistId");
      const unit = get("propertyUnitId");
      const existenceReason = rowText(row, ["property existence reason", "existence reason"]) || rowTextContaining(row, ["existence", "reason"]);
      const synonym = rowText(row, ["property synonym name", "property synonym", "synonym"]);
      return {
        aliases: aliases(synonym),
        searchText: unique([dataType, dimension, picklist, unit, existenceReason]),
        secondaryLabel: dataType || undefined,
        tertiaryLabel: picklist || dimension || unit || undefined,
      };
    }
    case "discipline": {
      const code = get("disciplineCode") || rowText(row, ["discipline code"]);
      return {
        searchText: unique([code]),
        secondaryLabel: code || undefined,
      };
    }
    case "unit_of_measure": {
      const symbol = get("unitSymbol") || rowText(row, ["unit of measure symbol", "symbol"]);
      const unece = rowText(row, ["UNECE code", "UNECE common code", "unece code"]);
      const dimensionId = rowText(row, ["unit of measure dimension code CFIHOS unique code", "dimension id", "quantity kind id"]);
      const dimensionCode = rowText(row, ["unit of measure dimension code", "dimension code"]);
      const dimensionName = get("unitDimensionName") || rowText(row, ["unit of measure dimension name", "dimension name", "quantity kind"]);
      const systemId = rowText(row, ["measurement system code CFIHOS unique code", "measurement system id"]);
      const systemCode = rowText(row, ["measurement system code"]);
      const systemName = rowText(row, ["measurement system name"]);
      const synonym = rowText(row, ["unit of measure synonym name", "unit of measure synonym", "synonym"]);
      const dimensionValue = dimensionId || dimensionCode || dimensionName;
      const dimensionLabel = dimensionName || dimensionCode || dimensionId;
      return {
        aliases: aliases(synonym),
        searchText: unique([symbol, unece, dimensionId, dimensionCode, dimensionName, systemId, systemCode, systemName]),
        secondaryLabel: unique([symbol, unece]).join(" · ") || undefined,
        tertiaryLabel: dimensionLabel || undefined,
        facets: dimensionValue ? { dimension: { value: dimensionValue, label: dimensionLabel } } : undefined,
      };
    }
    case "source_standard":
      return {};
    default:
      return {};
  }
}

async function addProfile(profile: RdlWorkbookMappingProfile) {
  const projectedStatus = profile.releaseKey.endsWith("0.1-draft") ? "superseded" : profile.releaseStatus;
  const bytes = readFileSync(profile.workbookPath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const packageKey = `${profile.sourceKey}-${profile.versionLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${sha.slice(0, 12)}`;
  const workbook = await readWorkbook(bytes);
  const rows = (key: string): Row[] => {
    const sheetName = profile.sheetNames[key];
    if (!sheetName) return [];
    const sheet = workbook.sheets[sheetName];
    return sheet ? worksheetRows<Row>(sheet) : [];
  };
  const mapped = (row: Row, field: string) => mappedText(row, profile.fields[field] ?? [field]);

  for (const [sheetKey, entityType, idField, nameField, definitionField] of entitySpecs) {
    for (const row of rows(sheetKey)) {
      add(
        profile.sourceKey,
        profile.sourceName,
        profile.releaseKey,
        projectedStatus,
        profile.versionLabel,
        packageKey,
        entityType,
        mapped(row, idField),
        mapped(row, nameField),
        mapped(row, definitionField),
        profile.sheetNames[sheetKey],
        genericBrowseMetadata(entityType, row, (field) => mapped(row, field)),
      );
    }
  }

  for (const row of rows("controlledValue")) {
    const list = mapped(row, "picklistId");
    const value = mapped(row, "picklistValueCode");
    const sequence = mapped(row, "picklistValueSequence");
    const id = mapped(row, "picklistValueId") || stable(profile.sourceKey, "controlled-value", [list, value, sequence]);
    add(
      profile.sourceKey,
      profile.sourceName,
      profile.releaseKey,
      projectedStatus,
      profile.versionLabel,
      packageKey,
      "controlled_value",
      id,
      value || id,
      mapped(row, "picklistValueDescription"),
      profile.sheetNames.controlledValue,
    );
  }
}

const snapshot = JSON.parse(readFileSync("public/cfihos-workbook.json", "utf8")) as {
  source: { sha256: string };
  sheets: Record<string, { rows: Row[] }>;
};
const cfihosSha = String(snapshot.source.sha256);
const cfihosPackageKey = `cfihos-2.0-${cfihosSha.slice(0, 12)}`;
const cfihosSpecs = [
  ["tag class", "tag_class", "CFIHOS unique code", "tag class name", "tag class definition"],
  ["equipment class", "equipment_class", "equipment class CFIHOS unique code", "equipment class name", "equipment class definition"],
  ["property", "property", "CFIHOS unique code", "property name", "property definition"],
  ["document type", "document_type", "CFIHOS unique code", "document type name", "document type description"],
  ["discipline", "discipline", "CFIHOS unique code", "discipline name", "discipline description"],
  ["unit of measure", "unit_of_measure", "CFIHOS unique code", "unit of measure name", "unit of measure description"],
  ["source standard", "source_standard", "CFIHOS unique code", "source standard code", "source standard description"],
  ["handover event", "handover_event", "CFIHOS unique code", "handover event name", "handover event description"],
  ["property picklist values", "controlled_value", "property picklist value CFIHOS unique code", "property picklist value code", "property picklist value description"],
  ["Jip33 info required spec", "information_requirement", "Source standard document and data requirement CFIHOS unique code", "source standard document and data requirement title", "source standard document and data requirement description"],
] as const;

function cfihosSemantic(row: Row, field: string): string {
  const fields: Record<string, string[]> = {
    tagParentName: ["parent tag class name"],
    equipmentParentName: ["parent equipment class name"],
    propertyDataType: ["property data type"],
    propertyPicklistId: ["property picklist name CFIHOS unique code"],
    documentShortCode: ["document type short code"],
    documentClassification: ["document type classification"],
    disciplineCode: ["discipline code"],
    unitSymbol: ["unit of measure symbol"],
    unitDimensionName: ["unit of measure dimension name"],
  };
  return rowText(row, fields[field] ?? [field]);
}

for (const [sheet, entityType, idField, nameField, definitionField] of cfihosSpecs) {
  for (const row of snapshot.sheets[sheet]?.rows ?? []) {
    add(
      "cfihos",
      "CFIHOS",
      "cfihos-2.0",
      "reviewed",
      "2.0",
      cfihosPackageKey,
      entityType,
      text(row[idField]),
      text(row[nameField]),
      text(row[definitionField]),
      sheet,
      genericBrowseMetadata(entityType, row, (field) => cfihosSemantic(row, field)),
    );
  }
}

await addProfile(CCUS_CFIHOS_FORMAT_PROFILE);
await addProfile(CCUS_V2_CFIHOS_FORMAT_PROFILE);
await addProfile(WATER_DESALINATION_PROFILE);
await addProfile(WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE);

const records = [...output.values()].sort(
  (a, b) =>
    a.sourceKey.localeCompare(b.sourceKey) ||
    a.releaseKey.localeCompare(b.releaseKey) ||
    a.entityType.localeCompare(b.entityType) ||
    a.nativeIdentifier.localeCompare(b.nativeIdentifier),
);
writeFileSync("public/rdl-search-index.json", JSON.stringify(records));
console.log(`Generated ${records.length} release-aware RDL search records with normalized browse metadata.`);
