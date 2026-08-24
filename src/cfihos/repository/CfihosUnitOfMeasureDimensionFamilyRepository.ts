import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosDimensionUsageSample,
  CfihosUnitOfMeasureDimensionFamilyDiagnostics,
} from "../model/unitOfMeasureDimensionFamily";

const MASTER_SHEET = "RDL master object";
const PROPERTY_SHEET = "property";
const UNIT_SHEET = "unit of measure";
const FAMILY = "unit of measure dimension";

const DIMENSION_ID_COLUMNS = [
  "unit of measure dimension code CFIHOS unique code",
  "unit of measure dimension CFIHOS unique code",
] as const;

type MasterDimension = {
  id: string;
  name: string;
  description: string | null;
};

type DimensionReferenceRow = {
  componentIds: string[];
};

export class CfihosUnitOfMeasureDimensionFamilyRepository {
  private diagnostics: CfihosUnitOfMeasureDimensionFamilyDiagnostics | null =
    null;

  async getDiagnostics(): Promise<CfihosUnitOfMeasureDimensionFamilyDiagnostics> {
    if (!this.diagnostics) {
      this.diagnostics = await this.loadDiagnostics();
    }

    return this.diagnostics;
  }

  private async loadDiagnostics(): Promise<CfihosUnitOfMeasureDimensionFamilyDiagnostics> {
    const [masterRows, propertyRows, unitRows] = await Promise.all([
      getCfihosWorksheetRows(MASTER_SHEET),
      getCfihosWorksheetRows(PROPERTY_SHEET),
      getCfihosWorksheetRows(UNIT_SHEET),
    ]);

    const master: MasterDimension[] = masterRows
      .filter((row) => normalizeKey(row["CFIHOS definition file"]) === FAMILY)
      .map((row) => ({
        id: normalizeRequiredString(row["CFIHOS unique code"]),
        name: normalizeRequiredString(row["CFIHOS name"]),
        description: normalizeOptionalString(row["CFIHOS description"]),
      }))
      .filter((item) => item.id.length > 0);

    const masterMap = new Map(
      master.map((item) => [normalizeKey(item.id), item]),
    );

    // Property dimension references are normally atomic. Unit of Measure rows,
    // however, can contain semicolon-separated compound dimension expressions
    // (for example POWER;HTFLOR). Resolve every component independently against
    // the canonical RDL dimension family rather than treating the whole
    // expression as one dimension identifier.
    const propertyReferenceRows = buildReferenceRows(propertyRows);
    const unitReferenceRows = buildReferenceRows(unitRows);

    const propertyComponentIds = flattenComponentIds(propertyReferenceRows);
    const unitComponentIds = flattenComponentIds(unitReferenceRows);

    const propertyDimensionSet = new Set(
      propertyComponentIds.map(normalizeKey),
    );
    const unitDimensionSet = new Set(unitComponentIds.map(normalizeKey));

    const unresolvedPropertyDimensionIds = [...propertyDimensionSet].filter(
      (id) => !masterMap.has(id),
    );
    const unresolvedUnitDimensionIds = [...unitDimensionSet].filter(
      (id) => !masterMap.has(id),
    );

    const referencedMasterDimensionIds = new Set(
      [...propertyDimensionSet, ...unitDimensionSet].filter((id) =>
        masterMap.has(id),
      ),
    );

    const masterOnlyDimensionIds = [...masterMap.keys()].filter(
      (id) => !referencedMasterDimensionIds.has(id),
    );

    const samples = (ids: string[]): CfihosDimensionUsageSample[] =>
      ids
        .map((id) => masterMap.get(id))
        .filter((item): item is MasterDimension => item !== undefined)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          propertyCount: countRowsContainingDimension(
            propertyReferenceRows,
            item.id,
          ),
          unitCount: countRowsContainingDimension(unitReferenceRows, item.id),
        }));

    const representativeDimensions = [...referencedMasterDimensionIds]
      .map((id) => samples([id])[0])
      .filter((item): item is CfihosDimensionUsageSample => item !== undefined)
      .sort(
        (a, b) =>
          b.propertyCount +
          b.unitCount -
          (a.propertyCount + a.unitCount),
      )
      .slice(0, 15);

    return {
      masterDimensionCount: master.length,
      uniqueMasterDimensionIdCount: masterMap.size,
      duplicateMasterDimensionIdCount: master.length - masterMap.size,

      propertyCount: propertyRows.length,
      propertiesWithDimensionCount: propertyReferenceRows.length,
      uniquePropertyDimensionCount: propertyDimensionSet.size,
      resolvedPropertyDimensionCount: [...propertyDimensionSet].filter((id) =>
        masterMap.has(id),
      ).length,
      unresolvedPropertyDimensionCount:
        unresolvedPropertyDimensionIds.length,

      unitCount: unitRows.length,
      unitsWithDimensionCount: unitReferenceRows.length,
      // This is intentionally the number of distinct canonical/atomic
      // dimension components used by Units, not the number of raw compound
      // expressions in the worksheet. Compound-expression diagnostics are
      // reported separately by the dedicated reconciliation panel.
      uniqueUnitDimensionCount: unitDimensionSet.size,
      resolvedUnitDimensionCount: [...unitDimensionSet].filter((id) =>
        masterMap.has(id),
      ).length,
      unresolvedUnitDimensionCount: unresolvedUnitDimensionIds.length,

      referencedMasterDimensionCount: referencedMasterDimensionIds.size,
      masterOnlyDimensionCount: masterOnlyDimensionIds.length,
      propertyOnlyDimensionCount: [...propertyDimensionSet].filter(
        (id) => masterMap.has(id) && !unitDimensionSet.has(id),
      ).length,
      unitOnlyDimensionCount: [...unitDimensionSet].filter(
        (id) => masterMap.has(id) && !propertyDimensionSet.has(id),
      ).length,
      dimensionsUsedByBothCount: [...propertyDimensionSet].filter(
        (id) => masterMap.has(id) && unitDimensionSet.has(id),
      ).length,
      masterCoveragePercent:
        masterMap.size > 0
          ? Number(
              (
                (referencedMasterDimensionIds.size / masterMap.size) *
                100
              ).toFixed(2),
            )
          : 0,

      unresolvedPropertyDimensionIds,
      unresolvedUnitDimensionIds,
      masterOnlyDimensions: samples(masterOnlyDimensionIds),
      representativeDimensions,
    };
  }
}

function buildReferenceRows(rows: CfihosWorksheetRow[]): DimensionReferenceRow[] {
  return rows
    .map((row) => {
      const expression = firstValue(row, DIMENSION_ID_COLUMNS);
      return {
        componentIds: splitDimensionExpression(expression),
      };
    })
    .filter((row) => row.componentIds.length > 0);
}

function splitDimensionExpression(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .map((component) => component.trim())
    .filter((component) => component.length > 0);
}

function flattenComponentIds(rows: DimensionReferenceRow[]): string[] {
  return rows.flatMap((row) => row.componentIds);
}

function countRowsContainingDimension(
  rows: DimensionReferenceRow[],
  dimensionId: string,
): number {
  const target = normalizeKey(dimensionId);

  return rows.filter((row) =>
    row.componentIds.some((componentId) => normalizeKey(componentId) === target),
  ).length;
}

function firstValue(
  row: CfihosWorksheetRow,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const result = normalizeOptionalString(row[name]);
    if (result) {
      return result;
    }
  }

  return null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export const cfihosUnitOfMeasureDimensionFamilyRepository =
  new CfihosUnitOfMeasureDimensionFamilyRepository();
