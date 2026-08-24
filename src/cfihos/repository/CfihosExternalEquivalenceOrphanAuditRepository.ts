import {
  getCfihosSheetNames,
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosExternalEquivalenceNeighbor,
  CfihosExternalEquivalenceOccurrence,
  CfihosExternalEquivalenceOrphanAuditDiagnostics,
  CfihosExternalEquivalenceOrphanDetail,
  CfihosExternalEquivalenceSourceSummary,
} from "../model/externalEquivalenceOrphanAudit";

const MASTER_SHEET = "RDL master object";
const EQUIVALENCE_SHEET = "CFIHOS object equivalent mappin";

type MasterObject = CfihosExternalEquivalenceNeighbor;

type Mapping = {
  objectId: string;
  codingSourceCode: string;
  equivalentValue: string;
};

type State = {
  diagnostics: CfihosExternalEquivalenceOrphanAuditDiagnostics;
};

export class CfihosExternalEquivalenceOrphanAuditRepository {
  private state: State | null = null;
  private loadingPromise: Promise<State> | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getDiagnostics(): Promise<CfihosExternalEquivalenceOrphanAuditDiagnostics> {
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
    const [sheetNames, masterRows, mappingRows] = await Promise.all([
      getCfihosSheetNames(),
      getCfihosWorksheetRows(MASTER_SHEET),
      getCfihosWorksheetRows(EQUIVALENCE_SHEET),
    ]);

    const masterObjects = masterRows
      .map(buildMasterObject)
      .filter((item) => item.id.length > 0);
    const mappings = mappingRows
      .map(buildMapping)
      .filter((item): item is Mapping => item !== null);

    const masterById = new Map(
      masterObjects.map((item) => [normalizeKey(item.id), item]),
    );

    const unresolvedMappings = mappings.filter(
      (mapping) => !masterById.has(normalizeKey(mapping.objectId)),
    );

    const unresolvedById = new Map<string, Mapping[]>();
    for (const mapping of unresolvedMappings) {
      const key = normalizeKey(mapping.objectId);
      const existing = unresolvedById.get(key) ?? [];
      existing.push(mapping);
      unresolvedById.set(key, existing);
    }

    const unresolvedKeys = new Set(unresolvedById.keys());
    const occurrenceMap = new Map<
      string,
      Map<string, CfihosExternalEquivalenceOccurrence>
    >();

    const scanSheetNames = sheetNames.filter(
      (sheetName) => sheetName !== EQUIVALENCE_SHEET,
    );

    const worksheetRows = await Promise.all(
      scanSheetNames.map(async (sheetName) => ({
        sheetName,
        rows: await getCfihosWorksheetRows(sheetName),
      })),
    );

    for (const { sheetName, rows } of worksheetRows) {
      for (const row of rows) {
        scanRowForIds(sheetName, row, unresolvedKeys, occurrenceMap);
      }
    }

    const sortedMasters = [...masterObjects]
      .map((item) => ({ item, numericId: parseNumericId(item.id) }))
      .filter(
        (item): item is { item: MasterObject; numericId: number } =>
          item.numericId !== null,
      )
      .sort((a, b) => a.numericId - b.numericId);

    const details: CfihosExternalEquivalenceOrphanDetail[] = Array.from(
      unresolvedById.entries(),
      ([normalizedId, objectMappings]) => {
        const objectId = objectMappings[0]?.objectId ?? normalizedId;
        const occurrenceEntries = Array.from(
          occurrenceMap.get(normalizedId)?.values() ?? [],
        ).sort(
          (a, b) =>
            b.count - a.count ||
            a.worksheet.localeCompare(b.worksheet) ||
            a.column.localeCompare(b.column),
        );
        const outsideMappingOccurrenceCount = occurrenceEntries.reduce(
          (sum, occurrence) => sum + occurrence.count,
          0,
        );
        const outsideMappingWorksheetCount = new Set(
          occurrenceEntries.map((occurrence) => occurrence.worksheet),
        ).size;
        const { previous, next } = findNumericNeighbors(
          objectId,
          sortedMasters,
        );
        const neighborsShareFamily =
          previous !== null &&
          next !== null &&
          normalizeKey(previous.definitionFile ?? "") !== "" &&
          normalizeKey(previous.definitionFile ?? "") ===
            normalizeKey(next.definitionFile ?? "");

        return {
          objectId,
          codingSourceCode: uniqueValues(
            objectMappings.map((item) => item.codingSourceCode),
          ).join("; "),
          equivalentValue: uniqueValues(
            objectMappings.map((item) => item.equivalentValue),
          ).join("; "),
          mappingCount: objectMappings.length,
          outsideMappingOccurrenceCount,
          outsideMappingWorksheetCount,
          occurrences: occurrenceEntries,
          previousMasterObject: previous,
          nextMasterObject: next,
          neighborsShareFamily,
        };
      },
    ).sort(
      (a, b) =>
        b.outsideMappingOccurrenceCount - a.outsideMappingOccurrenceCount ||
        a.objectId.localeCompare(b.objectId),
    );

    const sourceMap = new Map<
      string,
      { mappingCount: number; objectIds: Set<string> }
    >();
    for (const mapping of unresolvedMappings) {
      const source = mapping.codingSourceCode || "(missing)";
      const current = sourceMap.get(source) ?? {
        mappingCount: 0,
        objectIds: new Set<string>(),
      };
      current.mappingCount += 1;
      current.objectIds.add(normalizeKey(mapping.objectId));
      sourceMap.set(source, current);
    }

    const sourceSummaries: CfihosExternalEquivalenceSourceSummary[] =
      Array.from(sourceMap.entries(), ([codingSourceCode, value]) => ({
        codingSourceCode,
        unresolvedMappingCount: value.mappingCount,
        unresolvedObjectCount: value.objectIds.size,
      })).sort(
        (a, b) =>
          b.unresolvedMappingCount - a.unresolvedMappingCount ||
          a.codingSourceCode.localeCompare(b.codingSourceCode),
      );

    const resolvedMappingCount = mappings.length - unresolvedMappings.length;
    const unresolvedObjectsReferencedElsewhere = details.filter(
      (detail) => detail.outsideMappingOccurrenceCount > 0,
    ).length;
    const outsideMappingOccurrenceCount = details.reduce(
      (sum, detail) => sum + detail.outsideMappingOccurrenceCount,
      0,
    );

    const diagnostics: CfihosExternalEquivalenceOrphanAuditDiagnostics = {
      equivalenceMappingCount: mappings.length,
      resolvedMappingCount,
      unresolvedMappingCount: unresolvedMappings.length,
      unresolvedObjectCount: unresolvedById.size,
      worksheetsScanned: scanSheetNames.length,
      unresolvedObjectsReferencedElsewhere,
      mappingOnlyUnresolvedObjects:
        unresolvedById.size - unresolvedObjectsReferencedElsewhere,
      outsideMappingOccurrenceCount,
      sameFamilyNeighborGapCount: details.filter(
        (detail) => detail.neighborsShareFamily,
      ).length,
      sourceSummaries,
      details,
    };

    return { diagnostics };
  }
}

