import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosClassRelationshipDiagnostics,
  CfihosResolvedTagEquipmentClassRelationship,
  CfihosTagEquipmentClassRelationship,
} from "../model/classRelationship";
import { cfihosRepository } from "./CfihosRepository";
import { cfihosEquipmentRepository } from "./CfihosEquipmentRepository";

const RELATIONSHIP_SHEET = "tag equipment class relationshi";

type ClassRelationshipRepositoryState = {
  sourceRelationships: CfihosTagEquipmentClassRelationship[];
  resolvedRelationships: CfihosResolvedTagEquipmentClassRelationship[];

  relationshipsByTagClassId: Map<
    string,
    CfihosResolvedTagEquipmentClassRelationship[]
  >;

  relationshipsByEquipmentClassId: Map<
    string,
    CfihosResolvedTagEquipmentClassRelationship[]
  >;

  diagnostics: CfihosClassRelationshipDiagnostics;
};

export class CfihosClassRelationshipRepository {
  private state: ClassRelationshipRepositoryState | null = null;

  private loadingPromise:
    | Promise<ClassRelationshipRepositoryState>
    | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getRelationships(): Promise<
    CfihosResolvedTagEquipmentClassRelationship[]
  > {
    const state = await this.getState();
    return state.resolvedRelationships;
  }

  async getEquipmentClassesForTagClass(
    tagClassId: string,
  ): Promise<CfihosResolvedTagEquipmentClassRelationship[]> {
    const state = await this.getState();

    const resolvedTagClassId = resolveRequestedClassId(
      tagClassId,
      state.relationshipsByTagClassId,
    );

    if (!resolvedTagClassId) {
      return [];
    }

    return state.relationshipsByTagClassId.get(resolvedTagClassId) ?? [];
  }

  async getTagClassesForEquipmentClass(
    equipmentClassId: string,
  ): Promise<CfihosResolvedTagEquipmentClassRelationship[]> {
    const state = await this.getState();

    const resolvedEquipmentClassId = resolveRequestedClassId(
      equipmentClassId,
      state.relationshipsByEquipmentClassId,
    );

    if (!resolvedEquipmentClassId) {
      return [];
    }

    return (
      state.relationshipsByEquipmentClassId.get(
        resolvedEquipmentClassId,
      ) ?? []
    );
  }

  async getDiagnostics(): Promise<CfihosClassRelationshipDiagnostics> {
    const state = await this.getState();
    return state.diagnostics;
  }

