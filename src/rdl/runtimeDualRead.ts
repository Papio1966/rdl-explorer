import {
  loadRdlRelationshipIndex,
  type RdlRelationshipIndexRecord,
} from "./entityDetail";
import {
  loadRdlSearchIndex,
  type RdlSearchRecord,
} from "./search";

export type RdlBrowserReadMode = "json" | "dual" | "api";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RuntimePage<T> = {
  schemaVersion: string;
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  items: T[];
};

type VerifyOptions = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  records: RdlSearchRecord[];
  relationships: RdlRelationshipIndexRecord[];
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
};

type LoadOptions = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  jsonRecords?: RdlSearchRecord[];
  jsonRelationships?: RdlRelationshipIndexRecord[];
};

export type RdlBrowseRuntimeResult = {
  mode: RdlBrowserReadMode;
  records: RdlSearchRecord[];
  relationships: RdlRelationshipIndexRecord[];
};

export class RdlBrowserRuntimeReadError extends Error {}
export class RdlBrowserDualReadError extends RdlBrowserRuntimeReadError {}

const PAGE_LIMIT = 500;

export function parseRdlBrowserReadMode(value?: string, production = false): RdlBrowserReadMode {
  const configured = String(value ?? "").trim().toLocaleLowerCase();
  if (!configured) return production ? "api" : "json";
  if (configured === "json" || configured === "dual" || configured === "api") return configured;
  throw new RdlBrowserRuntimeReadError(`Invalid VITE_RDL_BROWSER_READ_MODE '${value}'. Expected json, dual or api.`);
}

export function getRdlBrowserReadMode(): RdlBrowserReadMode {
  const env = (import.meta as ImportMeta & {
    env?: { VITE_RDL_BROWSER_READ_MODE?: string; PROD?: boolean };
  }).env;
  return parseRdlBrowserReadMode(env?.VITE_RDL_BROWSER_READ_MODE, Boolean(env?.PROD));
}

export async function loadRdlBrowseRuntime(options: LoadOptions): Promise<RdlBrowseRuntimeResult> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    const runtime = await fetchRuntimeBrowseData(options.sourceKey, options.releaseKey, options.entityType, fetcher, runtimeReadFailure);
    return { mode, ...runtime };
  }

  const [allRecords, allRelationships] = options.jsonRecords && options.jsonRelationships
    ? [options.jsonRecords, options.jsonRelationships]
    : await Promise.all([loadRdlSearchIndex(), loadRdlRelationshipIndex()]);
  const json = scopeJsonBrowse(allRecords, allRelationships, options.sourceKey, options.releaseKey, options.entityType);

  if (mode === "json") return { mode, ...json };

  const runtime = await fetchRuntimeBrowseData(options.sourceKey, options.releaseKey, options.entityType, fetcher, dualReadFailure);
  compareRows("search", json.records, runtime.records, searchIdentity);
  compareRows("hierarchy", parentRelationships(json.relationships, options.entityType), runtime.relationships, relationshipIdentity);

  // Dual mode now returns the API candidate after exact parity. JSON remains available
  // as the explicit rollback/reference path rather than the rendered authority.
  return { mode, ...runtime };
}

export async function verifyRdlBrowseDualRead(options: VerifyOptions): Promise<void> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  if (mode === "json") return;

  const expectedRecords = options.records.filter((record) =>
    record.sourceKey === options.sourceKey
    && record.releaseKey === options.releaseKey
    && record.entityType === options.entityType,
  );
  const packageKeys = new Set(expectedRecords.map((record) => record.packageKey));
  const expectedParents = options.relationships.filter((relationship) =>
    relationship.sourceKey === options.sourceKey
    && relationship.releaseKey === options.releaseKey
    && packageKeys.has(relationship.packageKey)
    && relationship.relationshipType === "entity_parent"
    && relationship.sourceEntityType === options.entityType
    && relationship.targetEntityType === options.entityType,
  );

  const runtime = await fetchRuntimeBrowseData(
    options.sourceKey,
    options.releaseKey,
    options.entityType,
    options.fetcher ?? fetch,
    dualReadFailure,
  );
  if (mode === "api") return;
  compareRows("search", expectedRecords, runtime.records, searchIdentity);
  compareRows("hierarchy", expectedParents, runtime.relationships, relationshipIdentity);
}

function scopeJsonBrowse(
  allRecords: RdlSearchRecord[],
  allRelationships: RdlRelationshipIndexRecord[],
  sourceKey: string,
  releaseKey: string,
  entityType: string,
) {
  const records = allRecords.filter((item) =>
    item.sourceKey === sourceKey
    && item.releaseKey === releaseKey
    && item.entityType === entityType,
  );
  const packageKeys = new Set(records.map((item) => item.packageKey));
  const relationships = allRelationships.filter((item) =>
    item.sourceKey === sourceKey
    && item.releaseKey === releaseKey
    && packageKeys.has(item.packageKey),
  );
  return { records, relationships };
}

