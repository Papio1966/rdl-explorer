import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";
import {
  RdlRuntimeReadInputError,
  RdlRuntimeReleaseNotFoundError,
} from "./RdlRuntimeReadService.ts";

export type CfihosSourceWorkbookSheetManifest = {
  sheetName: string;
  sheetOrder: number;
  headers: string[];
  rowCount: number;
};

export type CfihosSourceWorkbookManifest = {
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string;
  workbookSchema: "cfihos-workbook-snapshot-v1";
  generatedAt: string;
  sourceSha256: string;
  sheets: CfihosSourceWorkbookSheetManifest[];
};

export type CfihosSourceWorkbookSheet = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  contentSha256: string;
  sheetName: string;
  sheetOrder: number;
  headers: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
};

type PackageRow = {
  package_id: string;
  source_key: string;
  release_key: string;
  version_label: string;
  package_key: string;
  content_sha256: string | null;
  source_uri: string | null;
  manifest: Record<string, unknown> | null;
};

type SheetManifestRow = {
  sheet_name: string;
  sheet_order: number | string;
  headers: unknown;
  source_row_count: number | string;
  stored_row_count: number | string;
};

type SourceRecordRow = {
  record_order: number | string;
  raw_row: Record<string, unknown> | null;
};

export class CfihosSourceWorkbookService {
  constructor(private readonly client: SqlJsonClient) {}

  async manifest(input: {
    sourceKey: string;
    releaseKey: string;
  }): Promise<CfihosSourceWorkbookManifest> {
    const sourceKey = required("sourceKey", input.sourceKey);
    const releaseKey = required("releaseKey", input.releaseKey);
    const packageRow = await this.requireValidatedPackage(sourceKey, releaseKey);
    const packageId = positiveInteger("package_id", packageRow.package_id);

    const sheetRows = await this.client.query<SheetManifestRow>(`
      SELECT ss.sheet_name,
             ss.sheet_order,
             ss.headers,
             ss.source_row_count,
             count(sr.source_record_id)::int AS stored_row_count
      FROM rdl.rdl_source_sheet ss
      LEFT JOIN rdl.rdl_source_record sr
        ON sr.source_sheet_id = ss.source_sheet_id
       AND sr.package_id = ss.package_id
      WHERE ss.package_id = ${packageId}
      GROUP BY ss.source_sheet_id, ss.sheet_name, ss.sheet_order, ss.headers, ss.source_row_count
      ORDER BY ss.sheet_order, ss.source_sheet_id
    `);

    const sheets = sheetRows.map((row) => {
      const rowCount = nonNegativeInteger("source_row_count", row.source_row_count);
      const storedRowCount = nonNegativeInteger("stored_row_count", row.stored_row_count);
      if (rowCount !== storedRowCount) {
        throw new Error(
          `CFIHOS source sheet '${row.sheet_name}' is incomplete: expected ${rowCount} rows, found ${storedRowCount}.`,
        );
      }
      return {
        sheetName: required("sheet_name", row.sheet_name),
        sheetOrder: nonNegativeInteger("sheet_order", row.sheet_order),
        headers: stringArray("headers", row.headers),
        rowCount,
      };
    });

    if (sheets.length === 0) {
      throw new Error(`CFIHOS package '${packageRow.package_key}' has no lossless source sheets.`);
    }

    return this.buildManifest(packageRow, sheets);
  }

