import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";
import {
  RdlRuntimeProjectionRepository,
  type RdlRuntimeRelationshipRecord,
  type RdlRuntimeSearchRecord,
} from "./RdlRuntimeProjectionRepository.ts";
import {
  projectRdlEntityDetail,
  type RdlEntityDetailProjection,
  type RdlRelationshipIndexRecord,
} from "../../src/rdl/entityDetail.ts";
import type { RdlSearchRecord } from "../../src/rdl/search.ts";

export const RDL_RUNTIME_PAGE_DEFAULT = 100;
export const RDL_RUNTIME_PAGE_MAX = 500;

export type RdlRuntimeReleaseContext = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
};

export type RdlRuntimePage<T> = RdlRuntimeReleaseContext & {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  items: T[];
};

export type RdlRuntimeSearchQuery = {
  sourceKey: string;
  releaseKey: string;
  entityType?: string;
  q?: string;
  offset?: number;
  limit?: number;
};

export type RdlRuntimeRelationshipQuery = {
  sourceKey: string;
  releaseKey: string;
  relationshipType?: string;
  sourceEntityType?: string;
  sourceNativeIdentifier?: string;
  targetEntityType?: string;
  targetNativeIdentifier?: string;
  offset?: number;
  limit?: number;
};

export type RdlRuntimeDetailQuery = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  nativeIdentifier: string;
};

export type RdlRuntimeDetailResult = RdlRuntimeReleaseContext & {
  detail: RdlEntityDetailProjection | null;
};

type ReleaseRow = {
  source_key: string;
  source_name: string;
  release_key: string;
  release_status: string;
  version_label: string;
  package_key: string;
};

const text = (value: unknown) => String(value ?? "").trim();

export class RdlRuntimeReadInputError extends Error {}
export class RdlRuntimeReleaseNotFoundError extends Error {}

export class RdlRuntimeReadService {
  private readonly projection: RdlRuntimeProjectionRepository;

  constructor(private readonly client: SqlJsonClient) {
    this.projection = new RdlRuntimeProjectionRepository(client);
  }

  async search(query: RdlRuntimeSearchQuery): Promise<RdlRuntimePage<RdlRuntimeSearchRecord>> {
    const input = normalizeSearchQuery(query);
    const release = await this.requireRelease(input.sourceKey, input.releaseKey);
    const records = await this.projection.projectSearchRecords(input.sourceKey, input.releaseKey);
    const scoped = input.entityType
      ? records.filter((record) => record.entityType === input.entityType)
      : records;
    const filtered = input.q ? rankRuntimeSearchRecords(scoped, input.q) : scoped;
    return page(release, filtered, input.offset, input.limit);
  }

  async relationships(query: RdlRuntimeRelationshipQuery): Promise<RdlRuntimePage<RdlRuntimeRelationshipRecord>> {
    const input = normalizeRelationshipQuery(query);
    const release = await this.requireRelease(input.sourceKey, input.releaseKey);
    const records = input.relationshipType === "entity_parent"
      ? await this.projection.projectEntityParentRecords(input.sourceKey, input.releaseKey)
      : await this.projection.projectRelationshipRecords(input.sourceKey, input.releaseKey);
    const filtered = records.filter((record) => {
      if (input.relationshipType && record.relationshipType !== input.relationshipType) return false;
      if (input.sourceEntityType && record.sourceEntityType !== input.sourceEntityType) return false;
      if (input.sourceNativeIdentifier && record.sourceNativeIdentifier !== input.sourceNativeIdentifier) return false;
      if (input.targetEntityType && record.targetEntityType !== input.targetEntityType) return false;
      if (input.targetNativeIdentifier && record.targetNativeIdentifier !== input.targetNativeIdentifier) return false;
      return true;
    });
    return page(release, filtered, input.offset, input.limit);
  }

  async detail(query: RdlRuntimeDetailQuery): Promise<RdlRuntimeDetailResult> {
    const input = normalizeDetailQuery(query);
    const release = await this.requireRelease(input.sourceKey, input.releaseKey);

    // RDL-037.2 deliberately reuses the already-proven full release projection once
    // per detail request. The pure rich-detail projector is shared with the JSON
    // rollback path, so there is one semantic implementation for both authorities.
    const projection = await this.projection.project(input.sourceKey, input.releaseKey);
    if (projection.searchRecords.some((record) => record.packageKey !== release.packageKey)
      || projection.relationshipRecords.some((record) => record.packageKey !== release.packageKey)) {
      throw new Error("RDL runtime detail projection changed package identity during the read.");
    }

    const detail = projectRdlEntityDetail(
      projection.searchRecords as unknown as RdlSearchRecord[],
      projection.relationshipRecords as RdlRelationshipIndexRecord[],
      input.sourceKey,
      input.releaseKey,
      input.entityType,
      input.nativeIdentifier,
    );

    if (detail && (
      detail.record.sourceKey !== release.sourceKey
      || detail.record.releaseKey !== release.releaseKey
      || detail.record.packageKey !== release.packageKey
      || detail.record.entityType !== input.entityType
      || detail.record.nativeIdentifier !== input.nativeIdentifier
    )) {
      throw new Error("RDL runtime detail projection escaped the requested identity boundary.");
    }

    return { ...release, detail };
  }

