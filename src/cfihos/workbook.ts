import {
  getRdlBrowserReadMode,
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
  type RdlBrowserReadMode,
} from "../rdl/runtimeDualRead";

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

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RuntimeWorkbookSheetManifest = {
  sheetName: string;
  sheetOrder: number;
  headers: string[];
  rowCount: number;
};

type RuntimeWorkbookManifestResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string;
  workbookSchema: string;
  generatedAt: string;
  sourceSha256: string;
  sheets: RuntimeWorkbookSheetManifest[];
};

type RuntimeWorkbookSheetResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  contentSha256: string;
  sheetName: string;
  sheetOrder: number;
  headers: string[];
  rowCount: number;
  rows: CfihosWorksheetRow[];
};

export type CfihosWorkbookRuntimeOptions = {
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  reference?: CfihosWorkbookSnapshot;
};

const SNAPSHOT_URL = "/cfihos-workbook.json";
const RUNTIME_WORKBOOK_URL = "/api/rdl-runtime/cfihos-workbook";
const CFIHOS_SOURCE_KEY = "cfihos";
const CFIHOS_RELEASE_KEY = "cfihos-2.0";
const SHEET_FETCH_CONCURRENCY = 4;

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

  if (!candidate.source || typeof candidate.source !== "object") {
    throw new Error("The CFIHOS workbook snapshot is missing source metadata.");
  }

  if (
    !Array.isArray(candidate.sheetNames)
    || !candidate.sheets
    || typeof candidate.sheets !== "object"
  ) {
    throw new Error("The CFIHOS workbook snapshot is missing sheet metadata.");
  }
}

export async function loadCfihosWorkbook(
  options: CfihosWorkbookRuntimeOptions = {},
): Promise<CfihosWorkbookSnapshot> {
  const usesDefaultRuntime =
    options.mode === undefined
    && options.fetcher === undefined
    && options.reference === undefined;

  if (!usesDefaultRuntime) {
    return loadCfihosWorkbookUncached(options);
  }

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  if (snapshotPromise) {
    return snapshotPromise;
  }

  snapshotPromise = loadCfihosWorkbookUncached({});

  try {
    const snapshot = await snapshotPromise;
    cachedSnapshot = snapshot;
    return snapshot;
  } finally {
    snapshotPromise = null;
  }
}

async function loadCfihosWorkbookUncached(
  options: CfihosWorkbookRuntimeOptions,
): Promise<CfihosWorkbookSnapshot> {
  const mode = options.mode ?? defaultWorkbookReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return loadRuntimeWorkbook(fetcher);
  }

  const reference = options.reference ?? await loadSnapshotReference(fetcher);
  if (mode === "json") {
    return reference;
  }

  const runtime = await loadRuntimeWorkbook(fetcher);
  compareWorkbookSnapshots(reference, runtime);
  return runtime;
}

function defaultWorkbookReadMode(): RdlBrowserReadMode {
  // Repository/CLI tests execute source repositories directly without an HTTP
  // application server. Keep that deterministic Node-only harness on the
  // immutable JSON reference unless a test explicitly requests api/dual mode.
  // Browser runtime continues to use the established global read-mode policy.
  if (typeof window === "undefined") return "json";
  return getRdlBrowserReadMode();
}

