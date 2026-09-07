import {
  loadCfihosPropertySource,
  type CfihosPropertySource,
} from "../runtimeCompatibility";
import {
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeSynonyms,
} from "../model/common";
import type {
  CfihosProperty,
  CfihosPropertyPicklistValue,
} from "../model/property";
import type { CfihosTagClass } from "../model/tagClass";

export type CfihosPropertyUsage = {
  property: CfihosProperty;
  tagClasses: CfihosTagClass[];
};

type RepositoryState = {
  properties: CfihosProperty[];
  propertiesById: Map<string, CfihosProperty>;
  tagClasses: CfihosTagClass[];
  usageIndex: Map<string, CfihosTagClass[]>;
  picklistValuesByPicklistId: Map<string, CfihosPropertyPicklistValue[]>;
};

type PropertySourceLoader = () => Promise<CfihosPropertySource>;

export class CfihosPropertyRepository {
  private state: RepositoryState | null = null;
  private loadingPromise: Promise<RepositoryState> | null = null;
  private readonly sourceLoader: PropertySourceLoader;

  constructor(sourceLoader: PropertySourceLoader = loadCfihosPropertySource) {
    this.sourceLoader = sourceLoader;
  }

  async getProperties(): Promise<CfihosProperty[]> {
    return (await this.getState()).properties;
  }

  async getProperty(propertyId: string): Promise<CfihosProperty | null> {
    return (await this.getState()).propertiesById.get(propertyId) ?? null;
  }

  async searchProperties(query: string): Promise<CfihosProperty[]> {
    const properties = await this.getProperties();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [...properties].sort(compareProperties);

    return properties
      .filter((property) => {
        const searchableValues = [
          property.id,
          property.name,
          property.definition,
          property.dataType,
          property.unitOfMeasureDimensionCode,
          property.picklistName,
          property.existenceReason,
          ...property.synonyms,
        ];
        return searchableValues.some((value) =>
          value?.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort(compareProperties);
  }

  async getTagClassesUsingProperty(propertyId: string): Promise<CfihosTagClass[]> {
    return (await this.getState()).usageIndex.get(propertyId) ?? [];
  }

  async getPropertyUsage(propertyId: string): Promise<CfihosPropertyUsage | null> {
    const [property, tagClasses] = await Promise.all([
      this.getProperty(propertyId),
      this.getTagClassesUsingProperty(propertyId),
    ]);
    return property ? { property, tagClasses } : null;
  }

  async getPicklistValues(propertyId: string): Promise<CfihosPropertyPicklistValue[]> {
    const state = await this.getState();
    const property = state.propertiesById.get(propertyId);
    if (!property?.picklistId) return [];
    return state.picklistValuesByPicklistId.get(property.picklistId) ?? [];
  }

  private async getState(): Promise<RepositoryState> {
    if (this.state) return this.state;
    if (this.loadingPromise) return this.loadingPromise;
    this.loadingPromise = this.loadState();
    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadState(): Promise<RepositoryState> {
    const source = await this.sourceLoader();
    const properties = source.propertyRows
      .map((row): CfihosProperty => ({
        id: normalizeRequiredString(row["CFIHOS unique code"]),
        name: normalizeRequiredString(row["property name"]),
        definition: normalizeOptionalString(row["property definition"]),
        dataType: normalizeOptionalString(row["property data type"]),
        dataTypeLength: normalizeOptionalString(row["property data type length"]),
        unitOfMeasureDimensionId: normalizeOptionalString(row["unit of measure dimension code CFIHOS unique code"]),
        unitOfMeasureDimensionCode: normalizeOptionalString(row["unit of measure dimension code"]),
        picklistId: normalizeOptionalString(row["property picklist name CFIHOS unique code"]),
        picklistName: normalizeOptionalString(row["property picklist name"]),
        existenceReason: normalizeOptionalString(row["property existence reason description"]),
        synonyms: normalizeSynonyms(row["property synonym name"]),
      }))
      .filter((property) => property.id.length > 0 && property.name.length > 0);

    const propertiesById = new Map<string, CfihosProperty>(
      properties.map((property) => [property.id, property]),
    );

    const tagClasses = source.tagClassRows
      .map((row): CfihosTagClass => ({
        id: normalizeRequiredString(row["CFIHOS unique code"]),
        name: normalizeRequiredString(row["tag class name"]),
        definition: normalizeOptionalString(row["tag class definition"]),
        parentName: normalizeOptionalString(row["parent tag class name"]),
        parentId: null,
        abstract: normalizeBoolean(row["abstract class indicator"]),
        tagNumberFormat: normalizeOptionalString(row["tag number format"]),
        equipmentExpected: normalizeBoolean(row["equipment expected to be installed indicator"]),
        existenceReason: normalizeOptionalString(row["tag class existence reason description"]),
        synonyms: normalizeSynonyms(row["tag class synonym"]),
      }))
      .filter((tagClass) => tagClass.id.length > 0 && tagClass.name.length > 0);

    const byName = new Map<string, CfihosTagClass[]>();
    for (const tagClass of tagClasses) {
      const key = tagClass.name.trim().toLowerCase();
      const values = byName.get(key) ?? [];
      values.push(tagClass);
      byName.set(key, values);
    }
    for (const tagClass of tagClasses) {
      if (!tagClass.parentName) continue;
      const candidates = byName.get(tagClass.parentName.trim().toLowerCase()) ?? [];
      if (candidates.length === 1 && candidates[0].id !== tagClass.id) {
        tagClass.parentId = candidates[0].id;
      }
    }

    const tagClassesById = new Map<string, CfihosTagClass>(
      tagClasses.map((tagClass) => [tagClass.id, tagClass]),
    );
    const usageIndex = new Map<string, CfihosTagClass[]>();
    for (const row of source.tagClassPropertyRows) {
      const tagClassId = normalizeRequiredString(row["tag class CFIHOS unique code"]);
      const propertyId = normalizeRequiredString(row["property CFIHOS unique code"]);
      const tagClass = tagClassesById.get(tagClassId);
      if (!tagClass || !propertiesById.has(propertyId)) continue;
      const values = usageIndex.get(propertyId) ?? [];
      values.push(tagClass);
      usageIndex.set(propertyId, values);
    }
    for (const classes of usageIndex.values()) {
      classes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }

    const picklistValuesByPicklistId = new Map<string, CfihosPropertyPicklistValue[]>();
    for (const row of source.picklistValueRows) {
      const value: CfihosPropertyPicklistValue = {
        picklistId: normalizeRequiredString(row["property picklist CFIHOS unique code"]),
        picklistName: normalizeRequiredString(row["property picklist name"]),
        id: normalizeRequiredString(row["property picklist value CFIHOS unique code"]),
        code: normalizeRequiredString(row["property picklist value code"]),
        description: normalizeOptionalString(row["property picklist value description"]),
        sourceStandardId: normalizeOptionalString(row["Source standard CFIHOS unique code"]),
        sourceStandardCode: normalizeOptionalString(row["source standard code"]),
      };
      if (!value.picklistId || !value.id) continue;
      const values = picklistValuesByPicklistId.get(value.picklistId) ?? [];
      values.push(value);
      picklistValuesByPicklistId.set(value.picklistId, values);
    }
    for (const values of picklistValuesByPicklistId.values()) {
      values.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }));
    }

    return { properties, propertiesById, tagClasses, usageIndex, picklistValuesByPicklistId };
  }
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "y";
}

function compareProperties(a: CfihosProperty, b: CfihosProperty): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export const cfihosPropertyRepository = new CfihosPropertyRepository();