  async requireRelease(sourceKey: string, releaseKey: string): Promise<RdlRuntimeReleaseContext> {
    const source = required("sourceKey", sourceKey);
    const release = required("releaseKey", releaseKey);
    const rows = await this.client.query<ReleaseRow>(`
      SELECT s.source_key, s.name AS source_name, r.release_key, r.release_status, r.version_label, p.package_key
      FROM rdl.rdl_package p
      JOIN rdl.rdl_release r ON r.release_id = p.release_id
      JOIN rdl.rdl_source s ON s.source_id = r.source_id
      WHERE p.package_status = 'validated'
        AND s.source_key = ${sqlLiteral(source)}
        AND r.release_key = ${sqlLiteral(release)}
      ORDER BY p.package_id DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new RdlRuntimeReleaseNotFoundError(`RDL release '${source}/${release}' was not found.`);
    return {
      sourceKey: row.source_key,
      sourceName: row.source_name,
      releaseKey: row.release_key,
      releaseStatus: browserReleaseStatus(row.release_status, row.release_key),
      versionLabel: row.version_label,
      packageKey: row.package_key,
    };
  }
}

function normalizeSearchQuery(query: RdlRuntimeSearchQuery) {
  return {
    sourceKey: required("sourceKey", query.sourceKey),
    releaseKey: required("releaseKey", query.releaseKey),
    entityType: text(query.entityType),
    q: text(query.q),
    offset: boundedInteger("offset", query.offset, 0, 0, 1_000_000),
    limit: boundedInteger("limit", query.limit, RDL_RUNTIME_PAGE_DEFAULT, 1, RDL_RUNTIME_PAGE_MAX),
  };
}

function normalizeRelationshipQuery(query: RdlRuntimeRelationshipQuery) {
  return {
    sourceKey: required("sourceKey", query.sourceKey),
    releaseKey: required("releaseKey", query.releaseKey),
    relationshipType: text(query.relationshipType),
    sourceEntityType: text(query.sourceEntityType),
    sourceNativeIdentifier: text(query.sourceNativeIdentifier),
    targetEntityType: text(query.targetEntityType),
    targetNativeIdentifier: text(query.targetNativeIdentifier),
    offset: boundedInteger("offset", query.offset, 0, 0, 1_000_000),
    limit: boundedInteger("limit", query.limit, RDL_RUNTIME_PAGE_DEFAULT, 1, RDL_RUNTIME_PAGE_MAX),
  };
}

function normalizeDetailQuery(query: RdlRuntimeDetailQuery) {
  return {
    sourceKey: required("sourceKey", query.sourceKey),
    releaseKey: required("releaseKey", query.releaseKey),
    entityType: required("entityType", query.entityType),
    nativeIdentifier: required("nativeIdentifier", query.nativeIdentifier),
  };
}

function required(name: string, value: unknown) {
  const result = text(value);
  if (!result) throw new RdlRuntimeReadInputError(`${name} is required.`);
  return result;
}

function boundedInteger(name: string, value: unknown, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RdlRuntimeReadInputError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function runtimeSearchableValues(record: RdlRuntimeSearchRecord): string[] {
  const facetValues = Object.values(record.facets ?? {}).flatMap((facet) => [facet.value, facet.label ?? ""]);
  return [
    record.nativeIdentifier,
    record.name,
    record.definition,
    record.entityType.replaceAll("_", " "),
    ...(record.aliases ?? []),
    ...(record.searchText ?? []),
    record.secondaryLabel ?? "",
    record.tertiaryLabel ?? "",
    ...(record.badges ?? []),
    ...facetValues,
  ].filter((value) => Boolean(value.trim()));
}

function rankRuntimeSearchRecords(records: RdlRuntimeSearchRecord[], query: string): RdlRuntimeSearchRecord[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const exactQuery = query.toLocaleLowerCase().trim();

  return records
    .map((record) => {
      const id = record.nativeIdentifier.toLocaleLowerCase();
      const name = record.name.toLocaleLowerCase();
      const definition = record.definition.toLocaleLowerCase();
      const aliases = (record.aliases ?? []).map((value) => value.toLocaleLowerCase());
      const searchable = runtimeSearchableValues(record).join(" ").toLocaleLowerCase();
      if (!terms.every((term) => searchable.includes(term))) return null;
      let score = 0;
      if (id === exactQuery) score += 100;
      if (name === exactQuery) score += 90;
      if (id.startsWith(exactQuery)) score += 60;
      if (name.startsWith(exactQuery)) score += 50;
      if (aliases.some((alias) => alias === exactQuery)) score += 45;
      if (name.includes(exactQuery)) score += 30;
      if (aliases.some((alias) => alias.includes(exactQuery))) score += 20;
      if (definition.includes(exactQuery)) score += 10;
      score += terms.reduce(
        (sum, term) => sum
          + (id.includes(term) ? 6 : 0)
          + (name.includes(term) ? 4 : 0)
          + (aliases.some((alias) => alias.includes(term)) ? 3 : 0),
        0,
      );
      return { record, score };
    })
    .filter((candidate): candidate is { record: RdlRuntimeSearchRecord; score: number } => candidate !== null)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name) || a.record.sourceKey.localeCompare(b.record.sourceKey))
    .map(({ record }) => record);
}

function page<T>(release: RdlRuntimeReleaseContext, records: T[], offset: number, limit: number): RdlRuntimePage<T> {
  const items = records.slice(offset, offset + limit);
  return {
    ...release,
    total: records.length,
    offset,
    limit,
    hasMore: offset + items.length < records.length,
    items,
  };
}

function browserReleaseStatus(value: string, releaseKey: string) {
  if (releaseKey.endsWith("0.1-draft") || value === "superseded") return "superseded";
  if (value === "published") return "reviewed";
  return value;
}