async function loadSnapshotReference(fetcher: FetchLike): Promise<CfihosWorkbookSnapshot> {
  let response: Response;
  try {
    response = await fetcher(SNAPSHOT_URL, { cache: "no-cache" });
  } catch (error) {
    throw new Error(
      `Unable to load the generated CFIHOS workbook snapshot: ${
        error instanceof Error ? error.message : "Unknown network error"
      }`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load ${SNAPSHOT_URL}: ${response.status} ${response.statusText}. `
        + "Generate the snapshot with `npx tsx scripts/generate-workbook-snapshot.ts`.",
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
  return parsed;
}

async function loadRuntimeWorkbook(fetcher: FetchLike): Promise<CfihosWorkbookSnapshot> {
  const manifestParams = new URLSearchParams({
    sourceKey: CFIHOS_SOURCE_KEY,
    releaseKey: CFIHOS_RELEASE_KEY,
  });
  const manifestPath = `${RUNTIME_WORKBOOK_URL}?${manifestParams.toString()}`;
  const manifest = await fetchRuntimeJson<RuntimeWorkbookManifestResponse>(
    fetcher,
    manifestPath,
    "rdl-cfihos-workbook-manifest/v1",
  );
  assertManifest(manifest, manifestPath);

  const orderedSheets = [...manifest.sheets].sort(
    (a, b) => a.sheetOrder - b.sheetOrder,
  );
  assertContiguousSheetOrder(orderedSheets, manifestPath);

  const sheetPayloads = await mapWithConcurrency(
    orderedSheets,
    SHEET_FETCH_CONCURRENCY,
    async (sheet) => {
      const params = new URLSearchParams({
        sourceKey: CFIHOS_SOURCE_KEY,
        releaseKey: CFIHOS_RELEASE_KEY,
        packageKey: manifest.packageKey,
        sheetName: sheet.sheetName,
      });
      const path = `${RUNTIME_WORKBOOK_URL}?${params.toString()}`;
      const payload = await fetchRuntimeJson<RuntimeWorkbookSheetResponse>(
        fetcher,
        path,
        "rdl-cfihos-workbook-sheet/v1",
      );
      assertSheetPayload(manifest, sheet, payload, path);
      return payload;
    },
  );

  const sheets: CfihosWorkbookSnapshot["sheets"] = {};
  for (const payload of sheetPayloads) {
    sheets[payload.sheetName] = {
      headers: [...payload.headers],
      rows: payload.rows,
    };
  }

  const workbook: CfihosWorkbookSnapshot = {
    schema: "cfihos-workbook-snapshot-v1",
    source: {
      url: manifest.sourceUri,
      generatedAt: manifest.generatedAt,
      sha256: manifest.contentSha256,
    },
    sheetNames: orderedSheets.map((sheet) => sheet.sheetName),
    sheets,
  };
  assertSnapshot(workbook);
  return workbook;
}

async function fetchRuntimeJson<T>(
  fetcher: FetchLike,
  path: string,
  expectedSchema: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(path, { cache: "no-cache" });
  } catch (error) {
    throw runtimeFailure(
      `${path} could not be reached: ${error instanceof Error ? error.message : "Unknown network error"}`,
    );
  }
  if (!response.ok) {
    throw runtimeFailure(`${path} returned HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw runtimeFailure(
      `${path} returned invalid JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`,
    );
  }

  if (!payload || typeof payload !== "object") {
    throw runtimeFailure(`${path} returned a non-object payload.`);
  }
  const schemaVersion = String((payload as { schemaVersion?: unknown }).schemaVersion ?? "");
  if (schemaVersion !== expectedSchema) {
    throw runtimeFailure(
      `${path} returned schema '${schemaVersion || "missing"}', expected '${expectedSchema}'.`,
    );
  }
  return payload as T;
}

function assertManifest(
  manifest: RuntimeWorkbookManifestResponse,
  path: string,
) {
  if (
    manifest.sourceKey !== CFIHOS_SOURCE_KEY
    || manifest.releaseKey !== CFIHOS_RELEASE_KEY
  ) {
    throw runtimeFailure(`${path} returned the wrong source/release identity.`);
  }
  if (manifest.workbookSchema !== "cfihos-workbook-snapshot-v1") {
    throw runtimeFailure(`${path} returned an unsupported workbook schema.`);
  }
  if (!manifest.packageKey || !manifest.contentSha256 || !manifest.sourceUri || !manifest.generatedAt) {
    throw runtimeFailure(`${path} returned incomplete package/source metadata.`);
  }
  if (manifest.sourceSha256 !== manifest.contentSha256) {
    throw runtimeFailure(`${path} returned conflicting source fingerprints.`);
  }
  if (!Array.isArray(manifest.sheets) || manifest.sheets.length === 0) {
    throw runtimeFailure(`${path} returned no worksheet manifest.`);
  }
  const names = new Set<string>();
  for (const sheet of manifest.sheets) {
    if (!sheet.sheetName || names.has(sheet.sheetName)) {
      throw runtimeFailure(`${path} returned duplicate or missing worksheet names.`);
    }
    names.add(sheet.sheetName);
    if (!Number.isSafeInteger(sheet.sheetOrder) || sheet.sheetOrder < 0) {
      throw runtimeFailure(`${path} returned invalid worksheet order.`);
    }
    if (!Number.isSafeInteger(sheet.rowCount) || sheet.rowCount < 0) {
      throw runtimeFailure(`${path} returned invalid worksheet row count.`);
    }
    if (!Array.isArray(sheet.headers) || !sheet.headers.every((header) => typeof header === "string")) {
      throw runtimeFailure(`${path} returned invalid worksheet headers.`);
    }
  }
}

function assertContiguousSheetOrder(
  sheets: RuntimeWorkbookSheetManifest[],
  path: string,
) {
  sheets.forEach((sheet, index) => {
    if (sheet.sheetOrder !== index) {
      throw runtimeFailure(
        `${path} worksheet order is not contiguous at ${index}; found ${sheet.sheetOrder}.`,
      );
    }
  });
}

function assertSheetPayload(
  manifest: RuntimeWorkbookManifestResponse,
  expected: RuntimeWorkbookSheetManifest,
  payload: RuntimeWorkbookSheetResponse,
  path: string,
) {
  if (
    payload.sourceKey !== manifest.sourceKey
    || payload.releaseKey !== manifest.releaseKey
    || payload.packageKey !== manifest.packageKey
    || payload.contentSha256 !== manifest.contentSha256
  ) {
    throw runtimeFailure(`${path} returned a package identity different from the locked manifest.`);
  }
  if (payload.sheetName !== expected.sheetName || payload.sheetOrder !== expected.sheetOrder) {
    throw runtimeFailure(`${path} returned the wrong worksheet identity/order.`);
  }
  if (!sameJson(payload.headers, expected.headers)) {
    throw runtimeFailure(`${path} returned worksheet headers different from the manifest.`);
  }
  if (payload.rowCount !== expected.rowCount || payload.rows.length !== expected.rowCount) {
    throw runtimeFailure(`${path} returned a worksheet row-count mismatch.`);
  }
  if (!payload.rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    throw runtimeFailure(`${path} returned an invalid worksheet row.`);
  }
}

function compareWorkbookSnapshots(
  reference: CfihosWorkbookSnapshot,
  runtime: CfihosWorkbookSnapshot,
) {
  if (reference.schema !== runtime.schema) {
    throw dualMismatch("workbook schema differs");
  }
  if (!sameJson(reference.source, runtime.source)) {
    throw dualMismatch("workbook source metadata differs");
  }
  if (!sameJson(reference.sheetNames, runtime.sheetNames)) {
    throw dualMismatch("worksheet order/names differ");
  }

  for (const sheetName of reference.sheetNames) {
    const referenceSheet = reference.sheets[sheetName];
    const runtimeSheet = runtime.sheets[sheetName];
    if (!referenceSheet || !runtimeSheet) {
      throw dualMismatch(`worksheet '${sheetName}' is missing`);
    }
    if (!sameJson(referenceSheet.headers, runtimeSheet.headers)) {
      throw dualMismatch(`worksheet '${sheetName}' headers differ`);
    }
    if (referenceSheet.rows.length !== runtimeSheet.rows.length) {
      throw dualMismatch(`worksheet '${sheetName}' row count differs`);
    }
    for (let index = 0; index < referenceSheet.rows.length; index += 1) {
      if (!sameJson(referenceSheet.rows[index], runtimeSheet.rows[index])) {
        throw dualMismatch(`worksheet '${sheetName}' row ${index + 1} differs`);
      }
    }
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) },
      () => worker(),
    ),
  );
  return results;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b));
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalJson(item)]),
    );
  }
  return value;
}

function dualMismatch(detail: string) {
  return new RdlBrowserDualReadError(`CFIHOS workbook dual-read mismatch: ${detail}`);
}

function runtimeFailure(detail: string) {
  return new RdlBrowserRuntimeReadError(`CFIHOS workbook PostgreSQL runtime read failed: ${detail}`);
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
