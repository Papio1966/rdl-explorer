import { entityTypeLabel, rdlEntityRoute } from "./catalog";
import { loadRdlSearchIndex, type RdlSearchRecord } from "./search";

export type RdlRelationshipIndexRecord = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  attributes: Record<string, string>;
  sourceSheet: string;
};

export type RdlDetailLinkedEntity = {
  key: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  href: string;
  relationshipType: string;
  relationshipLabel: string;
  attributes: Record<string, string>;
};

export type RdlEntityDetailProjection = {
  record: RdlSearchRecord;
  classification: Array<{ label: string; value: string }>;
  hierarchy: {
    parents: RdlDetailLinkedEntity[];
    children: RdlDetailLinkedEntity[];
  };
  properties: RdlDetailLinkedEntity[];
  relatedClasses: RdlDetailLinkedEntity[];
  usedByClasses: RdlDetailLinkedEntity[];
  requiredDocuments: RdlDetailLinkedEntity[];
  requiredByClasses: RdlDetailLinkedEntity[];
  disciplines: RdlDetailLinkedEntity[];
  documentTypes: RdlDetailLinkedEntity[];
  unitsOfMeasure: RdlDetailLinkedEntity[];
  allowedValues: RdlDetailLinkedEntity[];
  informationRequirements: RdlDetailLinkedEntity[];
  sourceStandards: RdlDetailLinkedEntity[];
  propertyMappings: RdlDetailLinkedEntity[];
  controlledValues: RdlDetailLinkedEntity[];
};

let relationshipIndexPromise: Promise<RdlRelationshipIndexRecord[]> | null = null;

export function loadRdlRelationshipIndex(): Promise<RdlRelationshipIndexRecord[]> {
  relationshipIndexPromise ??= fetch("/rdl-relationship-index.json").then((response) => {
    if (!response.ok) throw new Error(`Unable to load RDL relationship index (${response.status})`);
    return response.json() as Promise<RdlRelationshipIndexRecord[]>;
  });
  return relationshipIndexPromise;
}

function identityKey(entityType: string, nativeIdentifier: string) {
  return `${entityType}|${nativeIdentifier}`;
}

function humanRelationship(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(items: RdlDetailLinkedEntity[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name) || a.nativeIdentifier.localeCompare(b.nativeIdentifier));
}

function isClassType(entityType: string) {
  return ["class", "tag_class", "equipment_class"].includes(entityType);
}

export async function loadRdlEntityDetail(
  sourceKey: string,
  releaseKey: string,
  entityType: string,
  nativeIdentifier: string,
): Promise<RdlEntityDetailProjection | null> {
  const [entities, relationships] = await Promise.all([loadRdlSearchIndex(), loadRdlRelationshipIndex()]);
  return projectRdlEntityDetail(entities, relationships, sourceKey, releaseKey, entityType, nativeIdentifier);
}