function buildMasterObject(row: CfihosWorksheetRow): MasterObject {
  return {
    id: normalizeRequiredString(row["CFIHOS unique code"]),
    name: normalizeRequiredString(row["CFIHOS name"]),
    definitionFile: normalizeOptionalString(row["CFIHOS definition file"]),
  };
}

function buildMapping(row: CfihosWorksheetRow): Mapping | null {
  const objectId = normalizeRequiredString(row["CFIHOS unique code"]);
  const codingSourceCode = normalizeRequiredString(row["coding source code"]);
  const equivalentValue = normalizeRequiredString(
    row["CFIHOS code equivalent value"],
  );
  if (!objectId || !codingSourceCode || !equivalentValue) return null;
  return { objectId, codingSourceCode, equivalentValue };
}

function scanRowForIds(
  sheetName: string,
  row: CfihosWorksheetRow,
  unresolvedKeys: Set<string>,
  occurrenceMap: Map<string, Map<string, CfihosExternalEquivalenceOccurrence>>,
): void {
  for (const [column, rawValue] of Object.entries(row)) {
    if (rawValue === null || rawValue === undefined) continue;
    const value = String(rawValue).trim();
    if (!value) continue;

    const candidates = splitPotentialIdList(value);
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeKey(candidate);
      if (!unresolvedKeys.has(normalizedCandidate)) continue;

      const byLocation = occurrenceMap.get(normalizedCandidate) ?? new Map();
      const locationKey = `${sheetName}\u0000${column}`;
      const current = byLocation.get(locationKey) ?? {
        worksheet: sheetName,
        column,
        count: 0,
      };
      current.count += 1;
      byLocation.set(locationKey, current);
      occurrenceMap.set(normalizedCandidate, byLocation);
    }
  }
}

function splitPotentialIdList(value: string): string[] {
  return value
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findNumericNeighbors(
  objectId: string,
  sortedMasters: Array<{ item: MasterObject; numericId: number }>,
): { previous: MasterObject | null; next: MasterObject | null } {
  const target = parseNumericId(objectId);
  if (target === null) return { previous: null, next: null };

  let previous: MasterObject | null = null;
  let next: MasterObject | null = null;

  for (const candidate of sortedMasters) {
    if (candidate.numericId < target) {
      previous = candidate.item;
      continue;
    }
    if (candidate.numericId > target) {
      next = candidate.item;
      break;
    }
  }

  return { previous, next };
}

function parseNumericId(value: string): number | null {
  const match = value.match(/^(?:CFIHOS-)?(\d+)$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export const cfihosExternalEquivalenceOrphanAuditRepository =
  new CfihosExternalEquivalenceOrphanAuditRepository();
