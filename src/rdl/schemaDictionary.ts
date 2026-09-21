export type RdlSchemaConstraint = {
  kind: string;
  value: string;
  normalized: Record<string, unknown>;
};

export type RdlSchemaDictionaryItem = {
  schemaDefinitionId: number;
  nativeIdentifier: string;
  conceptKind: string;
  section: string | null;
  entityName: string | null;
  propertyName: string | null;
  entityAttributeName: string | null;
  definition: string | null;
  requirementStatus: string | null;
  formatSpecification: string | null;
  dataTypeHint: string | null;
  presenceConstraint: string | null;
  relationshipVerb: string | null;
  sourceRowNumber: number;
  rowSha256: string;
  constraints: RdlSchemaConstraint[];
};

export type RdlSchemaDictionaryPayload = {
  schemaVersion: "rdl-schema-dictionary/v1";
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  versionLabel: string;
  releaseStatus: string;
  packageKey: string;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  items: RdlSchemaDictionaryItem[];
};

export async function loadRdlSchemaDictionary(options: {
  sourceKey?: string;
  releaseKey?: string;
  conceptKind?: string;
  q?: string;
  limit?: number;
} = {}): Promise<RdlSchemaDictionaryPayload> {
  const params = new URLSearchParams({
    sourceKey: options.sourceKey ?? "cfihos",
    releaseKey: options.releaseKey ?? "cfihos-2.0",
    limit: String(options.limit ?? 500),
  });
  if (options.conceptKind) params.set("conceptKind", options.conceptKind);
  if (options.q) params.set("q", options.q);
  const response = await fetch(`/api/rdl-runtime/schema-dictionary?${params.toString()}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error(`Schema Dictionary API failed (${response.status}).`);
  }
  const payload = await response.json() as RdlSchemaDictionaryPayload;
  if (payload.schemaVersion !== "rdl-schema-dictionary/v1" || !Array.isArray(payload.items)) {
    throw new Error("Schema Dictionary API returned an incompatible payload.");
  }
  return payload;
}
