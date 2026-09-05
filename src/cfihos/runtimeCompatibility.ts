import { cfihosDocumentRepository } from "./repository/CfihosDocumentRepository";
import {
  loadCfihosWorkbook,
  type CfihosWorksheetRow,
} from "./workbook";
import {
  getRdlBrowserReadMode,
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
  type RdlBrowserReadMode,
} from "../rdl/runtimeDualRead";

const CFIHOS_SOURCE_KEY = "cfihos";
const CFIHOS_RELEASE_KEY = "cfihos-2.0";
const HANDOVER_EVENT_SHEET = "handover event";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CfihosHandoverEventSource = {
  rows: CfihosWorksheetRow[];
  lifecycleRelationshipCount: number;
  lifecycleRelationshipsWithAnyStatusCount: number;
  sourceSha256: string | null;
  packageKey: string | null;
};

type RuntimeHandoverItem = {
  id: string;
  name: string;
  description: string | null;
  reportingSequence: string | null;
  sourceLocator: Record<string, unknown>;
};

type RuntimeHandoverResponse = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: RuntimeHandoverItem[];
  lifecycleRelationshipCount: number;
  lifecycleRelationshipsWithAnyStatusCount: number;
};

export type CfihosHandoverEventRuntimeOptions = {
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  reference?: CfihosHandoverEventSource;
};

export async function loadCfihosHandoverEventSource(
  options: CfihosHandoverEventRuntimeOptions = {},
): Promise<CfihosHandoverEventSource> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return fetchRuntimeSource(fetcher, runtimeFailure);
  }

  const reference = options.reference ?? await loadSnapshotReference();
  if (mode === "json") return reference;

  const runtime = await fetchRuntimeSource(fetcher, dualFailure);
  compareSources(reference, runtime);
  return runtime;
}

async function loadSnapshotReference(): Promise<CfihosHandoverEventSource> {
  const [workbook, relationships] = await Promise.all([
    loadCfihosWorkbook(),
    cfihosDocumentRepository.getRelationships(),
  ]);
  const sheet = workbook.sheets[HANDOVER_EVENT_SHEET];
  if (!sheet) {
    throw new RdlBrowserRuntimeReadError(
      `The worksheet '${HANDOVER_EVENT_SHEET}' was not found in the CFIHOS workbook snapshot.`,
    );
  }

  return {
    rows: sheet.rows,
    lifecycleRelationshipCount: relationships.length,
    lifecycleRelationshipsWithAnyStatusCount: relationships.filter(hasAnyLifecycleStatus).length,
    sourceSha256: String(workbook.source.sha256 ?? "").trim() || null,
    packageKey: null,
  };
}