  async sheet(input: {
    sourceKey: string;
    releaseKey: string;
    packageKey: string;
    sheetName: string;
  }): Promise<CfihosSourceWorkbookSheet> {
    const sourceKey = required("sourceKey", input.sourceKey);
    const releaseKey = required("releaseKey", input.releaseKey);
    const packageKey = required("packageKey", input.packageKey);
    const sheetName = required("sheetName", input.sheetName);
    const packageRow = await this.requireValidatedPackage(sourceKey, releaseKey, packageKey);
    const packageId = positiveInteger("package_id", packageRow.package_id);

    const sheetRows = await this.client.query<SheetManifestRow>(`
      SELECT ss.sheet_name,
             ss.sheet_order,
             ss.headers,
             ss.source_row_count,
             count(sr.source_record_id)::int AS stored_row_count
      FROM rdl.rdl_source_sheet ss
      LEFT JOIN rdl.rdl_source_record sr
        ON sr.source_sheet_id = ss.source_sheet_id
       AND sr.package_id = ss.package_id
      WHERE ss.package_id = ${packageId}
        AND ss.sheet_name = ${sqlLiteral(sheetName)}
      GROUP BY ss.source_sheet_id, ss.sheet_name, ss.sheet_order, ss.headers, ss.source_row_count
      LIMIT 1
    `);
    const sheetRow = sheetRows[0];
    if (!sheetRow) {
      throw new RdlRuntimeReleaseNotFoundError(
        `CFIHOS worksheet '${sheetName}' was not found in package '${packageKey}'.`,
      );
    }

    const rowCount = nonNegativeInteger("source_row_count", sheetRow.source_row_count);
    const storedRowCount = nonNegativeInteger("stored_row_count", sheetRow.stored_row_count);
    if (rowCount !== storedRowCount) {
      throw new Error(
        `CFIHOS source sheet '${sheetName}' is incomplete: expected ${rowCount} rows, found ${storedRowCount}.`,
      );
    }

    const sourceRows = await this.client.query<SourceRecordRow>(`
      SELECT sr.record_order, sr.raw_row
      FROM rdl.rdl_source_record sr
      JOIN rdl.rdl_source_sheet ss
        ON ss.source_sheet_id = sr.source_sheet_id
       AND ss.package_id = sr.package_id
      WHERE sr.package_id = ${packageId}
        AND ss.sheet_name = ${sqlLiteral(sheetName)}
      ORDER BY sr.record_order, sr.source_record_id
    `);
    const rows = sourceRows.map((row, index) => {
      const expectedOrder = index;
      const actualOrder = nonNegativeInteger("record_order", row.record_order);
      if (actualOrder !== expectedOrder) {
        throw new Error(
          `CFIHOS source sheet '${sheetName}' zero-based record order is not contiguous at ${expectedOrder}; found ${actualOrder}.`,
        );
      }
      if (!row.raw_row || typeof row.raw_row !== "object" || Array.isArray(row.raw_row)) {
        throw new Error(`CFIHOS source sheet '${sheetName}' contains an invalid JSON source row.`);
      }
      return row.raw_row;
    });

    if (rows.length !== rowCount) {
      throw new Error(
        `CFIHOS source sheet '${sheetName}' returned ${rows.length} rows but declares ${rowCount}.`,
      );
    }

    const contentSha256 = required("content_sha256", packageRow.content_sha256);
    return {
      sourceKey: packageRow.source_key,
      releaseKey: packageRow.release_key,
      packageKey: packageRow.package_key,
      contentSha256,
      sheetName: required("sheet_name", sheetRow.sheet_name),
      sheetOrder: nonNegativeInteger("sheet_order", sheetRow.sheet_order),
      headers: stringArray("headers", sheetRow.headers),
      rowCount,
      rows,
    };
  }

  private buildManifest(
    packageRow: PackageRow,
    sheets: CfihosSourceWorkbookSheetManifest[],
  ): CfihosSourceWorkbookManifest {
    const manifest = objectValue("manifest", packageRow.manifest);
    const workbookSchema = required("manifest.schema", manifest.schema);
    if (workbookSchema !== "cfihos-workbook-snapshot-v1") {
      throw new Error(`Unsupported CFIHOS workbook manifest schema '${workbookSchema}'.`);
    }

    const contentSha256 = required("content_sha256", packageRow.content_sha256);
    const sourceSha256 = required("manifest.sourceSha256", manifest.sourceSha256);
    if (sourceSha256 !== contentSha256) {
      throw new Error(
        `CFIHOS package source SHA mismatch: manifest=${sourceSha256} package=${contentSha256}.`,
      );
    }

    return {
      sourceKey: packageRow.source_key,
      releaseKey: packageRow.release_key,
      versionLabel: required("version_label", packageRow.version_label),
      packageKey: required("package_key", packageRow.package_key),
      contentSha256,
      sourceUri: required("source_uri", packageRow.source_uri),
      workbookSchema,
      generatedAt: required("manifest.generatedAt", manifest.generatedAt),
      sourceSha256,
      sheets,
    };
  }

  private async requireValidatedPackage(
    sourceKey: string,
    releaseKey: string,
    packageKey?: string,
  ): Promise<PackageRow> {
    const packagePredicate = packageKey
      ? `AND p.package_key = ${sqlLiteral(packageKey)}`
      : "";
    const rows = await this.client.query<PackageRow>(`
      SELECT p.package_id::text,
             s.source_key,
             r.release_key,
             r.version_label,
             p.package_key,
             p.content_sha256,
             p.source_uri,
             p.manifest
      FROM rdl.rdl_package p
      JOIN rdl.rdl_release r ON r.release_id = p.release_id
      JOIN rdl.rdl_source s ON s.source_id = r.source_id
      WHERE p.package_status = 'validated'
        AND s.source_key = ${sqlLiteral(sourceKey)}
        AND r.release_key = ${sqlLiteral(releaseKey)}
        ${packagePredicate}
      ORDER BY p.package_id DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) {
      const suffix = packageKey ? ` package '${packageKey}'` : "";
      throw new RdlRuntimeReleaseNotFoundError(
        `RDL release '${sourceKey}/${releaseKey}'${suffix} was not found.`,
      );
    }
    return row;
  }
}

function required(name: string, value: unknown): string {
  const result = String(value ?? "").trim();
  if (!result) throw new RdlRuntimeReadInputError(`${name} is required.`);
  return result;
}

function positiveInteger(name: string, value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} returned an invalid positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(name: string, value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} returned an invalid non-negative integer.`);
  }
  return parsed;
}

function objectValue(name: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} returned an invalid JSON object.`);
  }
  return value as Record<string, unknown>;
}

function stringArray(name: string, value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${name} returned an invalid string array.`);
  }
  return [...value];
}