export function projectRdlEntityDetail(
  entities: RdlSearchRecord[],
  relationships: RdlRelationshipIndexRecord[],
  sourceKey: string,
  releaseKey: string,
  entityType: string,
  nativeIdentifier: string,
): RdlEntityDetailProjection | null {
  const record = entities.find((item) =>
    item.sourceKey === sourceKey
    && item.releaseKey === releaseKey
    && item.entityType === entityType
    && item.nativeIdentifier === nativeIdentifier,
  );
  if (!record) return null;

  const releaseEntities = entities.filter((item) =>
    item.sourceKey === record.sourceKey
    && item.releaseKey === record.releaseKey
    && item.packageKey === record.packageKey,
  );
  const entityMap = new Map(releaseEntities.map((item) => [identityKey(item.entityType, item.nativeIdentifier), item]));
  const releaseRelationships = relationships.filter((item) =>
    item.sourceKey === record.sourceKey
    && item.releaseKey === record.releaseKey
    && item.packageKey === record.packageKey,
  );

  const selectedKey = identityKey(record.entityType, record.nativeIdentifier);
  const outgoing = releaseRelationships.filter((item) => identityKey(item.sourceEntityType, item.sourceNativeIdentifier) === selectedKey);
  const incoming = releaseRelationships.filter((item) => identityKey(item.targetEntityType, item.targetNativeIdentifier) === selectedKey);

  const linkFor = (
    relationship: RdlRelationshipIndexRecord,
    direction: "source" | "target",
    additionalAttributes: Record<string, string> = {},
    keySuffix = "",
  ): RdlDetailLinkedEntity | null => {
    const linkedType = direction === "target" ? relationship.targetEntityType : relationship.sourceEntityType;
    const linkedId = direction === "target" ? relationship.targetNativeIdentifier : relationship.sourceNativeIdentifier;
    const entity = entityMap.get(identityKey(linkedType, linkedId));
    if (!entity) return null;
    const evidenceId = relationship.attributes.mappingId || relationship.attributes.relationshipId || keySuffix;
    return {
      key: [identityKey(entity.entityType, entity.nativeIdentifier), relationship.relationshipType, evidenceId].filter(Boolean).join("|"),
      entityType: entity.entityType,
      nativeIdentifier: entity.nativeIdentifier,
      name: entity.name || entity.nativeIdentifier,
      definition: entity.definition,
      href: rdlEntityRoute(record.sourceKey, record.releaseKey, entity.entityType, entity.nativeIdentifier),
      relationshipType: relationship.relationshipType,
      relationshipLabel: humanRelationship(relationship.relationshipType),
      attributes: { ...relationship.attributes, ...additionalAttributes },
    };
  };

  const outgoingLinks = (type: string) => outgoing
    .filter((item) => item.relationshipType === type)
    .map((item) => linkFor(item, "target"))
    .filter((item): item is RdlDetailLinkedEntity => Boolean(item));
  const incomingLinks = (type: string) => incoming
    .filter((item) => item.relationshipType === type)
    .map((item) => linkFor(item, "source"))
    .filter((item): item is RdlDetailLinkedEntity => Boolean(item));

  const parents = unique(outgoingLinks("entity_parent"));
  const children = unique(incomingLinks("entity_parent"));

  // CFIHOS specialist pages expose effective properties. Preserve that semantic
  // generically by walking only explicit same-release entity_parent edges and by
  // letting the closest (direct) assignment win for each property.
  const effectiveClassProperties = (): RdlDetailLinkedEntity[] => {
    if (!isClassType(record.entityType)) return [];
    const resolved = new Map<string, RdlDetailLinkedEntity>();
    const visited = new Set<string>();
    let currentType = record.entityType;
    let currentId = record.nativeIdentifier;
    let depth = 0;

    while (currentId && !visited.has(identityKey(currentType, currentId))) {
      visited.add(identityKey(currentType, currentId));
      const currentEntity = entityMap.get(identityKey(currentType, currentId));
      const classRelationships = releaseRelationships.filter((item) =>
        item.relationshipType === "class_property"
        && item.sourceEntityType === currentType
        && item.sourceNativeIdentifier === currentId,
      );
      for (const relationship of classRelationships) {
        const propertyId = relationship.targetNativeIdentifier;
        if (resolved.has(propertyId)) continue;
        const linked = linkFor(relationship, "target", {
          assignmentType: depth === 0 ? "direct" : "inherited",
          sourceClassId: currentId,
          sourceClassName: currentEntity?.name || currentId,
          inheritanceDepth: String(depth),
        }, `${currentId}:${depth}`);
        if (linked) resolved.set(propertyId, linked);
      }

      const parent = releaseRelationships.find((item) =>
        item.relationshipType === "entity_parent"
        && item.sourceEntityType === currentType
        && item.sourceNativeIdentifier === currentId
        && item.targetEntityType === currentType,
      );
      if (!parent) break;
      currentId = parent.targetNativeIdentifier;
      currentType = parent.targetEntityType;
      depth += 1;
    }

    return [...resolved.values()].sort((a, b) => a.name.localeCompare(b.name) || a.nativeIdentifier.localeCompare(b.nativeIdentifier));
  };

  const properties = isClassType(record.entityType)
    ? effectiveClassProperties()
    : unique(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_property") : []);

  const relatedClasses = unique([
    ...outgoingLinks("tag_equipment_mapping"),
    ...incomingLinks("tag_equipment_mapping"),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_class") : []),
  ].filter((item) => isClassType(item.entityType)));

  const usedByClasses = unique([
    ...(record.entityType === "property" ? incomingLinks("class_property") : []),
    ...(record.entityType === "source_standard" ? incomingLinks("entity_source_standard") : []),
  ].filter((item) => isClassType(item.entityType)));

  const requiredDocuments = unique([
    ...outgoingLinks("class_document"),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_document") : []),
  ].filter((item) => item.entityType === "document_type"));

  const requiredByClasses = unique(
    (record.entityType === "document_type" ? incomingLinks("class_document") : [])
      .filter((item) => isClassType(item.entityType)),
  );

  const disciplines = unique(
    (record.entityType === "document_type" ? outgoingLinks("document_discipline") : [])
      .filter((item) => item.entityType === "discipline"),
  );

  const documentTypes = unique(
    (record.entityType === "discipline" ? incomingLinks("document_discipline") : [])
      .filter((item) => item.entityType === "document_type"),
  );

  const unitsOfMeasure = unique(
    (record.entityType === "property" ? outgoingLinks("property_unit") : [])
      .filter((item) => item.entityType === "unit_of_measure"),
  );

  const allowedValues = unique(
    (record.entityType === "property" ? outgoingLinks("property_controlled_value") : [])
      .filter((item) => item.entityType === "controlled_value"),
  );

  const informationRequirements = unique([
    ...incomingLinks("information_requirement_class"),
    ...incomingLinks("information_requirement_property"),
    ...incomingLinks("information_requirement_document"),
    ...incomingLinks("information_requirement_standard"),
  ].filter((item) => item.entityType === "information_requirement"));

  const sourceStandards = unique([
    ...outgoingLinks("entity_source_standard"),
    ...(record.entityType === "property" ? outgoingLinks("mapping_property_standard") : []),
    ...(record.entityType === "controlled_value" ? outgoingLinks("controlled_value_source_standard") : []),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_standard") : []),
  ].filter((item) => item.entityType === "source_standard"));

  const propertyMappings = unique(
    (record.entityType === "source_standard" ? incomingLinks("mapping_property_standard") : [])
      .filter((item) => item.entityType === "property"),
  );

  const controlledValues = unique(
    (record.entityType === "source_standard" ? incomingLinks("controlled_value_source_standard") : [])
      .filter((item) => item.entityType === "controlled_value"),
  );

  return {
    record,
    classification: [
      { label: "Entity type", value: entityTypeLabel(record.entityType) },
      { label: "RDL source", value: record.sourceName },
      { label: "Release state", value: record.releaseStatus },
    ],
    hierarchy: { parents, children },
    properties,
    relatedClasses,
    usedByClasses,
    requiredDocuments,
    requiredByClasses,
    disciplines,
    documentTypes,
    unitsOfMeasure,
    allowedValues,
    informationRequirements,
    sourceStandards,
    propertyMappings,
    controlledValues,
  };
}
