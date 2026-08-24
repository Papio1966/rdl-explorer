import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosPropertyGroupingPurposeFamilyDiagnostics,
  CfihosPropertyGroupingPurposeMasterObject,
} from "../model/propertyGroupingPurposeFamily";

const MASTER_SHEET = "RDL master object";
const GROUPING_SHEET = "property groupings";
const PURPOSE_FAMILY = "property grouping or decomposition purpose";

export class CfihosPropertyGroupingPurposeFamilyRepository {
  private diagnostics: CfihosPropertyGroupingPurposeFamilyDiagnostics | null = null;
  private loadingPromise: Promise<CfihosPropertyGroupingPurposeFamilyDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosPropertyGroupingPurposeFamilyDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.loadDiagnostics();

    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadDiagnostics(): Promise<CfihosPropertyGroupingPurposeFamilyDiagnostics> {
    const [masterRows, groupingRows] = await Promise.all([
      getCfihosWorksheetRows(MASTER_SHEET),
      getCfihosWorksheetRows(GROUPING_SHEET),
    ]);

    const purposes = masterRows
      .filter(
        (row) =>
          normalizeKey(row["CFIHOS definition file"]) === PURPOSE_FAMILY,
      )
      .map(buildPurpose)
      .filter((item) => item.id.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const masterIds = purposes.map((item) => normalizeKey(item.id));
    const masterIdSet = new Set(masterIds);

    const purposeReferences = groupingRows
      .map((row) =>
        normalizeRequiredString(
          row["property grouping or decomposition purpose CFIHOS unique code"],
        ),
      )
      .filter(Boolean);

    const uniquePurposeIds = Array.from(
      new Set(purposeReferences.map(normalizeKey).filter(Boolean)),
    );
    const resolvedPurposeIds = uniquePurposeIds.filter((id) => masterIdSet.has(id));
    const unresolvedPurposeIds = uniquePurposeIds.filter((id) => !masterIdSet.has(id));
    const referencedMasterIdSet = new Set(resolvedPurposeIds);

    const masterOnlyPurposes = purposes.filter(
      (item) => !referencedMasterIdSet.has(normalizeKey(item.id)),
    );

    const referencedMasterPurposeCount = referencedMasterIdSet.size;
    const purposeCoveragePercent =
      purposes.length === 0
        ? 100
        : Math.round((referencedMasterPurposeCount / purposes.length) * 10000) / 100;

    return {
      masterPurposeCount: purposes.length,
      uniqueMasterPurposeIdCount: new Set(masterIds).size,
      duplicateMasterPurposeIdCount: countDuplicates(masterIds),

      groupingRowCount: groupingRows.length,
      rowsWithPurposeReferenceCount: purposeReferences.length,
      uniquePurposeReferenceCount: uniquePurposeIds.length,
      resolvedPurposeReferenceCount: resolvedPurposeIds.length,
      unresolvedPurposeReferenceCount: unresolvedPurposeIds.length,

      referencedMasterPurposeCount,
      masterOnlyPurposeCount: masterOnlyPurposes.length,
      purposeCoveragePercent,

      purposes,
      masterOnlyPurposes,
      unresolvedPurposeIds: unresolvedPurposeIds.sort(),
    };
  }
}

function buildPurpose(row: CfihosWorksheetRow): CfihosPropertyGroupingPurposeMasterObject {
  return {
    id: normalizeRequiredString(row["CFIHOS unique code"]),
    name: normalizeRequiredString(row["CFIHOS name"]),
    description: normalizeOptionalString(row["CFIHOS description"]),
  };
}

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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

export const cfihosPropertyGroupingPurposeFamilyRepository =
  new CfihosPropertyGroupingPurposeFamilyRepository();
