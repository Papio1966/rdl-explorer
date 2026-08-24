import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosPropertyPicklistFamilyDiagnostics,
  CfihosPropertyPicklistMasterObject,
  CfihosPropertyPicklistValueMasterObject,
  CfihosPropertyPicklistUsageSummary,
} from "../model/propertyPicklistFamily";

const MASTER_SHEET = "RDL master object";
const PROPERTY_SHEET = "property";
const VALUE_SHEET = "property picklist values";

const PICKLIST_FAMILY = "property picklist";
const PICKLIST_VALUE_FAMILY = "property picklist value";

type MasterObject = {
  id: string;
  name: string;
  description: string | null;
  definitionFile: string | null;
};

type PropertyReference = {
  propertyId: string;
  picklistId: string | null;
};

type PicklistValue = {
  picklistId: string;
  picklistName: string;
  valueId: string;
};

export class CfihosPropertyPicklistFamilyRepository {
  private diagnostics: CfihosPropertyPicklistFamilyDiagnostics | null = null;
  private loadingPromise: Promise<CfihosPropertyPicklistFamilyDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosPropertyPicklistFamilyDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.loadDiagnostics();

    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadDiagnostics(): Promise<CfihosPropertyPicklistFamilyDiagnostics> {
    const [masterRows, propertyRows, valueRows] = await Promise.all([
      getCfihosWorksheetRows(MASTER_SHEET),
      getCfihosWorksheetRows(PROPERTY_SHEET),
      getCfihosWorksheetRows(VALUE_SHEET),
    ]);

    const masterObjects = masterRows.map(buildMasterObject);
    const masterPicklists = masterObjects
      .filter((item) => normalizeKey(item.definitionFile) === PICKLIST_FAMILY)
      .map(toPicklistMasterObject);
    const masterPicklistValues = masterObjects
      .filter((item) => normalizeKey(item.definitionFile) === PICKLIST_VALUE_FAMILY)
      .map(toPicklistValueMasterObject);

    const masterPicklistIds = new Set(masterPicklists.map((item) => normalizeKey(item.id)));
    const masterValueIds = new Set(masterPicklistValues.map((item) => normalizeKey(item.id)));

    const properties = propertyRows.map(buildPropertyReference).filter(
      (item) => item.propertyId.length > 0,
    );
    const propertiesWithPicklist = properties.filter(
      (item): item is PropertyReference & { picklistId: string } => Boolean(item.picklistId),
    );

    const propertyPicklistIds = uniqueNormalized(
      propertiesWithPicklist.map((item) => item.picklistId),
    );
    const resolvedPropertyPicklistIds = propertyPicklistIds.filter((id) =>
      masterPicklistIds.has(id),
    );
    const unresolvedPropertyPicklistIds = propertyPicklistIds.filter(
      (id) => !masterPicklistIds.has(id),
    );

    const values = valueRows.map(buildPicklistValue).filter(
      (item) => item.picklistId.length > 0 && item.valueId.length > 0,
    );
    const valueParentPicklistIds = uniqueNormalized(values.map((item) => item.picklistId));
    const resolvedValueParentPicklistIds = valueParentPicklistIds.filter((id) =>
      masterPicklistIds.has(id),
    );
    const unresolvedValueParentPicklistIds = valueParentPicklistIds.filter(
      (id) => !masterPicklistIds.has(id),
    );

    const uniqueValueIds = uniqueNormalized(values.map((item) => item.valueId));
    const resolvedValueIds = uniqueValueIds.filter((id) => masterValueIds.has(id));
    const unresolvedValueIds = uniqueValueIds.filter((id) => !masterValueIds.has(id));

    const referencedMasterPicklistIds = new Set<string>([
      ...resolvedPropertyPicklistIds,
      ...resolvedValueParentPicklistIds,
    ]);

    const masterOnlyPicklists = masterPicklists
      .filter((item) => !referencedMasterPicklistIds.has(normalizeKey(item.id)))
      .sort(compareMasterObjects);

    const picklistsWithValues = new Set(resolvedValueParentPicklistIds);
    const picklistsWithoutValues = masterPicklists
      .filter((item) => !picklistsWithValues.has(normalizeKey(item.id)))
      .sort(compareMasterObjects);

    const propertyCountByPicklist = new Map<string, number>();
    for (const property of propertiesWithPicklist) {
      const key = normalizeKey(property.picklistId);
      propertyCountByPicklist.set(key, (propertyCountByPicklist.get(key) ?? 0) + 1);
    }

    const valueCountByPicklist = new Map<string, number>();
    const picklistNameById = new Map<string, string>();
    for (const value of values) {
      const key = normalizeKey(value.picklistId);
      valueCountByPicklist.set(key, (valueCountByPicklist.get(key) ?? 0) + 1);
      if (!picklistNameById.has(key) && value.picklistName) {
        picklistNameById.set(key, value.picklistName);
      }
    }

    const representativePicklists: CfihosPropertyPicklistUsageSummary[] = masterPicklists
      .map((item) => {
        const key = normalizeKey(item.id);
        return {
          picklistId: item.id,
          picklistName: item.name || picklistNameById.get(key) || "(unnamed)",
          propertyCount: propertyCountByPicklist.get(key) ?? 0,
          valueCount: valueCountByPicklist.get(key) ?? 0,
        };
      })
      .filter((item) => item.propertyCount > 0 || item.valueCount > 0)
      .sort((a, b) =>
        b.valueCount - a.valueCount ||
        b.propertyCount - a.propertyCount ||
        a.picklistName.localeCompare(b.picklistName, undefined, { sensitivity: "base" }),
      )
      .slice(0, 12);

    return {
      masterPicklistCount: masterPicklists.length,
      uniqueMasterPicklistIdCount: new Set(masterPicklists.map((item) => normalizeKey(item.id))).size,
      duplicateMasterPicklistIdCount: countDuplicates(masterPicklists.map((item) => normalizeKey(item.id))),

      masterPicklistValueCount: masterPicklistValues.length,
      uniqueMasterPicklistValueIdCount: new Set(masterPicklistValues.map((item) => normalizeKey(item.id))).size,
      duplicateMasterPicklistValueIdCount: countDuplicates(masterPicklistValues.map((item) => normalizeKey(item.id))),

      propertyCount: properties.length,
      propertiesWithPicklistCount: propertiesWithPicklist.length,
      uniquePropertyPicklistReferenceCount: propertyPicklistIds.length,
      resolvedPropertyPicklistReferenceCount: resolvedPropertyPicklistIds.length,
      unresolvedPropertyPicklistReferenceCount: unresolvedPropertyPicklistIds.length,

      picklistValueRowCount: values.length,
      uniqueValueParentPicklistCount: valueParentPicklistIds.length,
      resolvedValueParentPicklistCount: resolvedValueParentPicklistIds.length,
      unresolvedValueParentPicklistCount: unresolvedValueParentPicklistIds.length,

      resolvedValueMasterObjectCount: resolvedValueIds.length,
      unresolvedValueMasterObjectCount: unresolvedValueIds.length,

      referencedMasterPicklistCount: referencedMasterPicklistIds.size,
      masterOnlyPicklistCount: masterOnlyPicklists.length,
      picklistsWithoutValuesCount: picklistsWithoutValues.length,

      propertyToPicklistToValueComplete:
        unresolvedPropertyPicklistIds.length === 0 &&
        unresolvedValueParentPicklistIds.length === 0 &&
        unresolvedValueIds.length === 0,

      masterOnlyPicklists,
      picklistsWithoutValues,
      unresolvedPropertyPicklistIds: unresolvedPropertyPicklistIds.sort(),
      unresolvedValueParentPicklistIds: unresolvedValueParentPicklistIds.sort(),
      unresolvedValueIds: unresolvedValueIds.sort(),
      representativePicklists,
    };
  }
}

