export const RDL_MULTI_RDL_COMPOSITION_SCHEMA_VERSION = "rdl-multi-rdl-composition/v1" as const;

export type RdlTargetLayer = "company" | "asset" | "project";
export type CompositionKind = "multi_source_merge" | "derived_copy" | "promotion";
export type CompositionComponentKind = "definition" | "hierarchy" | "property" | "attribute" | "document_type" | "discipline" | "information_requirement" | "relationship" | "controlled_value" | "unit_of_measure" | "other";
export type CompositionResolution = "use_source" | "combine" | "target_override" | "keep_separate" | "exclude" | "reference_only";

export type RdlEntitySnapshot = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition?: string;
  properties?: readonly string[];
  attributes?: readonly string[];
  documents?: readonly string[];
  disciplines?: readonly string[];
  informationRequirements?: readonly string[];
  relationships?: readonly string[];
};

export type CompositionComponentDecision = {
  componentKind: CompositionComponentKind;
  componentKey: string;
  resolution: CompositionResolution;
  selectedContributorKeys?: readonly string[];
  resolvedValue?: unknown;
  rationale: string;
};

export type MultiRdlCompositionDraft = {
  schemaVersion: typeof RDL_MULTI_RDL_COMPOSITION_SCHEMA_VERSION;
  targetLayer: RdlTargetLayer;
  targetContextKey: string;
  compositionKind: CompositionKind;
  targetEntityType: string;
  targetNativeIdentifier: string;
  targetName: string;
  contributors: RdlEntitySnapshot[];
  componentDecisions: CompositionComponentDecision[];
  rationale: string;
  boundary: {
    sourceEntitiesImmutable: true;
    exactSourceIdentityRetained: true;
    sameNameDoesNotImplyEquivalence: true;
    promotionAutomatic: false;
    dataGateOwnsComposition: false;
    directDataGateToRdlDatabaseMutation: "prohibited";
  };
};

export type NameCollision = {
  entityType: string;
  normalizedName: string;
  candidates: RdlEntitySnapshot[];
  decisionRequired: true;
  automaticEquivalence: false;
};

function text(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${field} is required.`);
  return result;
}

export function exactEntityKey(entity: RdlEntitySnapshot): string {
  return [entity.sourceKey, entity.releaseKey, entity.packageKey, entity.entityType, entity.nativeIdentifier]
    .map((part, index) => text(part, `entity identity part ${index + 1}`))
    .join("::");
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function detectSameNameCollisions(entities: readonly RdlEntitySnapshot[]): NameCollision[] {
  const groups = new Map<string, RdlEntitySnapshot[]>();
  for (const entity of entities) {
    const key = `${text(entity.entityType, "entityType")}::${normalizedName(text(entity.name, "name"))}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(entity);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .filter(([, candidates]) => new Set(candidates.map((candidate) => candidate.packageKey)).size > 1)
    .map(([key, candidates]) => ({
      entityType: key.split("::", 1)[0],
      normalizedName: key.slice(key.indexOf("::") + 2),
      candidates: [...candidates].sort((a, b) => exactEntityKey(a).localeCompare(exactEntityKey(b))),
      decisionRequired: true as const,
      automaticEquivalence: false as const,
    }))
    .sort((a, b) => `${a.entityType}:${a.normalizedName}`.localeCompare(`${b.entityType}:${b.normalizedName}`));
}

function setDiff(left: readonly string[] = [], right: readonly string[] = []) {
  const l = new Set(left.map((value) => value.trim()).filter(Boolean));
  const r = new Set(right.map((value) => value.trim()).filter(Boolean));
  return {
    common: [...l].filter((value) => r.has(value)).sort(),
    leftOnly: [...l].filter((value) => !r.has(value)).sort(),
    rightOnly: [...r].filter((value) => !l.has(value)).sort(),
  };
}

