import {
  getCfihosSheetNames,
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosRequirementOrphanObjectAudit,
  CfihosRequirementOrphanOccurrence,
  CfihosSourceStandardRequirementOrphanAuditDiagnostics,
} from "../model/sourceStandardRequirementOrphanAudit";

const MASTER_SHEET = "RDL master object";

const TARGET_IDS = [
  "CFIHOS-68001699",
  "CFIHOS-68001704",
  "CFIHOS-68001705",
  "CFIHOS-68001707",
] as const;

export class CfihosSourceStandardRequirementOrphanAuditRepository {
  private diagnostics: CfihosSourceStandardRequirementOrphanAuditDiagnostics | null = null;
  private loadingPromise: Promise<CfihosSourceStandardRequirementOrphanAuditDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosSourceStandardRequirementOrphanAuditDiagnostics> {
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

  private async buildDiagnostics(): Promise<CfihosSourceStandardRequirementOrphanAuditDiagnostics> {
    const sheetNames = await getCfihosSheetNames();
    const targetSet = new Set<string>(TARGET_IDS);
    const occurrencesById = new Map<string, CfihosRequirementOrphanOccurrence[]>();
    const namesById = new Map<string, string>();

    for (const id of TARGET_IDS) {
      occurrencesById.set(id, []);
    }

    const sheets = await Promise.all(
      sheetNames.map(async (worksheetName) => ({
        worksheetName,
        rows: await getCfihosWorksheetRows(worksheetName),
      })),
    );

    for (const { worksheetName, rows } of sheets) {
      rows.forEach((row, rowIndex) => {
        const matches = findTargetMatches(row, targetSet);

        for (const [id, matchingColumns] of matches) {
          occurrencesById.get(id)?.push({
            worksheetName,
            rowNumber: rowIndex + 2,
            matchingColumns,
            context: buildContext(row, matchingColumns),
          });

          if (worksheetName === MASTER_SHEET) {
            const name = firstString(row, [
              "CFIHOS name",
              "source standard document and data requirement name",
              "name",
            ]);

            if (name) {
              namesById.set(id, name);
            }
          }
        }
      });
    }

    const objects: CfihosRequirementOrphanObjectAudit[] = TARGET_IDS.map((id) => {
      const occurrences = occurrencesById.get(id) ?? [];
      const nonMasterOccurrenceCount = occurrences.filter(
        (occurrence) => occurrence.worksheetName !== MASTER_SHEET,
      ).length;

      return {
        id,
        name: namesById.get(id) ?? null,
        occurrenceCount: occurrences.length,
        nonMasterOccurrenceCount,
        occurrences: [...occurrences].sort(compareOccurrences),
      };
    });

    return {
      targetObjectCount: TARGET_IDS.length,
      workbookWorksheetCount: sheetNames.length,
      totalOccurrenceCount: objects.reduce(
        (total, item) => total + item.occurrenceCount,
        0,
      ),
      objectsWithOnlyMasterOccurrenceCount: objects.filter(
        (item) =>
          item.occurrenceCount > 0 &&
          item.nonMasterOccurrenceCount === 0 &&
          item.occurrences.some(
            (occurrence) => occurrence.worksheetName === MASTER_SHEET,
          ),
      ).length,
      objectsWithAdditionalOccurrencesCount: objects.filter(
        (item) => item.nonMasterOccurrenceCount > 0,
      ).length,
      objectsNotFoundCount: objects.filter(
        (item) => item.occurrenceCount === 0,
      ).length,
      objects,
    };
  }
}

function findTargetMatches(
  row: CfihosWorksheetRow,
  targetSet: Set<string>,
): Map<string, string[]> {
  const matches = new Map<string, string[]>();

  for (const [column, rawValue] of Object.entries(row)) {
    const normalized = normalizeCell(rawValue);

    if (!targetSet.has(normalized)) {
      continue;
    }

    const columns = matches.get(normalized) ?? [];
    columns.push(column);
    matches.set(normalized, columns);
  }

  return matches;
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toUpperCase();
}

function firstString(
  row: CfihosWorksheetRow,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];

    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function buildContext(
  row: CfihosWorksheetRow,
  matchingColumns: string[],
): string {
  const preferredKeys = [
    "CFIHOS name",
    "class name",
    "tag class name",
    "equipment class name",
    "document type name",
    "source standard code",
    "source standard name",
    "requirement title",
    "requirement description",
    "discipline name",
  ];

  const parts: string[] = [];
  const used = new Set<string>(matchingColumns);

  for (const key of preferredKeys) {
    if (used.has(key)) {
      continue;
    }

    const value = row[key];
    if (value === null || value === undefined || String(value).trim() === "") {
      continue;
    }

    parts.push(`${key}: ${String(value).trim()}`);
    used.add(key);

    if (parts.length >= 4) {
      return parts.join(" | ");
    }
  }

  for (const [key, value] of Object.entries(row)) {
    if (used.has(key)) {
      continue;
    }

    if (value === null || value === undefined || String(value).trim() === "") {
      continue;
    }

    const text = String(value).trim();
    parts.push(`${key}: ${text.length > 120 ? `${text.slice(0, 117)}...` : text}`);

    if (parts.length >= 4) {
      break;
    }
  }

  return parts.length > 0 ? parts.join(" | ") : "—";
}

function compareOccurrences(
  a: CfihosRequirementOrphanOccurrence,
  b: CfihosRequirementOrphanOccurrence,
): number {
  if (a.worksheetName === MASTER_SHEET && b.worksheetName !== MASTER_SHEET) {
    return -1;
  }

  if (b.worksheetName === MASTER_SHEET && a.worksheetName !== MASTER_SHEET) {
    return 1;
  }

  const sheetComparison = a.worksheetName.localeCompare(
    b.worksheetName,
    undefined,
    { sensitivity: "base" },
  );

  return sheetComparison !== 0
    ? sheetComparison
    : a.rowNumber - b.rowNumber;
}

export const cfihosSourceStandardRequirementOrphanAuditRepository =
  new CfihosSourceStandardRequirementOrphanAuditRepository();