function buildMasterObject(row: CfihosWorksheetRow): MasterObject {
  return {
    id: normalizeRequiredString(row["CFIHOS unique code"]),
    name: normalizeRequiredString(row["CFIHOS name"]),
    description: normalizeOptionalString(row["CFIHOS description"]),
    definitionFile: normalizeOptionalString(row["CFIHOS definition file"]),
  };
}

function buildPropertyReference(row: CfihosWorksheetRow): PropertyReference {
  return {
    propertyId: normalizeRequiredString(row["CFIHOS unique code"]),
    picklistId: normalizeOptionalString(row["property picklist name CFIHOS unique code"]),
  };
}

function buildPicklistValue(row: CfihosWorksheetRow): PicklistValue {
  return {
    picklistId: normalizeRequiredString(row["property picklist CFIHOS unique code"]),
    picklistName: normalizeRequiredString(row["property picklist name"]),
    valueId: normalizeRequiredString(row["property picklist value CFIHOS unique code"]),
  };
}

function toPicklistMasterObject(item: MasterObject): CfihosPropertyPicklistMasterObject {
  return { id: item.id, name: item.name, description: item.description };
}

function toPicklistValueMasterObject(item: MasterObject): CfihosPropertyPicklistValueMasterObject {
  return { id: item.id, name: item.name, description: item.description };
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function uniqueNormalized(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeKey).filter(Boolean)));
}

function countDuplicates(values: string[]): number {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicates += count - 1;
  }
  return duplicates;
}

function compareMasterObjects(
  a: CfihosPropertyPicklistMasterObject,
  b: CfihosPropertyPicklistMasterObject,
): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export const cfihosPropertyPicklistFamilyRepository =
  new CfihosPropertyPicklistFamilyRepository();
