import {
  loadCfihosUnitOfMeasureSource,
  type CfihosUnitOfMeasureSource,
} from "../runtimeCompatibility";
import {
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeSynonyms,
} from "../model/common";
import type {
  CfihosUnitOfMeasure,
  CfihosUnitOfMeasureDiagnostics,
} from "../model/unitOfMeasure";

type RepositoryState = {
  units: CfihosUnitOfMeasure[];
  unitsById: Map<string, CfihosUnitOfMeasure>;
  unitsByDimensionId: Map<string, CfihosUnitOfMeasure[]>;
  diagnostics: CfihosUnitOfMeasureDiagnostics;
};

type UnitOfMeasureSourceLoader = () => Promise<CfihosUnitOfMeasureSource>;
type UnitOfMeasureSourceRow = CfihosUnitOfMeasureSource["unitRows"][number];

export class CfihosUnitOfMeasureRepository {
  private state: RepositoryState | null = null;
  private loadingPromise: Promise<RepositoryState> | null = null;
  private readonly sourceLoader: UnitOfMeasureSourceLoader;

  constructor(sourceLoader: UnitOfMeasureSourceLoader = loadCfihosUnitOfMeasureSource) {
    this.sourceLoader = sourceLoader;
  }

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getUnits(): Promise<CfihosUnitOfMeasure[]> {
    const state = await this.getState();
    return state.units;
  }

  async getUnit(id: string): Promise<CfihosUnitOfMeasure | null> {
    const state = await this.getState();
    return state.unitsById.get(normalizeId(id)) ?? null;
  }

  async getUnitsForDimension(
    dimensionId: string,
  ): Promise<CfihosUnitOfMeasure[]> {
    const state = await this.getState();
    return state.unitsByDimensionId.get(normalizeId(dimensionId)) ?? [];
  }

  async getDiagnostics(): Promise<CfihosUnitOfMeasureDiagnostics> {
    const state = await this.getState();
    return state.diagnostics;
  }

