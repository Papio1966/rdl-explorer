import {
  getCfihosSheetNames,
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosEntityAttributeCooccurrenceSample,
  CfihosEntityAttributeFamilyDiagnostics,
  CfihosEntityAttributeWorksheetUsage,
  CfihosMasterObjectSample,
} from "../model/entityAttributeFamily";

const MASTER_SHEET = "RDL master object";

export class CfihosEntityAttributeFamilyRepository {
  private diagnostics: CfihosEntityAttributeFamilyDiagnostics | null = null;
  private loadingPromise: Promise<CfihosEntityAttributeFamilyDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosEntityAttributeFamilyDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.buildDiagnostics();
    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildDiagnostics(): Promise<CfihosEntityAttributeFamilyDiagnostics> {
    const [sheetNames, masterRows] = await Promise.all([
      getCfihosSheetNames(),
      getCfihosWorksheetRows(MASTER_SHEET),
    ]);
    const entityObjects = masterObjectsForFamily(masterRows, "entity");
    const attributeObjects = masterObjectsForFamily(masterRows, "entity attribute");
    const entityById = new Map(entityObjects.map((item) => [canonicalId(item.id), item]));
    const attributeById = new Map(attributeObjects.map((item) => [canonicalId(item.id), item]));

    const referencedEntityIds = new Set<string>();
    const referencedAttributeIds = new Set<string>();
    const pairKeys = new Set<string>();
    const worksheetUsage: CfihosEntityAttributeWorksheetUsage[] = [];
    const cooccurrenceSamples: CfihosEntityAttributeCooccurrenceSample[] = [];
    let entityOccurrenceCountOutsideMaster = 0;
    let attributeOccurrenceCountOutsideMaster = 0;
    let rowsWithEntityAndAttributeCount = 0;

    const nonMasterSheets = sheetNames.filter((name) => name !== MASTER_SHEET);
    const allRows = await Promise.all(
      nonMasterSheets.map(async (sheetName) => ({
        sheetName,
        rows: await getCfihosWorksheetRows(sheetName),
      })),
    );

    for (const { sheetName, rows } of allRows) {
      let entityOccurrenceCount = 0;
      let attributeOccurrenceCount = 0;
      let rowsWithBothCount = 0;
      const sheetEntityIds = new Set<string>();
      const sheetAttributeIds = new Set<string>();

      for (const row of rows) {
        const rowEntityIds = new Set<string>();
        const rowAttributeIds = new Set<string>();
        for (const value of Object.values(row)) {
          const raw = text(value);
          if (!raw) continue;
          const key = canonicalId(raw);
          if (entityById.has(key)) {
            entityOccurrenceCount += 1;
            entityOccurrenceCountOutsideMaster += 1;
            referencedEntityIds.add(key);
            sheetEntityIds.add(key);
            rowEntityIds.add(key);
          }
          if (attributeById.has(key)) {
            attributeOccurrenceCount += 1;
            attributeOccurrenceCountOutsideMaster += 1;
            referencedAttributeIds.add(key);
            sheetAttributeIds.add(key);
            rowAttributeIds.add(key);
          }
        }

        if (rowEntityIds.size > 0 && rowAttributeIds.size > 0) {
          rowsWithBothCount += 1;
          rowsWithEntityAndAttributeCount += 1;
          for (const entityId of rowEntityIds) {
            for (const attributeId of rowAttributeIds) {
              pairKeys.add(`${entityId}|${attributeId}`);
              const alreadySampled = cooccurrenceSamples.some((item) =>
                canonicalId(item.entityId) === entityId && canonicalId(item.attributeId) === attributeId,
              );
              if (cooccurrenceSamples.length < 12 && !alreadySampled) {
                const entity = entityById.get(entityId)!;
                const attribute = attributeById.get(attributeId)!;
                cooccurrenceSamples.push({
                  sheetName,
                  entityId: entity.id,
                  entityName: entity.name,
                  attributeId: attribute.id,
                  attributeName: attribute.name,
                });
              }
            }
          }
        }
      }

      if (entityOccurrenceCount > 0 || attributeOccurrenceCount > 0) {
        worksheetUsage.push({
          sheetName,
          entityOccurrenceCount,
          entityObjectCount: sheetEntityIds.size,
          attributeOccurrenceCount,
          attributeObjectCount: sheetAttributeIds.size,
          rowsWithBothCount,
        });
      }
    }

    worksheetUsage.sort((a, b) =>
      (b.entityOccurrenceCount + b.attributeOccurrenceCount) -
      (a.entityOccurrenceCount + a.attributeOccurrenceCount) ||
      a.sheetName.localeCompare(b.sheetName),
    );

    return {
      masterEntityObjectCount: entityObjects.length,
      masterEntityAttributeObjectCount: attributeObjects.length,
      worksheetsScannedCount: sheetNames.length,
      entityOccurrenceCountOutsideMaster,
      referencedEntityObjectCount: referencedEntityIds.size,
      masterOnlyEntityObjectCount: entityObjects.length - referencedEntityIds.size,
      attributeOccurrenceCountOutsideMaster,
      referencedAttributeObjectCount: referencedAttributeIds.size,
      masterOnlyAttributeObjectCount: attributeObjects.length - referencedAttributeIds.size,
      rowsWithEntityAndAttributeCount,
      distinctEntityAttributePairCount: pairKeys.size,
      worksheetUsage,
      cooccurrenceSamples,
      masterOnlyEntitySamples: entityObjects.filter((item) => !referencedEntityIds.has(canonicalId(item.id))).slice(0, 10),
      masterOnlyAttributeSamples: attributeObjects.filter((item) => !referencedAttributeIds.has(canonicalId(item.id))).slice(0, 10),
    };
  }
}

function masterObjectsForFamily(rows: CfihosWorksheetRow[], family: string): CfihosMasterObjectSample[] {
  return rows
    .filter((row) => normalize(row["CFIHOS definition file"]) === family)
    .map((row) => ({
      id: text(row["CFIHOS unique code"]),
      name: text(row["CFIHOS name"]) || text(row["CFIHOS unique code"]),
    }))
    .filter((item) => item.id.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
function normalize(value: unknown): string {
  return text(value).toLowerCase();
}
function canonicalId(value: string): string {
  return value.trim().toUpperCase();
}

export const cfihosEntityAttributeFamilyRepository =
  new CfihosEntityAttributeFamilyRepository();
