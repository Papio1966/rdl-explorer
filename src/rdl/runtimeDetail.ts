import {
  loadRdlEntityDetail,
  projectRdlEntityDetail,
  type RdlEntityDetailProjection,
  type RdlRelationshipIndexRecord,
} from "./entityDetail";
import {
  getRdlBrowserReadMode,
  RdlBrowserDualReadError,
  RdlBrowserRuntimeReadError,
  type RdlBrowserReadMode,
} from "./runtimeDualRead";
import type { RdlSearchRecord } from "./search";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RuntimeDetailResponse = {
  schemaVersion: string;
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  detail: RdlEntityDetailProjection | null;
};

export type RdlEntityDetailRuntimeOptions = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  nativeIdentifier: string;
  mode?: RdlBrowserReadMode;
  fetcher?: FetchLike;
  jsonRecords?: RdlSearchRecord[];
  jsonRelationships?: RdlRelationshipIndexRecord[];
};

export async function loadRdlEntityDetailRuntime(
  options: RdlEntityDetailRuntimeOptions,
): Promise<RdlEntityDetailProjection | null> {
  const mode = options.mode ?? getRdlBrowserReadMode();
  const fetcher = options.fetcher ?? fetch;

  if (mode === "api") {
    return fetchRuntimeDetail(options, fetcher, runtimeReadFailure);
  }

  const json = options.jsonRecords && options.jsonRelationships
    ? projectRdlEntityDetail(
      options.jsonRecords,
      options.jsonRelationships,
      options.sourceKey,
      options.releaseKey,
      options.entityType,
      options.nativeIdentifier,
    )
    : await loadRdlEntityDetail(
      options.sourceKey,
      options.releaseKey,
      options.entityType,
      options.nativeIdentifier,
    );

  if (mode === "json") return json;

  const runtime = await fetchRuntimeDetail(options, fetcher, dualReadFailure);
  if (stableJson(json) !== stableJson(runtime)) {
    throw dualReadMismatch(
      `${options.sourceKey}/${options.releaseKey}/${options.entityType}/${options.nativeIdentifier}`,
    );
  }

  // As in shared browse and global search, dual mode returns the API candidate only
  // after exact parity with the committed JSON rollback/reference projection.
  return runtime;
}

async function fetchRuntimeDetail(
  options: RdlEntityDetailRuntimeOptions,
  fetcher: FetchLike,
  failure: (detail: string) => Error,
): Promise<RdlEntityDetailProjection | null> {
  const params = new URLSearchParams({
    sourceKey: options.sourceKey,
    releaseKey: options.releaseKey,
    entityType: options.entityType,
    nativeIdentifier: options.nativeIdentifier,
  });
  const path = `/api/rdl-runtime/detail?${params.toString()}`;
  const response = await fetcher(path);
  if (!response.ok) throw failure(`${path} returned HTTP ${response.status}`);

  const payload = await response.json() as RuntimeDetailResponse;
  if (payload.schemaVersion !== "rdl-runtime-detail/v1") {
    throw failure(`detail API returned schema '${payload.schemaVersion}' instead of 'rdl-runtime-detail/v1'`);
  }
  if (payload.sourceKey !== options.sourceKey || payload.releaseKey !== options.releaseKey) {
    throw failure("detail API returned a different source/release scope");
  }
  if (!payload.packageKey) throw failure("detail API returned no package identity");
  if (!(payload.detail === null || typeof payload.detail === "object")) {
    throw failure("detail API returned an invalid detail payload");
  }

  if (payload.detail) {
    const record = payload.detail.record;
    if (
      record.sourceKey !== options.sourceKey
      || record.releaseKey !== options.releaseKey
      || record.packageKey !== payload.packageKey
      || record.entityType !== options.entityType
      || record.nativeIdentifier !== options.nativeIdentifier
    ) {
      throw failure("detail API escaped the requested source/release/entity identity boundary");
    }
  }

  return payload.detail;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function dualReadMismatch(identity: string) {
  const error = new RdlBrowserDualReadError(`RDL entity detail dual-read mismatch: ${identity}`);
  console.error(error.message);
  return error;
}

function dualReadFailure(detail: string) {
  const error = new RdlBrowserDualReadError(`RDL entity detail dual-read could not confirm PostgreSQL parity: ${detail}`);
  console.error(error.message);
  return error;
}

function runtimeReadFailure(detail: string) {
  const error = new RdlBrowserRuntimeReadError(`RDL entity detail runtime API read failed: ${detail}`);
  console.error(error.message);
  return error;
}