async function fetchRuntimeBrowseData(
  sourceKey: string,
  releaseKey: string,
  entityType: string,
  fetcher: FetchLike,
  failure: (detail: string) => Error,
) {
  const records = await fetchAllPages<RdlSearchRecord>(
    "/api/rdl-runtime/search",
    { sourceKey, releaseKey, entityType },
    "rdl-runtime-search/v1",
    fetcher,
    failure,
  );
  const relationships = await fetchAllPages<RdlRelationshipIndexRecord>(
    "/api/rdl-runtime/relationships",
    {
      sourceKey,
      releaseKey,
      relationshipType: "entity_parent",
      sourceEntityType: entityType,
      targetEntityType: entityType,
    },
    "rdl-runtime-relationships/v1",
    fetcher,
    failure,
  );

  if (records.some((record) => record.sourceKey !== sourceKey || record.releaseKey !== releaseKey || record.entityType !== entityType)) {
    throw failure("search response leaked outside the requested source/release/entity scope");
  }
  if (relationships.some((row) =>
    row.sourceKey !== sourceKey
    || row.releaseKey !== releaseKey
    || row.relationshipType !== "entity_parent"
    || row.sourceEntityType !== entityType
    || row.targetEntityType !== entityType
  )) {
    throw failure("relationship response leaked outside the requested hierarchy scope");
  }

  return { records, relationships };
}

async function fetchAllPages<T>(
  path: string,
  query: Record<string, string>,
  schemaVersion: string,
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  let expectedTotal: number | null = null;
  let expectedPackageKey: string | null = null;

  while (true) {
    const params = new URLSearchParams({ ...query, offset: String(offset), limit: String(PAGE_LIMIT) });
    const response = await fetcher(`${path}?${params.toString()}`);
    if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

    const page = await response.json() as RuntimePage<T>;
    if (page.schemaVersion !== schemaVersion) throw failure(`${path} returned schema '${page.schemaVersion}' instead of '${schemaVersion}'`);
    if (page.sourceKey !== query.sourceKey || page.releaseKey !== query.releaseKey) throw failure(`${path} returned a different source/release scope`);
    if (!page.packageKey) throw failure(`${path} returned no package identity`);
    if (!Number.isInteger(page.total) || !Number.isInteger(page.offset) || !Array.isArray(page.items)) throw failure(`${path} returned an invalid page contract`);
    if (page.offset !== offset) throw failure(`${path} returned offset ${page.offset} while ${offset} was requested`);

    if (expectedTotal === null) expectedTotal = page.total;
    if (page.total !== expectedTotal) throw failure(`${path} changed total count during pagination`);
    if (expectedPackageKey === null) expectedPackageKey = page.packageKey;
    if (page.packageKey !== expectedPackageKey) throw failure(`${path} changed package identity during pagination`);
    if (page.hasMore && page.items.length === 0) throw failure(`${path} returned an empty page while hasMore=true`);

    items.push(...page.items);
    if (!page.hasMore) break;
    offset += page.items.length;
  }

  if (items.length !== (expectedTotal ?? 0)) throw failure(`${path} returned ${items.length} rows while total=${expectedTotal ?? 0}`);
  return items;
}

function parentRelationships(relationships: RdlRelationshipIndexRecord[], entityType: string) {
  return relationships.filter((relationship) =>
    relationship.relationshipType === "entity_parent"
    && relationship.sourceEntityType === entityType
    && relationship.targetEntityType === entityType,
  );
}

function compareRows<T>(operation: string, expected: T[], actual: T[], identity: (value: T) => string) {
  if (expected.length !== actual.length) throw dualReadMismatch(operation, `row count expected=${expected.length} actual=${actual.length}`);
  for (let index = 0; index < expected.length; index += 1) {
    if (stableJson(expected[index]) !== stableJson(actual[index])) {
      throw dualReadMismatch(operation, `row ${index} ${identity(expected[index])}`);
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

function relationshipIdentity(record: RdlRelationshipIndexRecord) {
  return `${record.sourceKey}/${record.releaseKey}/${record.relationshipType}/${record.sourceEntityType}/${record.sourceNativeIdentifier}->${record.targetEntityType}/${record.targetNativeIdentifier}`;
}

function dualReadMismatch(operation: string, detail: string) {
  const error = new RdlBrowserDualReadError(`RDL browser dual-read mismatch (${operation}): ${detail}`);
  console.error(error.message);
  return error;
}

function dualReadFailure(detail: string) {
  const error = new RdlBrowserDualReadError(`RDL browser dual-read could not confirm PostgreSQL parity: ${detail}`);
  console.error(error.message);
  return error;
}

function runtimeReadFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(`RDL browser runtime API read failed: ${detail}`);
  console.error(error.message);
  return error;
}
