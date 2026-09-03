import {
  RDL_SOURCES,
  getDefaultReleaseKey,
  type RdlScopeKey,
  type RdlSourceKey,
} from "./catalog";
import {
  getRdlBrowserReadMode,
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
  type RdlBrowserReadMode,
} from "./runtimeDualRead";
import {
  loadRdlSearchIndex,
  searchRdlRecords,
  type RdlSearchRecord,
} from "./search";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RuntimeSearchPage = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  items: RdlSearchRecord[];
};

export type RdlGlobalSearchRuntimeOptions = {
  query: string;
  source: RdlScopeKey;
  releaseKey: string | null;
  limit?: number;
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  jsonRecords?: RdlSearchRecord[];
};

export type RdlGlobalSearchRuntimeResult = {
  mode: RdlBrowserReadMode;
  results: RdlSearchRecord[];
};

const DEFAULT_LIMIT = 80;

export async function loadRdlGlobalSearchRuntime(
  options: RdlGlobalSearchRuntimeOptions,
): Promise<RdlGlobalSearchRuntimeResult> {
  const query = options.query.trim();
  const limit = Math.max(1, Math.min(DEFAULT_LIMIT, Math.floor(options.limit ?? DEFAULT_LIMIT)));
  const mode = options.mode ?? getRdlBrowserReadMode();
  if (!query) return { mode, results: [] };

  if (mode === "api") {
    const results = await loadApiResults(options.source, options.releaseKey, query, limit, options.fetcher ?? fetch, runtimeFailure);
    return { mode, results };
  }

  const jsonRecords = options.jsonRecords ?? await loadRdlSearchIndex();
  const expected = searchRdlRecords(jsonRecords, query, options.source, options.releaseKey, limit);
  if (mode === "json") return { mode, results: expected };

  const actual = await loadApiResults(options.source, options.releaseKey, query, limit, options.fetcher ?? fetch, dualFailure);
  compareSearchResults(expected, actual);
  return { mode, results: actual };
}

async function loadApiResults(
  source: RdlScopeKey,
  releaseKey: string | null,
  query: string,
  limit: number,
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<RdlSearchRecord[]> {
  const scopes = source === "all"
    ? RDL_SOURCES.map((item) => ({ sourceKey: item.key, releaseKey: requireDefaultRelease(item.key, failure) }))
    : [{ sourceKey: source, releaseKey: requireExplicitRelease(source, releaseKey, failure) }];

  const batches = await Promise.all(scopes.map(({ sourceKey, releaseKey: selectedRelease }) =>
    fetchRankedReleaseResults(sourceKey, selectedRelease, query, limit, fetcher, failure),
  ));
  const combined = batches.flat();
  return searchRdlRecords(combined, query, source, releaseKey, limit);
}

async function fetchRankedReleaseResults(
  sourceKey: RdlSourceKey,
  releaseKey: string,
  query: string,
  limit: number,
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<RdlSearchRecord[]> {
  const params = new URLSearchParams({
    sourceKey,
    releaseKey,
    q: query,
    offset: "0",
    limit: String(limit),
  });
  const path = `/api/rdl-runtime/search?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);
  const page = await response.json() as RuntimeSearchPage;

  if (page.schemaVersion !== "rdl-runtime-search/v1") {
    throw failure(`${path} returned schema '${page.schemaVersion}' instead of 'rdl-runtime-search/v1'`);
  }
  if (page.sourceKey !== sourceKey || page.releaseKey !== releaseKey) {
    throw failure(`${path} returned a different source/release scope`);
  }
  if (!page.packageKey || page.offset !== 0 || !Number.isInteger(page.total) || !Array.isArray(page.items)) {
    throw failure(`${path} returned an invalid search page contract`);
  }
  if (page.items.length > limit) throw failure(`${path} returned more than ${limit} ranked candidates`);
  if (page.items.some((record) => record.sourceKey !== sourceKey || record.releaseKey !== releaseKey)) {
    throw failure(`${path} leaked outside the requested source/release scope`);
  }
  return page.items;
}

function requireDefaultRelease(sourceKey: RdlSourceKey, failure: (detail: string) => Error) {
  const releaseKey = getDefaultReleaseKey(sourceKey);
  if (!releaseKey) throw failure(`source '${sourceKey}' has no configured default release`);
  return releaseKey;
}

function requireExplicitRelease(sourceKey: RdlSourceKey, releaseKey: string | null, failure: (detail: string) => Error) {
  if (!releaseKey) throw failure(`source '${sourceKey}' requires an explicit release`);
  return releaseKey;
}

function compareSearchResults(expected: RdlSearchRecord[], actual: RdlSearchRecord[]) {
  if (expected.length !== actual.length) {
    throw dualMismatch(`row count expected=${expected.length} actual=${actual.length}`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (stableJson(expected[index]) !== stableJson(actual[index])) {
      throw dualMismatch(`row ${index} ${searchIdentity(expected[index])}`);
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function searchIdentity(record: RdlSearchRecord) {
  return `${record.sourceKey}/${record.releaseKey}/${record.entityType}/${record.nativeIdentifier}`;
}

function dualMismatch(detail: string) {
  const error = new RdlBrowserDualReadError(`RDL global search dual-read mismatch: ${detail}`);
  console.error(error.message);
  return error;
}

function dualFailure(detail: string) {
  const error = new RdlBrowserDualReadError(`RDL global search dual-read could not confirm PostgreSQL parity: ${detail}`);
  console.error(error.message);
  return error;
}

function runtimeFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(`RDL global search runtime API read failed: ${detail}`);
  console.error(error.message);
  return error;
}
