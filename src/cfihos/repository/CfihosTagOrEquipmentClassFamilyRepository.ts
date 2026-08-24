import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosTagOrEquipmentClassFamilyDiagnostics,
  CfihosTagOrEquipmentClassFamilySample,
} from "../model/tagOrEquipmentClassFamily";
import { cfihosRepository } from "./CfihosRepository";
import { cfihosEquipmentRepository } from "./CfihosEquipmentRepository";
import { cfihosClassRelationshipRepository } from "./CfihosClassRelationshipRepository";

const MASTER_SHEET = "RDL master object";
const MASTER_FAMILY = "tag or equipment class";

export class CfihosTagOrEquipmentClassFamilyRepository {
  private diagnostics: CfihosTagOrEquipmentClassFamilyDiagnostics | null = null;
  private loadingPromise: Promise<CfihosTagOrEquipmentClassFamilyDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosTagOrEquipmentClassFamilyDiagnostics> {
    if (this.diagnostics) {
      return this.diagnostics;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.buildDiagnostics();
    }

    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildDiagnostics(): Promise<CfihosTagOrEquipmentClassFamilyDiagnostics> {
    const [masterRows, tagClasses, equipmentClasses, relationships] =
      await Promise.all([
        getCfihosWorksheetRows(MASTER_SHEET),
        cfihosRepository.getTagClasses(),
        cfihosEquipmentRepository.getEquipmentClasses(),
        cfihosClassRelationshipRepository.getRelationships(),
      ]);

    const masterObjects = masterRows
      .filter(
        (row) =>
          normalizeText(row["CFIHOS definition file"]) === MASTER_FAMILY,
      )
      .map((row) => ({
        id: requiredText(row, "CFIHOS unique code"),
        name: requiredText(row, "CFIHOS name"),
      }))
      .filter((item) => item.id.length > 0);

    const masterByCanonicalId = new Map<string, { id: string; name: string }>();
    for (const item of masterObjects) {
      const canonical = canonicalizeCfihosId(item.id);
      if (!masterByCanonicalId.has(canonical)) {
        masterByCanonicalId.set(canonical, item);
      }
    }

    const tagsByCanonicalId = groupByCanonicalId(
      tagClasses.map((item) => ({ id: item.id, name: item.name })),
    );
    const equipmentByCanonicalId = groupByCanonicalId(
      equipmentClasses.map((item) => ({ id: item.id, name: item.name })),
    );

    const tagOnlySamples: CfihosTagOrEquipmentClassFamilySample[] = [];
    const equipmentOnlySamples: CfihosTagOrEquipmentClassFamilySample[] = [];
    const bothDomainSamples: CfihosTagOrEquipmentClassFamilySample[] = [];
    const neitherDomainSamples: CfihosTagOrEquipmentClassFamilySample[] = [];

    let tagOnlyMasterObjectCount = 0;
    let equipmentOnlyMasterObjectCount = 0;
    let bothDomainsMasterObjectCount = 0;
    let neitherDomainMasterObjectCount = 0;

    for (const [canonicalId, master] of [...masterByCanonicalId.entries()].sort(
      ([, a], [, b]) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
    )) {
      const tag = tagsByCanonicalId.get(canonicalId)?.[0] ?? null;
      const equipment = equipmentByCanonicalId.get(canonicalId)?.[0] ?? null;
      const sample: CfihosTagOrEquipmentClassFamilySample = {
        masterId: master.id,
        masterName: master.name,
        tagClassId: tag?.id ?? null,
        tagClassName: tag?.name ?? null,
        equipmentClassId: equipment?.id ?? null,
        equipmentClassName: equipment?.name ?? null,
      };

      if (tag && equipment) {
        bothDomainsMasterObjectCount += 1;
        pushSample(bothDomainSamples, sample);
      } else if (tag) {
        tagOnlyMasterObjectCount += 1;
        pushSample(tagOnlySamples, sample);
      } else if (equipment) {
        equipmentOnlyMasterObjectCount += 1;
        pushSample(equipmentOnlySamples, sample);
      } else {
        neitherDomainMasterObjectCount += 1;
        pushSample(neitherDomainSamples, sample);
      }
    }

    const masterCanonicalIds = new Set(masterByCanonicalId.keys());
    const tagCanonicalIds = new Set(tagsByCanonicalId.keys());
    const equipmentCanonicalIds = new Set(equipmentByCanonicalId.keys());
    const canonicalClassUnion = new Set<string>([
      ...tagCanonicalIds,
      ...equipmentCanonicalIds,
    ]);

    const tagClassIdsMissingFromMaster = tagClasses
      .filter((item) => !masterCanonicalIds.has(canonicalizeCfihosId(item.id)))
      .map((item) => item.id)
      .sort();
    const equipmentClassIdsMissingFromMaster = equipmentClasses
      .filter((item) => !masterCanonicalIds.has(canonicalizeCfihosId(item.id)))
      .map((item) => item.id)
      .sort();

    let sameMasterObjectRelationshipCount = 0;
    let differentMasterObjectRelationshipCount = 0;
    let relationshipEndpointOutsideMasterFamilyCount = 0;

    for (const resolved of relationships) {
      const tagCanonicalId = canonicalizeCfihosId(resolved.tagClass.id);
      const equipmentCanonicalId = canonicalizeCfihosId(resolved.equipmentClass.id);
      const tagInMaster = masterCanonicalIds.has(tagCanonicalId);
      const equipmentInMaster = masterCanonicalIds.has(equipmentCanonicalId);

      if (!tagInMaster || !equipmentInMaster) {
        relationshipEndpointOutsideMasterFamilyCount += 1;
      }

      if (tagCanonicalId === equipmentCanonicalId) {
        sameMasterObjectRelationshipCount += 1;
      } else {
        differentMasterObjectRelationshipCount += 1;
      }
    }

    const representedUnionCount = [...canonicalClassUnion].filter((id) =>
      masterCanonicalIds.has(id),
    ).length;

    return {
      masterFamilyObjectCount: masterObjects.length,
      masterFamilyCanonicalObjectCount: masterByCanonicalId.size,
      tagClassCount: tagClasses.length,
      equipmentClassCount: equipmentClasses.length,
      canonicalClassUnionCount: canonicalClassUnion.size,
      tagOnlyMasterObjectCount,
      equipmentOnlyMasterObjectCount,
      bothDomainsMasterObjectCount,
      neitherDomainMasterObjectCount,
      tagClassesCoveredByMasterCount:
        tagClasses.length - tagClassIdsMissingFromMaster.length,
      tagClassesMissingFromMasterCount: tagClassIdsMissingFromMaster.length,
      equipmentClassesCoveredByMasterCount:
        equipmentClasses.length - equipmentClassIdsMissingFromMaster.length,
      equipmentClassesMissingFromMasterCount:
        equipmentClassIdsMissingFromMaster.length,
      explicitRelationshipCount: relationships.length,
      sameMasterObjectRelationshipCount,
      differentMasterObjectRelationshipCount,
      relationshipEndpointOutsideMasterFamilyCount,
      masterCoverageOfCanonicalClassUnionPercent:
        canonicalClassUnion.size === 0
          ? 100
          : roundPercent((representedUnionCount / canonicalClassUnion.size) * 100),
      tagOnlySamples,
      equipmentOnlySamples,
      bothDomainSamples,
      neitherDomainSamples,
      tagClassIdsMissingFromMaster,
      equipmentClassIdsMissingFromMaster,
    };
  }
}

function groupByCanonicalId(
  items: Array<{ id: string; name: string }>,
): Map<string, Array<{ id: string; name: string }>> {
  const grouped = new Map<string, Array<{ id: string; name: string }>>();

  for (const item of items) {
    const key = canonicalizeCfihosId(item.id);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return grouped;
}

function pushSample(
  target: CfihosTagOrEquipmentClassFamilySample[],
  sample: CfihosTagOrEquipmentClassFamilySample,
): void {
  if (target.length < 8) {
    target.push(sample);
  }
}

function requiredText(row: CfihosWorksheetRow, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

function canonicalizeCfihosId(value: string): string {
  const normalized = value.trim().toUpperCase();
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

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export const cfihosTagOrEquipmentClassFamilyRepository =
  new CfihosTagOrEquipmentClassFamilyRepository();