  private async getState(): Promise<ClassRelationshipRepositoryState> {
    if (this.state) {
      return this.state;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.loadState();
    }

    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadState(): Promise<ClassRelationshipRepositoryState> {
    const [rows, tagClasses, equipmentClasses] = await Promise.all([
      getCfihosWorksheetRows(RELATIONSHIP_SHEET),
      cfihosRepository.getTagClasses(),
      cfihosEquipmentRepository.getEquipmentClasses(),
    ]);

    const sourceRelationships = this.buildRelationships(rows);

    const tagLookup = buildClassLookup(tagClasses);
    const equipmentLookup = buildClassLookup(equipmentClasses);

    const resolvedRelationships: CfihosResolvedTagEquipmentClassRelationship[] = [];

    const relationshipsByTagClassId = new Map<
      string,
      CfihosResolvedTagEquipmentClassRelationship[]
    >();

    const relationshipsByEquipmentClassId = new Map<
      string,
      CfihosResolvedTagEquipmentClassRelationship[]
    >();

    const unresolvedTagIds = new Set<string>();
    const unresolvedEquipmentIds = new Set<string>();

    const uniqueTagClassIds = new Set<string>();
    const uniqueEquipmentClassIds = new Set<string>();

    let resolvedTagReferenceCount = 0;
    let resolvedEquipmentReferenceCount = 0;
    let sameCanonicalIdCount = 0;
    let differentCanonicalIdCount = 0;
    let mappingReasonCount = 0;

    for (const relationship of sourceRelationships) {
      const tagClass = resolveClass(relationship.tagClassId, tagLookup);
      const equipmentClass = resolveClass(
        relationship.equipmentClassId,
        equipmentLookup,
      );

      if (tagClass) {
        resolvedTagReferenceCount += 1;
        uniqueTagClassIds.add(tagClass.id);
      } else {
        unresolvedTagIds.add(relationship.tagClassId);
      }

      if (equipmentClass) {
        resolvedEquipmentReferenceCount += 1;
        uniqueEquipmentClassIds.add(equipmentClass.id);
      } else {
        unresolvedEquipmentIds.add(relationship.equipmentClassId);
      }

      if (
        canonicalizeCfihosId(relationship.tagClassId) ===
        canonicalizeCfihosId(relationship.equipmentClassId)
      ) {
        sameCanonicalIdCount += 1;
      } else {
        differentCanonicalIdCount += 1;
      }

      if (relationship.mappingReason) {
        mappingReasonCount += 1;
      }

      if (!tagClass || !equipmentClass) {
        continue;
      }

      const resolved: CfihosResolvedTagEquipmentClassRelationship = {
        relationship,
        tagClass,
        equipmentClass,
      };

      resolvedRelationships.push(resolved);

      addToIndex(relationshipsByTagClassId, tagClass.id, resolved);
      addToIndex(
        relationshipsByEquipmentClassId,
        equipmentClass.id,
        resolved,
      );
    }

    resolvedRelationships.sort(compareRelationships);

    for (const relationships of relationshipsByTagClassId.values()) {
      relationships.sort((a, b) =>
        a.equipmentClass.name.localeCompare(
          b.equipmentClass.name,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      );
    }

    for (const relationships of relationshipsByEquipmentClassId.values()) {
      relationships.sort((a, b) =>
        a.tagClass.name.localeCompare(b.tagClass.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    }

    const diagnostics: CfihosClassRelationshipDiagnostics = {
      sourceRelationshipCount: sourceRelationships.length,
      resolvedRelationshipCount: resolvedRelationships.length,

      uniqueTagClassCount: uniqueTagClassIds.size,
      uniqueEquipmentClassCount: uniqueEquipmentClassIds.size,

      resolvedTagReferenceCount,
      resolvedEquipmentReferenceCount,

      unresolvedTagReferenceCount:
        sourceRelationships.length - resolvedTagReferenceCount,
      unresolvedEquipmentReferenceCount:
        sourceRelationships.length - resolvedEquipmentReferenceCount,

      sameCanonicalIdCount,
      differentCanonicalIdCount,
      mappingReasonCount,

      unresolvedTagIds: Array.from(unresolvedTagIds).sort(),
      unresolvedEquipmentIds: Array.from(unresolvedEquipmentIds).sort(),
    };

    return {
      sourceRelationships,
      resolvedRelationships,
      relationshipsByTagClassId,
      relationshipsByEquipmentClassId,
      diagnostics,
    };
  }

  private buildRelationships(
    rows: CfihosWorksheetRow[],
  ): CfihosTagEquipmentClassRelationship[] {
    return rows
      .map(
        (row): CfihosTagEquipmentClassRelationship => ({
          tagClassId: normalizeRequiredString(
            row["tag class CFIHOS unique code"],
          ),
          tagClassName: normalizeRequiredString(row["tag class name"]),

          equipmentClassId: normalizeRequiredString(
            row["equipment class CFIHOS unique code"],
          ),
          equipmentClassName: normalizeRequiredString(
            row["equipment class name"],
          ),

          mappingReason: normalizeOptionalString(
            row["tag or equipment class relationship reason for mapping"],
          ),
        }),
      )
      .filter(
        (relationship) =>
          relationship.tagClassId.length > 0 &&
          relationship.equipmentClassId.length > 0,
      );
  }
}

type ClassLookup<T extends { id: string }> = {
  exact: Map<string, T>;
  canonical: Map<string, T[]>;
};

function buildClassLookup<T extends { id: string }>(
  classes: T[],
): ClassLookup<T> {
  const exact = new Map<string, T>();
  const canonical = new Map<string, T[]>();

  for (const item of classes) {
    exact.set(normalizeIdText(item.id), item);

    const key = canonicalizeCfihosId(item.id);
    const candidates = canonical.get(key) ?? [];
    candidates.push(item);
    canonical.set(key, candidates);
  }

  return {
    exact,
    canonical,
  };
}

function resolveClass<T extends { id: string }>(
  rawId: string,
  lookup: ClassLookup<T>,
): T | null {
  const normalized = normalizeIdText(rawId);

  const exact = lookup.exact.get(normalized);
  if (exact) {
    return exact;
  }

  const candidates = lookup.canonical.get(canonicalizeCfihosId(rawId)) ?? [];

  return candidates.length === 1 ? candidates[0] : null;
}

function resolveRequestedClassId<T>(
  requestedId: string,
  index: Map<string, T[]>,
): string | null {
  if (index.has(requestedId)) {
    return requestedId;
  }

  const requestedCanonical = canonicalizeCfihosId(requestedId);

  const matchingIds = Array.from(index.keys()).filter(
    (id) => canonicalizeCfihosId(id) === requestedCanonical,
  );

  return matchingIds.length === 1 ? matchingIds[0] : null;
}

function canonicalizeCfihosId(value: string): string {
  const normalized = normalizeIdText(value);
  const match = /^CFIHOS-(\d+)$/.exec(normalized);

  if (!match) {
    return normalized;
  }

  const digits = match[1];

  if (digits.length === 8) {
    return `CFIHOS-${digits}`;
  }

  if (digits.length > 8) {
    return `CFIHOS-${digits[0]}${digits.slice(-7)}`;
  }

  if (digits.length > 1) {
    return `CFIHOS-${digits[0]}${digits.slice(1).padStart(7, "0")}`;
  }

  return `CFIHOS-${digits.padEnd(8, "0")}`;
}

function normalizeIdText(value: string): string {
  return value.trim().toUpperCase();
}

function addToIndex<T>(
  index: Map<string, T[]>,
  key: string,
  value: T,
): void {
  const existing = index.get(key) ?? [];
  existing.push(value);
  index.set(key, existing);
}

function compareRelationships(
  a: CfihosResolvedTagEquipmentClassRelationship,
  b: CfihosResolvedTagEquipmentClassRelationship,
): number {
  const tagComparison = a.tagClass.name.localeCompare(
    b.tagClass.name,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );

  if (tagComparison !== 0) {
    return tagComparison;
  }

  return a.equipmentClass.name.localeCompare(
    b.equipmentClass.name,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

export const cfihosClassRelationshipRepository =
  new CfihosClassRelationshipRepository();