  private async getState(): Promise<RepositoryState> {
    if (this.state) {
      return this.state;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

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
    const { unitRows, tagPropertyRows, equipmentPropertyRows, propertyRows } = source;

    const units = this.buildUnits(unitRows);
    const unitsById = new Map<string, CfihosUnitOfMeasure>();
    const unitsByDimensionId = new Map<string, CfihosUnitOfMeasure[]>();

    for (const unit of units) {
      const unitKey = normalizeId(unit.id);
      if (!unitsById.has(unitKey)) {
        unitsById.set(unitKey, unit);
      }

      if (unit.dimensionId) {
        const dimensionKey = normalizeId(unit.dimensionId);
        const dimensionUnits = unitsByDimensionId.get(dimensionKey) ?? [];
        dimensionUnits.push(unit);
        unitsByDimensionId.set(dimensionKey, dimensionUnits);
      }
    }

    for (const dimensionUnits of unitsByDimensionId.values()) {
      dimensionUnits.sort(compareUnits);
    }

    const diagnostics = this.buildDiagnostics(
      units,
      unitsById,
      tagPropertyRows,
      equipmentPropertyRows,
      propertyRows,
    );

    return {
      units,
      unitsById,
      unitsByDimensionId,
      diagnostics,
    };
  }

  private buildUnits(rows: UnitOfMeasureSourceRow[]): CfihosUnitOfMeasure[] {
    return rows
      .map((row): CfihosUnitOfMeasure => ({
        id: normalizeRequiredString(
          rowValue(row, ["CFIHOS unique code", "unit of measure CFIHOS unique code"]),
        ),
        uneceCommonCode: normalizeOptionalString(
          rowValue(row, ["UNECE code", "UNECE Common Code", "UNECE common code"]),
        ),
        name: normalizeRequiredString(
          rowValue(row, ["unit of measure name"]),
        ),
        symbol: normalizeOptionalString(
          rowValue(row, ["unit of measure symbol"]),
        ),
        dimensionId: normalizeOptionalString(
          rowValue(row, [
            "unit of measure dimension code CFIHOS unique code",
            "unit of measure dimension CFIHOS unique code",
          ]),
        ),
        dimensionCode: normalizeOptionalString(
          rowValue(row, ["unit of measure dimension code"]),
        ),
        dimensionName: normalizeOptionalString(
          rowValue(row, ["unit of measure dimension name"]),
        ),
        systemId: normalizeOptionalString(
          rowValue(row, [
            "measurement system code CFIHOS unique code",
            "unit of measure system CFIHOS unique code",
            "unit of measure system code CFIHOS unique code",
          ]),
        ),
        systemCode: normalizeOptionalString(
          rowValue(row, [
            "measurement system code",
            "unit of measure system code",
            "unit of measure system",
          ]),
        ),
        systemName: normalizeOptionalString(
          rowValue(row, ["measurement system name", "unit of measure system name"]),
        ),
        synonyms: normalizeSynonyms(
          rowValue(row, ["unit of measure synonym name"]),
        ),
      }))
      .filter((unit) => unit.id.length > 0 && unit.name.length > 0)
      .sort(compareUnits);
  }

  private buildDiagnostics(
    units: CfihosUnitOfMeasure[],
    unitsById: Map<string, CfihosUnitOfMeasure>,
    tagPropertyRows: UnitOfMeasureSourceRow[],
    equipmentPropertyRows: UnitOfMeasureSourceRow[],
    propertyRows: UnitOfMeasureSourceRow[],
  ): CfihosUnitOfMeasureDiagnostics {
    const unitIdCounts = countValues(units.map((unit) => normalizeId(unit.id)));
    const unitNameCounts = countValues(
      units.map((unit) => unit.name.trim().toLowerCase()),
    );

    const dimensions = new Set(
      units
        .map((unit) => unit.dimensionId)
        .filter((value): value is string => Boolean(value))
        .map(normalizeId),
    );

    const measurementSystems = new Set(
      units
        .map((unit) => unit.systemId ?? unit.systemCode ?? unit.systemName)
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toLowerCase()),
    );

    const tagSi = collectIds(tagPropertyRows, ["SI unit of measure CFIHOS unique code"]);
    const tagImperial = collectIds(tagPropertyRows, ["imperial unit of measure CFIHOS unique code"]);
    const equipmentSi = collectIds(equipmentPropertyRows, ["SI unit of measure CFIHOS unique code"]);
    const equipmentImperial = collectIds(equipmentPropertyRows, ["imperial unit of measure CFIHOS unique code"]);

    const allUnitReferences = [
      ...tagSi,
      ...tagImperial,
      ...equipmentSi,
      ...equipmentImperial,
    ];

    const unresolvedUnitIds = Array.from(
      new Set(
        allUnitReferences
          .map(normalizeId)
          .filter((id) => !unitsById.has(id)),
      ),
    ).sort();

    const propertyDimensionReferences = collectIds(propertyRows, [
      "unit of measure dimension code CFIHOS unique code",
    ]);

    const unresolvedDimensionIds = Array.from(
      new Set(
        propertyDimensionReferences
          .map(normalizeId)
          .filter((id) => !dimensions.has(id)),
      ),
    ).sort();

    return {
      sourceUnitCount: units.length,
      uniqueUnitIdCount: unitsById.size,
      duplicateUnitIdCount: duplicateCount(unitIdCounts),
      duplicateUnitNameCount: duplicateCount(unitNameCounts),
      dimensionCount: dimensions.size,
      measurementSystemCount: measurementSystems.size,
      missingSymbolCount: units.filter((unit) => !unit.symbol).length,
      missingUneceCodeCount: units.filter((unit) => !unit.uneceCommonCode).length,
      tagSiReferenceCount: tagSi.length,
      tagImperialReferenceCount: tagImperial.length,
      equipmentSiReferenceCount: equipmentSi.length,
      equipmentImperialReferenceCount: equipmentImperial.length,
      resolvedUnitReferenceCount: allUnitReferences.filter((id) =>
        unitsById.has(normalizeId(id)),
      ).length,
      unresolvedUnitReferenceCount: allUnitReferences.filter(
        (id) => !unitsById.has(normalizeId(id)),
      ).length,
      unresolvedUnitIds,
      propertyDimensionReferenceCount: propertyDimensionReferences.length,
      resolvedPropertyDimensionReferenceCount:
        propertyDimensionReferences.filter((id) => dimensions.has(normalizeId(id))).length,
      unresolvedPropertyDimensionReferenceCount:
        propertyDimensionReferences.filter((id) => !dimensions.has(normalizeId(id))).length,
      unresolvedDimensionIds,
    };
  }
}

function compareUnits(a: CfihosUnitOfMeasure, b: CfihosUnitOfMeasure): number {
  return a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function rowValue(row: UnitOfMeasureSourceRow, candidates: string[]): unknown {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
  }

  const normalizedCandidates = new Set(candidates.map(normalizeHeader));

  for (const [key, value] of Object.entries(row)) {
    if (normalizedCandidates.has(normalizeHeader(key))) {
      return value;
    }
  }

  return null;
}

function collectIds(rows: UnitOfMeasureSourceRow[], candidates: string[]): string[] {
  return rows
    .map((row) => normalizeOptionalString(rowValue(row, candidates)))
    .filter((value): value is string => Boolean(value));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeId(value: string): string {
  return value.trim().toUpperCase();
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function duplicateCount(counts: Map<string, number>): number {
  let count = 0;

  for (const occurrences of counts.values()) {
    if (occurrences > 1) {
      count += occurrences - 1;
    }
  }

  return count;
}

export const cfihosUnitOfMeasureRepository =
  new CfihosUnitOfMeasureRepository();
