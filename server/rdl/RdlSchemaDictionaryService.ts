import {
  RdlSchemaDictionaryRepository,
  type RdlSchemaDictionaryRecord,
  type RdlSchemaReleaseContext,
} from "./RdlSchemaDictionaryRepository.ts";

export const RDL_SCHEMA_PAGE_DEFAULT = 100;
export const RDL_SCHEMA_PAGE_MAX = 500;

export type RdlSchemaDictionaryQuery = {
  sourceKey: string;
  releaseKey: string;
  conceptKind?: string;
  q?: string;
  offset?: number;
  limit?: number;
};

export type RdlSchemaDictionaryPage = RdlSchemaReleaseContext & {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  items: RdlSchemaDictionaryRecord[];
};

export class RdlSchemaDictionaryInputError extends Error {}
export class RdlSchemaDictionaryReleaseNotFoundError extends Error {}

const text = (value: unknown) => String(value ?? "").trim();

export class RdlSchemaDictionaryService {
  constructor(private readonly repository: RdlSchemaDictionaryRepository) {}

  async list(query: RdlSchemaDictionaryQuery): Promise<RdlSchemaDictionaryPage> {
    const sourceKey = text(query.sourceKey);
    const releaseKey = text(query.releaseKey);
    if (!sourceKey || !releaseKey) throw new RdlSchemaDictionaryInputError("sourceKey and releaseKey are required.");

    const release = await this.repository.release(sourceKey, releaseKey);
    if (!release) throw new RdlSchemaDictionaryReleaseNotFoundError("RDL source/release was not found.");

    const all = await this.repository.records(sourceKey, releaseKey);
    const conceptKind = text(query.conceptKind).toLowerCase();
    const q = text(query.q).toLowerCase();
    const scoped = all.filter((item) => {
      if (conceptKind && item.conceptKind !== conceptKind) return false;
      if (!q) return true;
      const values = [
        item.nativeIdentifier,
        item.conceptKind,
        item.entityName,
        item.propertyName,
        item.entityAttributeName,
        item.definition,
        item.requirementStatus,
        item.formatSpecification,
        item.presenceConstraint,
        item.relationshipVerb,
      ];
      return values.some((value) => String(value ?? "").toLowerCase().includes(q));
    });

    const offset = Math.max(0, Number.isFinite(Number(query.offset)) ? Number(query.offset) : 0);
    const requestedLimit = Number.isFinite(Number(query.limit)) ? Number(query.limit) : RDL_SCHEMA_PAGE_DEFAULT;
    const limit = Math.max(1, Math.min(RDL_SCHEMA_PAGE_MAX, requestedLimit));
    return {
      ...release,
      total: scoped.length,
      offset,
      limit,
      hasMore: offset + limit < scoped.length,
      items: scoped.slice(offset, offset + limit),
    };
  }
}
