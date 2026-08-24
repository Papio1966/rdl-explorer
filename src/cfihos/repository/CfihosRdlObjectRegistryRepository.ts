import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosCodingSourceDiagnostic,
  CfihosObjectEquivalentMapping,
  CfihosRdlMasterObject,
  CfihosRdlObjectFamilyDiagnostic,
  CfihosRdlObjectRegistryDiagnostics,
} from "../model/rdlObjectRegistry";

const MASTER_SHEET = "RDL master object";
const EQUIVALENCE_SHEET = "CFIHOS object equivalent mappin";

// Families already represented by a production browser/domain, or by a
// validated supporting relationship. Everything else deliberately remains
// "unclassified" until the audit tells us what it is.
const IMPLEMENTED_FAMILIES = new Set([
  "tag class",
  "equipment class",
  "property",
  "property picklist values",
  "document type",
  "discipline",
  "source standard",
  "unit of measure",
  "handover event",
]);

const SUPPORTING_FAMILIES = new Set([
  "tag class property",
  "equipment class property",
  "tag equipment class relationship",
  "document required per class",
  "property groupings",
  "discipline document type",
  "jip33 info required spec",
  "tag or equipment class",
  "entity",
  "entity attribute",
  "submission reference date",
  "property picklist",
  "property picklist value",
  "property group",
  "property group allowed for purpose",
  "property grouping or decomposition purpose",
  "source standard document and data requirement",
  "source standard document and data requirement condition",
  "application condition",
  "application condition group",
  "unit of measure dimension",
]);

type State = {
  objects: CfihosRdlMasterObject[];
  mappings: CfihosObjectEquivalentMapping[];
  diagnostics: CfihosRdlObjectRegistryDiagnostics;
};

export class CfihosRdlObjectRegistryRepository {
  private state: State | null = null;
  private loadingPromise: Promise<State> | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getMasterObjects(): Promise<CfihosRdlMasterObject[]> {
    return (await this.getState()).objects;
  }

  async getEquivalentMappings(): Promise<CfihosObjectEquivalentMapping[]> {
    return (await this.getState()).mappings;
  }

  async getDiagnostics(): Promise<CfihosRdlObjectRegistryDiagnostics> {
    return (await this.getState()).diagnostics;
  }