async function fetchRuntimeSource(
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<CfihosHandoverEventSource> {
  const params = new URLSearchParams({
    sourceKey: CFIHOS_SOURCE_KEY,
    releaseKey: CFIHOS_RELEASE_KEY,
  });
  const path = `/api/rdl-runtime/cfihos-handover-events?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

  const payload = await response.json() as RuntimeHandoverResponse;
  if (payload.schemaVersion !== "rdl-cfihos-handover-events/v1") {
    throw failure(
      `${path} returned schema '${payload.schemaVersion}' instead of 'rdl-cfihos-handover-events/v1'`,
    );
  }
  if (payload.sourceKey !== CFIHOS_SOURCE_KEY || payload.releaseKey !== CFIHOS_RELEASE_KEY) {
    throw failure(`${path} returned a different source/release scope`);
  }
  if (!String(payload.packageKey ?? "").trim()) {
    throw failure(`${path} returned no package identity`);
  }
  if (!String(payload.contentSha256 ?? "").trim()) {
    throw failure(`${path} returned no source content SHA-256`);
  }
  if (!Array.isArray(payload.items)) {
    throw failure(`${path} returned an invalid item collection`);
  }
  assertCount(payload.lifecycleRelationshipCount, "lifecycleRelationshipCount", failure);
  assertCount(
    payload.lifecycleRelationshipsWithAnyStatusCount,
    "lifecycleRelationshipsWithAnyStatusCount",
    failure,
  );
  if (payload.lifecycleRelationshipsWithAnyStatusCount > payload.lifecycleRelationshipCount) {
    throw failure(`${path} returned a lifecycle status count greater than its relationship count`);
  }

  const rows = payload.items.map((item, index): CfihosWorksheetRow => {
    if (!item || typeof item !== "object") {
      throw failure(`${path} returned an invalid handover item at index ${index}`);
    }
    if (!String(item.id ?? "").trim() || !String(item.name ?? "").trim()) {
      throw failure(`${path} returned an incomplete handover identity at index ${index}`);
    }
    const sheet = String(item.sourceLocator?.sheet ?? "").trim();
    if (sheet !== HANDOVER_EVENT_SHEET) {
      throw failure(`${path} returned handover provenance from sheet '${sheet || "missing"}'`);
    }
    return {
      "CFIHOS unique code": item.id,
      "handover event name": item.name,
      "handover event description": item.description,
      "handover event reporting sequence number": item.reportingSequence,
    };
  });

  return {
    rows,
    lifecycleRelationshipCount: payload.lifecycleRelationshipCount,
    lifecycleRelationshipsWithAnyStatusCount: payload.lifecycleRelationshipsWithAnyStatusCount,
    sourceSha256: payload.contentSha256,
    packageKey: payload.packageKey,
  };
}

function compareSources(
  reference: CfihosHandoverEventSource,
  runtime: CfihosHandoverEventSource,
) {
  if (reference.sourceSha256 && runtime.sourceSha256 !== reference.sourceSha256) {
    throw dualMismatch(
      `source SHA expected=${reference.sourceSha256} actual=${runtime.sourceSha256 ?? "missing"}`,
    );
  }
  if (reference.lifecycleRelationshipCount !== runtime.lifecycleRelationshipCount) {
    throw dualMismatch(
      `lifecycle relationship count expected=${reference.lifecycleRelationshipCount} actual=${runtime.lifecycleRelationshipCount}`,
    );
  }
  if (
    reference.lifecycleRelationshipsWithAnyStatusCount
    !== runtime.lifecycleRelationshipsWithAnyStatusCount
  ) {
    throw dualMismatch(
      `lifecycle relationship status count expected=${reference.lifecycleRelationshipsWithAnyStatusCount} actual=${runtime.lifecycleRelationshipsWithAnyStatusCount}`,
    );
  }

  const expectedRows = normalizeRows(reference.rows);
  const actualRows = normalizeRows(runtime.rows);
  if (stableJson(expectedRows) !== stableJson(actualRows)) {
    throw dualMismatch("handover event row semantics differ");
  }
}

function normalizeRows(rows: CfihosWorksheetRow[]) {
  return rows
    .map((row) => ({
      id: text(row["CFIHOS unique code"]),
      name: text(row["handover event name"]),
      description: nullableText(row["handover event description"]),
      reportingSequence: nullableNumber(row["handover event reporting sequence number"]),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) || a.name.localeCompare(b.name));
}

function hasAnyLifecycleStatus(relationship: {
  requiredStatusDetailedEngineering?: string | null;
  requiredStatusConstruction?: string | null;
  requiredStatusCommissioning?: string | null;
  requiredStatusStartup?: string | null;
  requiredStatusOperations?: string | null;
}) {
  return Boolean(
    relationship.requiredStatusDetailedEngineering
      || relationship.requiredStatusConstruction
      || relationship.requiredStatusCommissioning
      || relationship.requiredStatusStartup
      || relationship.requiredStatusOperations,
  );
}

function assertCount(value: unknown, name: string, failure: (detail: string) => Error) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw failure(`${name} is not a non-negative integer`);
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function nullableNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function dualMismatch(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Handover Event dual-read mismatch: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function dualFailure(detail: string) {
  const error = new RdlBrowserDualReadError(
    `CFIHOS Handover Event dual-read could not confirm PostgreSQL parity: ${detail}`,
  );
  console.error(error.message);
  return error;
}

function runtimeFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(
    `CFIHOS Handover Event runtime API read failed: ${detail}`,
  );
  console.error(error.message);
  return error;
}
