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
  requiredDocuments: RdlDetailLinkedEntity[];
  informationRequirements: RdlDetailLinkedEntity[];
  sourceStandards: RdlDetailLinkedEntity[];
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

export async function loadRdlEntityDetail(
  sourceKey: string,
  releaseKey: string,
  entityType: string,
  nativeIdentifier: string,
): Promise<RdlEntityDetailProjection | null> {
  const [entities, relationships] = await Promise.all([loadRdlSearchIndex(), loadRdlRelationshipIndex()]);
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

  const linkFor = (relationship: RdlRelationshipIndexRecord, direction: "source" | "target"): RdlDetailLinkedEntity | null => {
    const linkedType = direction === "target" ? relationship.targetEntityType : relationship.sourceEntityType;
    const linkedId = direction === "target" ? relationship.targetNativeIdentifier : relationship.sourceNativeIdentifier;
    const entity = entityMap.get(identityKey(linkedType, linkedId));
    if (!entity) return null;
    return {
      key: identityKey(entity.entityType, entity.nativeIdentifier),
      entityType: entity.entityType,
      nativeIdentifier: entity.nativeIdentifier,
      name: entity.name || entity.nativeIdentifier,
      definition: entity.definition,
      href: rdlEntityRoute(record.sourceKey, record.releaseKey, entity.entityType, entity.nativeIdentifier),
      relationshipType: relationship.relationshipType,
      relationshipLabel: humanRelationship(relationship.relationshipType),
      attributes: relationship.attributes,
    };
  };

  const outgoingLinks = (type: string) => outgoing.filter((item) => item.relationshipType === type).map((item) => linkFor(item, "target")).filter((item): item is RdlDetailLinkedEntity => Boolean(item));
  const incomingLinks = (type: string) => incoming.filter((item) => item.relationshipType === type).map((item) => linkFor(item, "source")).filter((item): item is RdlDetailLinkedEntity => Boolean(item));

  const parents = unique(outgoingLinks("entity_parent"));
  const children = unique(incomingLinks("entity_parent"));
  const properties = unique([
    ...outgoingLinks("class_property"),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_property") : []),
  ]);
  const relatedClasses = unique([
    ...outgoingLinks("tag_equipment_mapping"),
    ...incomingLinks("tag_equipment_mapping"),
    ...(record.entityType === "property" ? incomingLinks("class_property") : []),
    ...(record.entityType === "document_type" ? incomingLinks("class_document") : []),
    ...(record.entityType === "source_standard" ? incomingLinks("entity_source_standard") : []),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_class") : []),
  ].filter((item) => ["class", "tag_class", "equipment_class"].includes(item.entityType)));
  const requiredDocuments = unique([
    ...outgoingLinks("class_document"),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_document") : []),
  ].filter((item) => item.entityType === "document_type"));
  const informationRequirements = unique([
    ...incomingLinks("information_requirement_class"),
    ...incomingLinks("information_requirement_property"),
    ...incomingLinks("information_requirement_document"),
    ...incomingLinks("information_requirement_standard"),
  ].filter((item) => item.entityType === "information_requirement"));
  const sourceStandards = unique([
    ...outgoingLinks("entity_source_standard"),
    ...(record.entityType === "information_requirement" ? outgoingLinks("information_requirement_standard") : []),
  ].filter((item) => item.entityType === "source_standard"));

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
    requiredDocuments,
    informationRequirements,
    sourceStandards,
  };
}