  private async getState(): Promise<State> {
    if (this.state) return this.state;
    if (!this.loadingPromise) this.loadingPromise = this.loadState();
    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadState(): Promise<State> {
    const [masterRows, mappingRows] = await Promise.all([
      getCfihosWorksheetRows(MASTER_SHEET),
      getCfihosWorksheetRows(EQUIVALENCE_SHEET),
    ]);

    const objects = masterRows.map(buildMasterObject);
    const mappings = mappingRows.map(buildEquivalentMapping).filter(
      (item): item is CfihosObjectEquivalentMapping => item !== null,
    );

    const objectIds = objects.map((item) => normalizeKey(item.id));
    const objectNames = objects
      .map((item) => normalizeKey(item.name))
      .filter(Boolean);
    const masterIdSet = new Set(objectIds.filter(Boolean));

    const familyMap = new Map<string, number>();
    for (const item of objects) {
      const family = normalizeFamily(item.definitionFile);
      if (!family) continue;
      familyMap.set(family, (familyMap.get(family) ?? 0) + 1);
    }

    const families: CfihosRdlObjectFamilyDiagnostic[] = Array.from(
      familyMap.entries(),
      ([definitionFile, objectCount]) => ({
        definitionFile,
        objectCount,
        explorerCoverage: classifyFamily(definitionFile),
      }),
    ).sort((a, b) =>
      b.objectCount - a.objectCount || a.definitionFile.localeCompare(b.definitionFile),
    );

    const unresolvedObjectIds = new Set<string>();
    let resolvedEquivalenceMappingCount = 0;
    for (const mapping of mappings) {
      if (masterIdSet.has(normalizeKey(mapping.objectId))) {
        resolvedEquivalenceMappingCount += 1;
      } else {
        unresolvedObjectIds.add(mapping.objectId);
      }
    }

    const codingSourceMap = new Map<
      string,
      { mappingCount: number; objectIds: Set<string> }
    >();
    for (const mapping of mappings) {
      const source = mapping.codingSourceCode || "(missing)";
      const current = codingSourceMap.get(source) ?? {
        mappingCount: 0,
        objectIds: new Set<string>(),
      };
      current.mappingCount += 1;
      current.objectIds.add(normalizeKey(mapping.objectId));
      codingSourceMap.set(source, current);
    }

    const codingSources: CfihosCodingSourceDiagnostic[] = Array.from(
      codingSourceMap.entries(),
      ([codingSourceCode, value]) => ({
        codingSourceCode,
        mappingCount: value.mappingCount,
        objectCount: value.objectIds.size,
      }),
    ).sort((a, b) =>
      b.mappingCount - a.mappingCount ||
      a.codingSourceCode.localeCompare(b.codingSourceCode),
    );

    const mappingSemanticKeys = mappings.map((mapping) =>
      [
        normalizeKey(mapping.objectId),
        normalizeKey(mapping.codingSourceCode),
        normalizeKey(mapping.equivalentValue),
      ].join("|"),
    );

    const diagnostics: CfihosRdlObjectRegistryDiagnostics = {
      masterObjectCount: objects.length,
      uniqueMasterObjectIdCount: new Set(objectIds.filter(Boolean)).size,
      duplicateMasterObjectIdCount: countDuplicates(objectIds.filter(Boolean)),
      duplicateMasterObjectNameCount: countDuplicates(objectNames),
      missingNameCount: objects.filter((item) => !item.name).length,
      missingDescriptionCount: objects.filter((item) => !item.description).length,
      missingDefinitionFileCount: objects.filter((item) => !item.definitionFile).length,

      definitionFileCount: families.length,
      implementedFamilyCount: families.filter(
        (item) => item.explorerCoverage === "implemented",
      ).length,
      supportingFamilyCount: families.filter(
        (item) => item.explorerCoverage === "supporting",
      ).length,
      unclassifiedFamilyCount: families.filter(
        (item) => item.explorerCoverage === "unclassified",
      ).length,
      families,

      equivalenceMappingCount: mappings.length,
      mappedObjectCount: new Set(mappings.map((item) => normalizeKey(item.objectId))).size,
      codingSourceCount: codingSources.length,
      resolvedEquivalenceMappingCount,
      unresolvedEquivalenceMappingCount:
        mappings.length - resolvedEquivalenceMappingCount,
      duplicateEquivalenceMappingCount: countDuplicates(mappingSemanticKeys),
      codingSources,
      unresolvedObjectIds: Array.from(unresolvedObjectIds).sort(),
    };

    return { objects, mappings, diagnostics };
  }
}

function buildMasterObject(row: CfihosWorksheetRow): CfihosRdlMasterObject {
  return {
    id: normalizeRequiredString(row["CFIHOS unique code"]),
    name: normalizeRequiredString(row["CFIHOS name"]),
    description: normalizeOptionalString(row["CFIHOS description"]),
    definitionFile: normalizeOptionalString(row["CFIHOS definition file"]),
  };
}

function buildEquivalentMapping(
  row: CfihosWorksheetRow,
): CfihosObjectEquivalentMapping | null {
  const objectId = normalizeRequiredString(row["CFIHOS unique code"]);
  const codingSourceCode = normalizeRequiredString(row["coding source code"]);
  const equivalentValue = normalizeRequiredString(row["CFIHOS code equivalent value"]);
  if (!objectId || !codingSourceCode || !equivalentValue) return null;
  return { objectId, codingSourceCode, equivalentValue };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeFamily(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function classifyFamily(
  definitionFile: string,
): CfihosRdlObjectFamilyDiagnostic["explorerCoverage"] {
  if (IMPLEMENTED_FAMILIES.has(definitionFile)) return "implemented";
  if (SUPPORTING_FAMILIES.has(definitionFile)) return "supporting";
  return "unclassified";
}

function countDuplicates(values: string[]): number {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let duplicates = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicates += count - 1;
  }
  return duplicates;
}

export const cfihosRdlObjectRegistryRepository =
  new CfihosRdlObjectRegistryRepository();
