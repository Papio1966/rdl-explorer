import {
  getCfihosSheetNames,
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosReferenceDateFieldUsage,
  CfihosSubmissionReferenceDateFamilyDiagnostics,
  CfihosSubmissionReferenceDateMasterObject,
  CfihosSubmissionReferenceDateOccurrence,
} from "../model/submissionReferenceDateFamily";

const MASTER_SHEET = "RDL master object";
const FAMILY = "submission reference date";

export class CfihosSubmissionReferenceDateFamilyRepository {
  private diagnostics: CfihosSubmissionReferenceDateFamilyDiagnostics | null = null;
  private loadingPromise: Promise<CfihosSubmissionReferenceDateFamilyDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosSubmissionReferenceDateFamilyDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.buildDiagnostics();
    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildDiagnostics(): Promise<CfihosSubmissionReferenceDateFamilyDiagnostics> {
    const [sheetNames, masterRows] = await Promise.all([
      getCfihosSheetNames(),
      getCfihosWorksheetRows(MASTER_SHEET),
    ]);

    const masterObjects = buildMasterObjects(masterRows);
    const byId = new Map(masterObjects.map((item) => [item.id, item]));
    const byNormalizedName = new Map(
      masterObjects.map((item) => [normalize(item.name), item]),
    );

    const referencedIds = new Set<string>();
    const occurrences: CfihosSubmissionReferenceDateOccurrence[] = [];
    const referenceDateFields: CfihosReferenceDateFieldUsage[] = [];
    let idOccurrenceCount = 0;
    let nameOccurrenceCount = 0;
    let populatedReferenceDateValueCount = 0;
    let referenceDateMasterIdMatchCount = 0;
    let referenceDateMasterNameMatchCount = 0;

    const sheets = sheetNames.filter((name) => name !== MASTER_SHEET);
    const allRows = await Promise.all(
      sheets.map(async (sheetName) => ({
        sheetName,
        rows: await getCfihosWorksheetRows(sheetName),
      })),
    );

    for (const { sheetName, rows } of allRows) {
      const headers = collectHeaders(rows);
      const referenceDateHeaders = headers.filter((header) =>
        normalize(header).includes("reference date"),
      );

      for (const header of referenceDateHeaders) {
        const values: string[] = [];
        let masterIdMatchCount = 0;
        let masterNameMatchCount = 0;

        for (const row of rows) {
          const value = asString(row[header]);
          if (!value) continue;
          values.push(value);
          populatedReferenceDateValueCount += 1;

          if (byId.has(value)) {
            masterIdMatchCount += 1;
            referenceDateMasterIdMatchCount += 1;
          }
          if (byNormalizedName.has(normalize(value))) {
            masterNameMatchCount += 1;
            referenceDateMasterNameMatchCount += 1;
          }
        }

        referenceDateFields.push({
          sheetName,
          columnName: header,
          nonEmptyValueCount: values.length,
          uniqueValueCount: new Set(values.map(normalize)).size,
          masterIdMatchCount,
          masterNameMatchCount,
          sampleValues: [...new Set(values)].slice(0, 8),
        });
      }

      rows.forEach((row, rowIndex) => {
        for (const [columnName, rawValue] of Object.entries(row)) {
          const value = asString(rawValue);
          if (!value) continue;

          const idMatch = byId.get(value);
          if (idMatch) {
            idOccurrenceCount += 1;
            referencedIds.add(idMatch.id);
            occurrences.push({
              sheetName,
              excelRow: rowIndex + 2,
              columnName,
              matchedBy: "id",
              objectId: idMatch.id,
              objectName: idMatch.name,
              value,
            });
            continue;
          }

          const nameMatch = byNormalizedName.get(normalize(value));
          if (nameMatch) {
            nameOccurrenceCount += 1;
            referencedIds.add(nameMatch.id);
            occurrences.push({
              sheetName,
              excelRow: rowIndex + 2,
              columnName,
              matchedBy: "name",
              objectId: nameMatch.id,
              objectName: nameMatch.name,
              value,
            });
          }
        }
      });
    }

    referenceDateFields.sort(
      (a, b) =>
        b.nonEmptyValueCount - a.nonEmptyValueCount ||
        a.sheetName.localeCompare(b.sheetName) ||
        a.columnName.localeCompare(b.columnName),
    );

    return {
      masterObjectCount: masterObjects.length,
      worksheetsScannedCount: sheetNames.length,
      idOccurrenceCount,
      nameOccurrenceCount,
      referencedMasterObjectCount: referencedIds.size,
      masterOnlyObjectCount: masterObjects.length - referencedIds.size,
      referenceDateFieldCount: referenceDateFields.length,
      populatedReferenceDateValueCount,
      referenceDateMasterIdMatchCount,
      referenceDateMasterNameMatchCount,
      masterObjects,
      occurrences: occurrences.slice(0, 80),
      referenceDateFields,
    };
  }
}

function buildMasterObjects(
  rows: CfihosWorksheetRow[],
): CfihosSubmissionReferenceDateMasterObject[] {
  return rows
    .filter(
      (row) =>
        normalize(asString(row["CFIHOS definition file"])) === FAMILY,
    )
    .map((row) => ({
      id: asString(row["CFIHOS unique code"]),
      name: asString(row["CFIHOS name"]),
      description: asString(row["CFIHOS description"]) || null,
    }))
    .filter((item) => item.id.length > 0 && item.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectHeaders(rows: CfihosWorksheetRow[]): string[] {
  const headers = new Set<string>();
  for (const row of rows.slice(0, 50)) {
    Object.keys(row).forEach((header) => headers.add(header));
  }
  return [...headers];
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export const cfihosSubmissionReferenceDateFamilyRepository =
  new CfihosSubmissionReferenceDateFamilyRepository();