export function compareCompositionCandidates(left: RdlEntitySnapshot, right: RdlEntitySnapshot) {
  if (left.entityType !== right.entityType) throw new Error("Composition candidates must have the same entity type.");
  return {
    leftIdentity: exactEntityKey(left),
    rightIdentity: exactEntityKey(right),
    nameEqual: normalizedName(left.name) === normalizedName(right.name),
    definitionEqual: (left.definition ?? "").trim() === (right.definition ?? "").trim(),
    properties: setDiff(left.properties, right.properties),
    attributes: setDiff(left.attributes, right.attributes),
    documents: setDiff(left.documents, right.documents),
    disciplines: setDiff(left.disciplines, right.disciplines),
    informationRequirements: setDiff(left.informationRequirements, right.informationRequirements),
    relationships: setDiff(left.relationships, right.relationships),
  };
}

export function createMultiRdlCompositionDraft(input: Omit<MultiRdlCompositionDraft, "schemaVersion" | "boundary">): MultiRdlCompositionDraft {
  const targetContextKey = text(input.targetContextKey, "targetContextKey");
  const targetEntityType = text(input.targetEntityType, "targetEntityType");
  const targetNativeIdentifier = text(input.targetNativeIdentifier, "targetNativeIdentifier");
  const targetName = text(input.targetName, "targetName");
  const rationale = text(input.rationale, "rationale");
  if (!input.contributors.length) throw new Error("At least one exact source contributor is required.");
  const keys = input.contributors.map(exactEntityKey);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate source contributors are not allowed.");
  if (input.compositionKind === "multi_source_merge" && new Set(input.contributors.map((c) => c.packageKey)).size < 2) {
    throw new Error("multi_source_merge requires contributors from at least two exact source packages.");
  }
  const contributorSet = new Set(keys);
  const componentKeys = new Set<string>();
  const componentDecisions = input.componentDecisions.map((decision) => {
    const componentKey = text(decision.componentKey, "componentKey");
    const decisionKey = `${decision.componentKind}::${componentKey}`;
    if (componentKeys.has(decisionKey)) throw new Error(`Duplicate component decision: ${decisionKey}`);
    componentKeys.add(decisionKey);
    const selectedContributorKeys = [...new Set(decision.selectedContributorKeys ?? [])];
    for (const key of selectedContributorKeys) if (!contributorSet.has(key)) throw new Error(`Unknown selected contributor: ${key}`);
    if (decision.resolution === "use_source" && selectedContributorKeys.length !== 1) throw new Error("use_source requires exactly one selected contributor.");
    if (decision.resolution === "combine" && selectedContributorKeys.length < 2) throw new Error("combine requires at least two selected contributors.");
    if (decision.resolution === "target_override" && decision.resolvedValue === undefined) throw new Error("target_override requires a resolvedValue.");
    return { ...decision, componentKey, selectedContributorKeys, rationale: text(decision.rationale, "component rationale") };
  });
  return {
    schemaVersion: RDL_MULTI_RDL_COMPOSITION_SCHEMA_VERSION,
    targetLayer: input.targetLayer,
    targetContextKey,
    compositionKind: input.compositionKind,
    targetEntityType,
    targetNativeIdentifier,
    targetName,
    contributors: [...input.contributors],
    componentDecisions,
    rationale,
    boundary: {
      sourceEntitiesImmutable: true,
      exactSourceIdentityRetained: true,
      sameNameDoesNotImplyEquivalence: true,
      promotionAutomatic: false,
      dataGateOwnsComposition: false,
      directDataGateToRdlDatabaseMutation: "prohibited",
    },
  };
}

export function compositionDependencyKeys(composition: MultiRdlCompositionDraft): string[] {
  return composition.contributors.map(exactEntityKey).sort();
}

export function sourceUpgradeImpact(composition: MultiRdlCompositionDraft, changedExactEntityKeys: readonly string[]) {
  const changed = new Set(changedExactEntityKeys);
  const affectedContributors = compositionDependencyKeys(composition).filter((key) => changed.has(key));
  return { impacted: affectedContributors.length > 0, affectedContributors, automaticMigration: false as const };
}

export function promotionCandidateReport<T extends { extensionChangeId: number; sourceLayer: "project" | "asset"; approved: boolean; alreadyPromoted: boolean }>(changes: readonly T[]) {
  return changes
    .filter((change) => change.approved && !change.alreadyPromoted)
    .map((change) => ({ ...change, advisoryOnly: true as const, automaticPromotion: false as const }))
    .sort((a, b) => a.extensionChangeId - b.extensionChangeId);
}
