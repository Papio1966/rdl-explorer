export type CfihosWorksheetRow = Record<string, unknown>;

export type CfihosWorksheetInspection = {
  sheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows: CfihosWorksheetRow[];
};

export type CfihosWorkbookSnapshot = {
  schema: "cfihos-workbook-snapshot-v1";
  source: {
    url: string;
    generatedAt: string;
    sha256: string;
  };
  sheetNames: string[];
  sheets: Record<
    string,
    {
      headers: string[];
      rows: CfihosWorksheetRow[];
    }
  >;
};

const SNAPSHOT_URL = "/cfihos-workbook.json";

let cachedSnapshot: CfihosWorkbookSnapshot | null = null;
let snapshotPromise: Promise<CfihosWorkbookSnapshot> | null = null;

function assertSnapshot(value: unknown): asserts value is CfihosWorkbookSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("The CFIHOS workbook snapshot is not a JSON object.");
  }

  const candidate = value as Partial<CfihosWorkbookSnapshot>;
  if (candidate.schema !== "cfihos-workbook-snapshot-v1") {
    throw new Error(
      `Unsupported CFIHOS workbook snapshot schema: ${String(candidate.schema ?? "missing")}.`,
    );
  }

  if (!Array.isArray(candidate.sheetNames) || !candidate.sheets || typeof candidate.sheets !== "object") {
    throw new Error("The CFIHOS workbook snapshot is missing sheet metadata.");
  }
}

export async function loadCfihosWorkbook(): Promise<CfihosWorkbookSnapshot> {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  if (snapshotPromise) {
    return snapshotPromise;
  }

  snapshotPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(SNAPSHOT_URL, { cache: "no-cache" });
    } catch (error) {
      throw new Error(
        `Unable to load the generated CFIHOS workbook snapshot: ${
          error instanceof Error ? error.message : "Unknown network error"
        }`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Unable to load ${SNAPSHOT_URL}: ${response.status} ${response.statusText}. ` +
          "Generate the snapshot with `npx tsx scripts/generate-workbook-snapshot.ts`.",
      );
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (error) {
      throw new Error(
        `The generated CFIHOS workbook snapshot could not be parsed as JSON: ${
          error instanceof Error ? error.message : "Unknown parsing error"
        }`,
      );
    }

    assertSnapshot(parsed);
    cachedSnapshot = parsed;
    return parsed;
  })();

  try {
    return await snapshotPromise;
  } finally {
    snapshotPromise = null;
  }
}

export async function getCfihosSheetNames(): Promise<string[]> {
  const workbook = await loadCfihosWorkbook();
  return [...workbook.sheetNames];
}

export async function getCfihosWorksheetRows(
  sheetName: string,
): Promise<CfihosWorksheetRow[]> {
  const workbook = await loadCfihosWorkbook();
  const sheet = workbook.sheets[sheetName];

  if (!sheet) {
    throw new Error(`The worksheet "${sheetName}" was not found in the CFIHOS workbook snapshot.`);
  }

  return sheet.rows;
}

export async function getCfihosWorksheetHeaders(
  sheetName: string,
): Promise<string[]> {
  const workbook = await loadCfihosWorkbook();
  const sheet = workbook.sheets[sheetName];

  if (!sheet) {
    throw new Error(`The worksheet "${sheetName}" was not found in the CFIHOS workbook snapshot.`);
  }

  return sheet.headers;
}

export async function inspectCfihosWorksheet(
  sheetName: string,
  sampleSize = 5,
): Promise<CfihosWorksheetInspection> {
  const workbook = await loadCfihosWorkbook();
  const sheet = workbook.sheets[sheetName];

  if (!sheet) {
    throw new Error(`The worksheet "${sheetName}" was not found in the CFIHOS workbook snapshot.`);
  }

  return {
    sheetName,
    headers: sheet.headers,
    rowCount: sheet.rows.length,
    sampleRows: sheet.rows.slice(0, sampleSize),
  };
}

export function clearCfihosWorkbookCache(): void {
  cachedSnapshot = null;
  snapshotPromise = null;
}
