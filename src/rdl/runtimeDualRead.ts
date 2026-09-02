import type { RdlRelationshipIndexRecord } from "./entityDetail";
import type { RdlSearchRecord } from "./search";

export type RdlBrowserReadMode = "json" | "dual";

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

export class RdlBrowserDualReadError extends Error {}

const PAGE_LIMIT = 500;

export function parseRdlBrowserReadMode(value?: string): RdlBrowserReadMode {
  const mode = String(value ?? "json").trim().toLocaleLowerCase();
  if (mode === "json" || mode === "dual") return mode;
  throw new RdlBrowserDualReadError(`Invalid VITE_RDL_BROWSER_READ_MODE '${value}'. Expected json or dual.`);
}

export function getRdlBrowserReadMode(): RdlBrowserReadMode {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return parseRdlBrowserReadMode(env?.VITE_RDL_BROWSER_READ_MODE);
}

export async function verifyRdlBrowseDualRead(options: VerifyOptions): Promise<void> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  if (mode === "json") return;

  const fetcher = options.fetcher ?? fetch;
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

  const actualRecords = await fetchAllPages<RdlSearchRecord>(
    "/api/rdl-runtime/search",
    {
      sourceKey: options.sourceKey,
      releaseKey: options.releaseKey,
      entityType: options.entityType,
    },
    "rdl-runtime-search/v1",
    fetcher,
  );
  compareRows("search", expectedRecords, actualRecords, searchIdentity);

  const actualParents = await fetchAllPages<RdlRelationshipIndexRecord>(
    "/api/rdl-runtime/relationships",
    {
      sourceKey: options.sourceKey,
      releaseKey: options.releaseKey,
      relationshipType: "entity_parent",
      sourceEntityType: options.entityType,
      targetEntityType: options.entityType,
    },
    "rdl-runtime-relationships/v1",
    fetcher,
  );
  compareRows("hierarchy", expectedParents, actualParents, relationshipIdentity);
}

async function fetchAllPages<T>(
  path: string,
  query: Record<string, string>,
  schemaVersion: string,
  fetcher: FetchLike,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  let expectedTotal: number | null = null;

  while (true) {
    const params = new URLSearchParams({ ...query, offset: String(offset), limit: String(PAGE_LIMIT) });
    const response = await fetcher(`${path}?${params.toString()}`);
    if (!response.ok) {
      throw dualReadFailure(`${path} returned HTTP ${response.status}`);
    }
    const page = await response.json() as RuntimePage<T>;
    if (page.schemaVersion !== schemaVersion) {
      throw dualReadFailure(`${path} returned schema '${page.schemaVersion}' instead of '${schemaVersion}'`);
    }
    if (page.sourceKey !== query.sourceKey || page.releaseKey !== query.releaseKey) {
      throw dualReadFailure(`${path} returned a different source/release scope`);
    }
    if (!Number.isInteger(page.total) || !Number.isInteger(page.offset) || !Array.isArray(page.items)) {
      throw dualReadFailure(`${path} returned an invalid page contract`);
    }
    if (page.offset !== offset) {
      throw dualReadFailure(`${path} returned offset ${page.offset} while ${offset} was requested`);
    }
    if (expectedTotal === null) expectedTotal = page.total;
    if (page.total !== expectedTotal) {
      throw dualReadFailure(`${path} changed total count during pagination`);
    }
    if (page.hasMore && page.items.length === 0) {
      throw dualReadFailure(`${path} returned an empty page while hasMore=true`);
    }

    items.push(...page.items);
    if (!page.hasMore) break;
    offset += page.items.length;
  }

  if (items.length !== (expectedTotal ?? 0)) {
    throw dualReadFailure(`${path} returned ${items.length} rows while total=${expectedTotal ?? 0}`);
  }
  return items;
}

function compareRows<T>(
  operation: string,
  expected: T[],
  actual: T[],
  identity: (value: T) => string,
) {
  if (expected.length !== actual.length) {
    throw dualReadMismatch(operation, `row count expected=${expected.length} actual=${actual.length}`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const left = stableJson(expected[index]);
    const right = stableJson(actual[index]);
    if (left !== right) {
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
