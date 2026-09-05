import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type RdlRuntimeFacetValue = { value: string; label?: string };
export type RdlRuntimeSearchRecord = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  releaseStatus: string;
  versionLabel: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  sourceSheet: string;
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: string[];
  facets?: Record<string, RdlRuntimeFacetValue>;
};

export type RdlRuntimeRelationshipRecord = {
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

export type RdlRuntimeProjection = {
  searchRecords: RdlRuntimeSearchRecord[];
  relationshipRecords: RdlRuntimeRelationshipRecord[];
};

type EntityRow = {
  source_key: string;
  source_name: string;
  release_key: string;
  release_status: string;
  version_label: string;
  package_key: string;
  entity_type_code: string;
  native_identifier: string;
  name: string;
  definition: string | null;
  normalized_metadata: Record<string, unknown>;
  source_locator: Record<string, unknown>;
};

type RelationshipRow = {
  source_key: string;
  source_name: string;
  release_key: string;
  release_status: string;
  version_label: string;
  package_key: string;
  relationship_type_code: string;
  source_type: string;
  source_identifier: string;
  target_type: string;
  target_identifier: string;
  attributes: Record<string, unknown>;
  source_locator: Record<string, unknown>;
};

type PackageContext = Pick<RdlRuntimeRelationshipRecord, "sourceKey" | "sourceName" | "releaseKey" | "releaseStatus" | "versionLabel" | "packageKey">;
type Entity = EntityRow & { metadata: Record<string, unknown>; sourceSheet: string; context: PackageContext };
type Relationship = RelationshipRow & { sourceSheet: string; context: PackageContext };

const SEARCH_ENTITY_TYPES = new Set([
  "tag_class",
  "equipment_class",
  "property",
  "document_type",
  "discipline",
  "unit_of_measure",
  "source_standard",
  "handover_event",
  "controlled_value",
  "information_requirement",
]);

const text = (value: unknown) => String(value ?? "").trim();
const same = (left: unknown, right: unknown) => {
  const a = text(left).toLocaleLowerCase();
  const b = text(right).toLocaleLowerCase();
  return Boolean(a && b && a === b);
};
const unique = (values: unknown[]) => [...new Set(values.map(text).filter(Boolean))];
const splitAliases = (value: unknown) => unique(text(value).split(/[;|\n]+/));
const sourceSheet = (locator: Record<string, unknown>) => text(locator.sheet);
const entityKey = (type: string, id: string) => `${type}|${id}`;
const isClassEntityType = (type: string) => ["class", "tag_class", "equipment_class"].includes(type);
const compactAttributes = (values: Record<string, unknown>): Record<string, string> => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [key, text(value)] as const).filter(([, value]) => Boolean(value)),
);
const selected = (values: Record<string, unknown>, keys: string[]) => compactAttributes(Object.fromEntries(keys.map((key) => [key, values[key]])));

function releaseStatus(value: string, releaseKey: string) {
  if (releaseKey.endsWith("0.1-draft") || value === "superseded") return "superseded";
  if (value === "published") return "reviewed";
  return value;
}

function contextOf(row: Pick<EntityRow, "source_key" | "source_name" | "release_key" | "release_status" | "version_label" | "package_key">): PackageContext {
  return {
    sourceKey: row.source_key,
    sourceName: row.source_name,
    releaseKey: row.release_key,
    releaseStatus: releaseStatus(row.release_status, row.release_key),
    versionLabel: row.version_label,
    packageKey: row.package_key,
  };
}

function browseMetadata(entity: Entity): Partial<RdlRuntimeSearchRecord> {
  const m = entity.metadata;
  switch (entity.entity_type_code) {
    case "tag_class": {
      const parent = text(m.parentName) || text(m.parentId);
      const aliases = splitAliases(m.synonym);
      const searchText = unique([parent, m.existenceReason]);
      const badges = m.abstract === true || ["yes", "y", "true", "1"].includes(text(m.abstract).toLocaleLowerCase()) ? ["Abstract"] : [];
      return compactBrowse({ aliases, searchText, secondaryLabel: parent ? `Parent: ${parent}` : undefined, badges });
    }
    case "equipment_class": {
      const parent = text(m.parentName) || text(m.parentId);
      return compactBrowse({
        aliases: splitAliases(m.synonym),
        searchText: unique([parent, m.existenceReason]),
        secondaryLabel: parent ? `Parent: ${parent}` : undefined,
        badges: m.abstract === true || ["yes", "y", "true", "1"].includes(text(m.abstract).toLocaleLowerCase()) ? ["Abstract"] : [],
      });
    }
    case "document_type": {
      const shortCode = text(m.shortCode);
      const classification = text(m.classification);
      return compactBrowse({ aliases: splitAliases(m.synonym), searchText: unique([shortCode, classification]), secondaryLabel: shortCode || undefined, tertiaryLabel: classification || undefined });
    }
    case "property": {
      const dataType = text(m.dataType);
      const dimension = text(m.dimensionCode) || text(m.dimensionName);
      const picklist = text(m.controlledListName) || text(m.controlledListId);
      const unit = entity.context.sourceKey === "cfihos" ? "" : text(m.unitId);
      return compactBrowse({
        aliases: splitAliases(m.synonym),
        searchText: unique([dataType, dimension, picklist, unit, m.existenceReason]),
        secondaryLabel: dataType || undefined,
        tertiaryLabel: picklist || dimension || unit || undefined,
      });
    }
    case "discipline": {
      const code = text(m.code);
      return compactBrowse({ searchText: unique([code]), secondaryLabel: code || undefined });
    }
    case "unit_of_measure": {
      const symbol = text(m.symbol);
      const unece = text(m.uneceCode);
      const dimensionId = text(m.dimensionId);
      const dimensionCode = text(m.dimensionCode);
      const dimensionName = text(m.dimensionName);
      const systemId = text(m.measurementSystemId);
      const systemCode = text(m.measurementSystemCode);
      const systemName = text(m.measurementSystemName);
      const dimensionValue = dimensionId || dimensionCode || dimensionName;
      const dimensionLabel = dimensionName || dimensionCode || dimensionId;
      return compactBrowse({
        aliases: splitAliases(m.synonym),
        searchText: unique([symbol, unece, dimensionId, dimensionCode, dimensionName, systemId, systemCode, systemName]),
        secondaryLabel: unique([symbol, unece]).join(" · ") || undefined,
        tertiaryLabel: dimensionLabel || undefined,
        facets: dimensionValue ? { dimension: { value: dimensionValue, label: dimensionLabel } } : undefined,
      });
    }
    default:
      return {};
  }
}

function cfihosBrowserRequirementAttributes(metadata: Record<string, unknown>): Record<string, string> {
  return compactAttributes({
    requirementNumber: metadata.projectionRequirementNumber,
    requirementTitle: metadata.projectionRequirementTitle,
    requirementGroup: metadata.projectionRequirementGroup,
    typicalDeliverable: metadata.projectionTypicalDeliverable,
    submitAtProposal: metadata.projectionSubmitAtProposal,
    submitForReview: metadata.projectionSubmitForReview,
    submitAtDelivery: metadata.projectionSubmitAtDelivery,
    requiredHandoverStatus: metadata.projectionRequiredHandoverStatus,
    requiredTranslation: metadata.projectionRequiredTranslation,
    deliverableFormat: metadata.projectionDeliverableFormat,
    sourceChapter: metadata.projectionSourceChapter,
    reviewWeeks: metadata.projectionReviewWeeks,
    reviewReferenceDate: metadata.projectionReviewReferenceDate,
    approvalWeeks: metadata.projectionApprovalWeeks,
    approvalReferenceDate: metadata.projectionApprovalReferenceDate,
    informationWeeks: metadata.projectionInformationWeeks,
    informationReferenceDate: metadata.projectionInformationReferenceDate,
  });
}

function compactBrowse(value: {
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: string[];
  facets?: Record<string, RdlRuntimeFacetValue>;
}) {
  const result: typeof value = {};
  const aliases = unique(value.aliases ?? []);
  const searchText = unique(value.searchText ?? []);
  const badges = unique(value.badges ?? []);
  if (aliases.length) result.aliases = aliases;
  if (searchText.length) result.searchText = searchText;
  if (text(value.secondaryLabel)) result.secondaryLabel = text(value.secondaryLabel);
  if (text(value.tertiaryLabel)) result.tertiaryLabel = text(value.tertiaryLabel);
  if (badges.length) result.badges = badges;
  const facets = Object.fromEntries(Object.entries(value.facets ?? {}).filter(([, facet]) => text(facet.value)));
  if (Object.keys(facets).length) result.facets = facets;
  return result;
}

export class RdlRuntimeProjectionRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async project(sourceKey: string | null = null, releaseKey: string | null = null): Promise<RdlRuntimeProjection> {
    const [rawEntities, rawRelationships] = await Promise.all([
      this.loadEntities(sourceKey, releaseKey),
      this.loadRelationships(sourceKey, releaseKey),
    ]);
    const entities: Entity[] = rawEntities.map((row) => ({ ...row, metadata: row.normalized_metadata ?? {}, sourceSheet: sourceSheet(row.source_locator ?? {}), context: contextOf(row) }));
    const relationships: Relationship[] = rawRelationships.map((row) => ({ ...row, sourceSheet: sourceSheet(row.source_locator ?? {}), context: contextOf(row) }));
    return {
      searchRecords: this.projectSearch(entities),
      relationshipRecords: this.projectRelationships(entities, relationships),
    };
  }

  async projectSearchRecords(sourceKey: string, releaseKey: string): Promise<RdlRuntimeSearchRecord[]> {
    const rawEntities = await this.loadEntities(sourceKey, releaseKey);
    const entities: Entity[] = rawEntities.map((row) => ({
      ...row,
      metadata: row.normalized_metadata ?? {},
      sourceSheet: sourceSheet(row.source_locator ?? {}),
      context: contextOf(row),
    }));
    return this.projectSearch(entities);
  }

  async projectRelationshipRecords(sourceKey: string, releaseKey: string): Promise<RdlRuntimeRelationshipRecord[]> {
    const [rawEntities, rawRelationships] = await Promise.all([
      this.loadEntities(sourceKey, releaseKey),
      this.loadRelationships(sourceKey, releaseKey),
    ]);
    const entities: Entity[] = rawEntities.map((row) => ({
      ...row,
      metadata: row.normalized_metadata ?? {},
      sourceSheet: sourceSheet(row.source_locator ?? {}),
      context: contextOf(row),
    }));
    const relationships: Relationship[] = rawRelationships.map((row) => ({
      ...row,
      sourceSheet: sourceSheet(row.source_locator ?? {}),
      context: contextOf(row),
    }));
    return this.projectRelationships(entities, relationships);
  }

  async projectEntityParentRecords(sourceKey: string, releaseKey: string): Promise<RdlRuntimeRelationshipRecord[]> {
    const { sourceFilter, releaseFilter } = filters(sourceKey, releaseKey);
    const rows = await this.client.query<RelationshipRow>(`
      WITH selected_packages AS (
        SELECT DISTINCT ON (r.release_id)
          p.package_id, p.package_key, s.source_key, s.name AS source_name,
          r.release_key, r.release_status, r.version_label
        FROM rdl.rdl_package p
        JOIN rdl.rdl_release r ON r.release_id = p.release_id
        JOIN rdl.rdl_source s ON s.source_id = r.source_id
        WHERE p.package_status = 'validated'
          ${sourceFilter}
          ${releaseFilter}
        ORDER BY r.release_id, p.package_id DESC
      )
      SELECT sp.source_key, sp.source_name, sp.release_key, sp.release_status, sp.version_label, sp.package_key,
             rel.relationship_type_code,
             src.entity_type_code AS source_type, src.native_identifier AS source_identifier,
             tgt.entity_type_code AS target_type, tgt.native_identifier AS target_identifier,
             '{}'::jsonb AS attributes, rel.source_locator
      FROM selected_packages sp
      JOIN rdl.rdl_relationship rel ON rel.package_id = sp.package_id
      JOIN rdl.rdl_entity src ON src.entity_id = rel.source_entity_id
      JOIN rdl.rdl_entity tgt ON tgt.entity_id = rel.target_entity_id
      WHERE rel.relationship_type_code = 'entity_parent'
      ORDER BY sp.source_key, sp.release_key, src.entity_type_code, src.native_identifier,
               tgt.entity_type_code, tgt.native_identifier, rel.relationship_id
    `);

    return rows.map((row) => ({
      ...contextOf(row),
      relationshipType: 'entity_parent',
      sourceEntityType: row.source_type,
      sourceNativeIdentifier: row.source_identifier,
      targetEntityType: row.target_type,
      targetNativeIdentifier: row.target_identifier,
      attributes: {},
      sourceSheet: sourceSheet(row.source_locator ?? {}),
    }));
  }

  async projectDetailProjection(
    sourceKey: string,
    releaseKey: string,
    entityType: string,
    nativeIdentifier: string,
  ): Promise<RdlRuntimeProjection> {
    const rawEntities = await this.loadEntities(sourceKey, releaseKey);
    const entities: Entity[] = rawEntities.map((row) => ({
      ...row,
      metadata: row.normalized_metadata ?? {},
      sourceSheet: sourceSheet(row.source_locator ?? {}),
      context: contextOf(row),
    }));
    const anchor = entities.find((entity) =>
      entity.entity_type_code === entityType && entity.native_identifier === nativeIdentifier
    );
    if (!anchor) return { searchRecords: [], relationshipRecords: [] };

    const rawRelationships = await this.loadDetailRelationships(sourceKey, releaseKey, entityType, nativeIdentifier);
    const relationships: Relationship[] = rawRelationships.map((row) => ({
      ...row,
      sourceSheet: sourceSheet(row.source_locator ?? {}),
      context: contextOf(row),
    }));
    const closure = this.detailEntityClosure(entities, relationships, anchor);
    const projected = this.projectRelationships(closure, relationships);
    return {
      searchRecords: this.projectSearch(closure),
      relationshipRecords: this.projectDetailRelationships(projected, anchor),
    };
  }

  private detailEntityClosure(entities: Entity[], relationships: Relationship[], anchor: Entity): Entity[] {
    const allByKey = new Map(entities.map((entity) => [entityKey(entity.entity_type_code, entity.native_identifier), entity]));
    const kept = new Map<string, Entity>();
    const add = (type: string, id: unknown) => {
      const key = entityKey(type, text(id));
      const entity = allByKey.get(key);
      if (entity) kept.set(key, entity);
      return entity;
    };
    const addRequirementRefs = (requirement: Entity) => {
      const m = requirement.metadata;
      const classId = text(m.classId);
      if (classId) add("tag_class", classId) || add("equipment_class", classId);
      add("property", m.propertyId);
      add("document_type", m.documentId);
      add("source_standard", m.sourceStandardId);
    };
    const addMappingRefs = (mapping: Entity) => {
      const m = mapping.metadata;
      add("property", m.propertyId);
      add("source_standard", m.sourceStandardId);
    };

    add(anchor.entity_type_code, anchor.native_identifier);
    for (const relationship of relationships) {
      add(relationship.source_type, relationship.source_identifier);
      add(relationship.target_type, relationship.target_identifier);
      const attrs = relationship.attributes ?? {};
      const requirement = add("information_requirement", attrs.requirementId);
      if (requirement) addRequirementRefs(requirement);
      add("source_standard", attrs.sourceStandardId);
      add("unit_of_measure", attrs.siUnitId);
      add("unit_of_measure", attrs.imperialUnitId);
    }

    const anchorType = anchor.entity_type_code;
    const anchorId = anchor.native_identifier;

    if (anchorType === "property") {
      const property = anchor;
      const isCfihos = property.context.sourceKey === "cfihos";
      const propertyRefs = isCfihos
        ? unique([property.metadata.dimensionId, property.metadata.dimensionCode])
        : unique([property.metadata.unitId, property.metadata.dimensionReference]);
      for (const unit of entities.filter((entity) => entity.entity_type_code === "unit_of_measure")) {
        const unitRefs = isCfihos
          ? unique([unit.metadata.dimensionId, unit.metadata.dimensionCode, unit.metadata.dimensionName])
          : unique([unit.metadata.dimensionName, unit.metadata.dimensionReference]);
        if ((!isCfihos && same(property.metadata.unitId, unit.native_identifier))
          || propertyRefs.some((left) => unitRefs.some((right) => same(left, right)))) {
          add("unit_of_measure", unit.native_identifier);
        }
      }
      const controlledListReference = text(property.metadata.controlledListId);
      if (controlledListReference) {
        for (const controlled of entities.filter((entity) => entity.entity_type_code === "controlled_value")) {
          const listId = text(controlled.metadata.controlledListId);
          const listName = text(controlled.metadata.controlledListName);
          const matches = isCfihos
            ? same(controlledListReference, listId)
            : (same(controlledListReference, listId) || same(controlledListReference, listName));
          if (matches) {
            add("controlled_value", controlled.native_identifier);
            add("source_standard", controlled.metadata.sourceStandardId);
          }
        }
      }
      for (const mapping of entities.filter((entity) => entity.entity_type_code === "source_mapping" && same(entity.metadata.propertyId, anchorId))) {
        kept.set(entityKey(mapping.entity_type_code, mapping.native_identifier), mapping);
        addMappingRefs(mapping);
      }
      for (const requirement of entities.filter((entity) => entity.entity_type_code === "information_requirement" && same(entity.metadata.propertyId, anchorId))) {
        kept.set(entityKey(requirement.entity_type_code, requirement.native_identifier), requirement);
        addRequirementRefs(requirement);
      }
    }

    if (anchorType === "source_standard") {
      for (const mapping of entities.filter((entity) => entity.entity_type_code === "source_mapping" && same(entity.metadata.sourceStandardId, anchorId))) {
        kept.set(entityKey(mapping.entity_type_code, mapping.native_identifier), mapping);
        addMappingRefs(mapping);
      }
      for (const controlled of entities.filter((entity) => entity.entity_type_code === "controlled_value" && same(entity.metadata.sourceStandardId, anchorId))) {
        add("controlled_value", controlled.native_identifier);
      }
      for (const requirement of entities.filter((entity) => entity.entity_type_code === "information_requirement" && same(entity.metadata.sourceStandardId, anchorId))) {
        kept.set(entityKey(requirement.entity_type_code, requirement.native_identifier), requirement);
        addRequirementRefs(requirement);
      }
    }

    if (isClassEntityType(anchorType)) {
      for (const requirement of entities.filter((entity) => entity.entity_type_code === "information_requirement" && same(entity.metadata.classId, anchorId))) {
        kept.set(entityKey(requirement.entity_type_code, requirement.native_identifier), requirement);
        addRequirementRefs(requirement);
      }
    }

    if (anchorType === "document_type") {
      for (const requirement of entities.filter((entity) => entity.entity_type_code === "information_requirement" && same(entity.metadata.documentId, anchorId))) {
        kept.set(entityKey(requirement.entity_type_code, requirement.native_identifier), requirement);
        addRequirementRefs(requirement);
      }
    }

    if (anchorType === "controlled_value") add("source_standard", anchor.metadata.sourceStandardId);
    if (anchorType === "information_requirement") addRequirementRefs(anchor);

    // Requirements introduced indirectly by a class-document row must be present for
    // the existing projection logic to derive the same rich-detail edges.
    for (const entity of [...kept.values()]) {
      if (entity.entity_type_code === "information_requirement") addRequirementRefs(entity);
    }

    return [...kept.values()];
  }

  private projectDetailRelationships(
    relationships: RdlRuntimeRelationshipRecord[],
    anchor: Entity,
  ): RdlRuntimeRelationshipRecord[] {
    const kept = new Set<RdlRuntimeRelationshipRecord>();
    const anchorType = anchor.entity_type_code;
    const anchorId = anchor.native_identifier;
    for (const relationship of relationships) {
      if ((relationship.sourceEntityType === anchorType && relationship.sourceNativeIdentifier === anchorId)
        || (relationship.targetEntityType === anchorType && relationship.targetNativeIdentifier === anchorId)) {
        kept.add(relationship);
      }
    }

    if (isClassEntityType(anchorType)) {
      const visited = new Set<string>();
      let currentId = anchorId;
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        for (const relationship of relationships) {
          if (relationship.relationshipType === "class_property"
            && relationship.sourceEntityType === anchorType
            && relationship.sourceNativeIdentifier === currentId) {
            kept.add(relationship);
          }
        }
        const parent = relationships.find((relationship) =>
          relationship.relationshipType === "entity_parent"
          && relationship.sourceEntityType === anchorType
          && relationship.sourceNativeIdentifier === currentId
          && relationship.targetEntityType === anchorType
        );
        if (!parent) break;
        kept.add(parent);
        currentId = parent.targetNativeIdentifier;
      }
    }

    return relationships.filter((relationship) => kept.has(relationship));
  }

  private async loadDetailRelationships(
    sourceKey: string,
    releaseKey: string,
    entityType: string,
    nativeIdentifier: string,
  ): Promise<RelationshipRow[]> {
    return this.client.query<RelationshipRow>(`
      WITH RECURSIVE selected_package AS (
        SELECT p.package_id, p.package_key, s.source_key, s.name AS source_name,
               r.release_key, r.release_status, r.version_label
        FROM rdl.rdl_package p
        JOIN rdl.rdl_release r ON r.release_id = p.release_id
        JOIN rdl.rdl_source s ON s.source_id = r.source_id
        WHERE p.package_status = 'validated'
          AND s.source_key = ${sqlLiteral(sourceKey)}
          AND r.release_key = ${sqlLiteral(releaseKey)}
        ORDER BY p.package_id DESC
        LIMIT 1
      ),
      ancestors AS (
        SELECT e.entity_id, e.package_id, e.entity_type_code, e.native_identifier, 0 AS depth
        FROM selected_package sp
        JOIN rdl.rdl_entity e ON e.package_id = sp.package_id
        WHERE e.entity_type_code = ${sqlLiteral(entityType)}
          AND e.native_identifier = ${sqlLiteral(nativeIdentifier)}
        UNION ALL
        SELECT parent.entity_id, parent.package_id, parent.entity_type_code, parent.native_identifier, a.depth + 1
        FROM ancestors a
        JOIN rdl.rdl_relationship rel
          ON rel.package_id = a.package_id
         AND rel.source_entity_id = a.entity_id
         AND rel.relationship_type_code = 'entity_parent'
        JOIN rdl.rdl_entity parent
          ON parent.entity_id = rel.target_entity_id
         AND parent.package_id = a.package_id
         AND parent.entity_type_code = a.entity_type_code
        WHERE a.depth < 50
      ),
      neighborhood_relationships AS (
        SELECT DISTINCT rel.relationship_id
        FROM ancestors a
        JOIN rdl.rdl_relationship rel
          ON rel.package_id = a.package_id
         AND (rel.source_entity_id = a.entity_id OR rel.target_entity_id = a.entity_id)
      )
      SELECT sp.source_key, sp.source_name, sp.release_key, sp.release_status, sp.version_label, sp.package_key,
             rel.relationship_type_code,
             src.entity_type_code AS source_type, src.native_identifier AS source_identifier,
             tgt.entity_type_code AS target_type, tgt.native_identifier AS target_identifier,
             rel.attributes, rel.source_locator
      FROM selected_package sp
      JOIN neighborhood_relationships nr ON true
      JOIN rdl.rdl_relationship rel ON rel.relationship_id = nr.relationship_id AND rel.package_id = sp.package_id
      JOIN rdl.rdl_entity src ON src.entity_id = rel.source_entity_id
      JOIN rdl.rdl_entity tgt ON tgt.entity_id = rel.target_entity_id
      ORDER BY rel.relationship_type_code, src.entity_type_code, src.native_identifier,
               tgt.entity_type_code, tgt.native_identifier, rel.relationship_id
    `);
  }

  private projectSearch(entities: Entity[]): RdlRuntimeSearchRecord[] {
    return entities
      .filter((entity) => SEARCH_ENTITY_TYPES.has(entity.entity_type_code))
      .map((entity) => ({
        ...entity.context,
        entityType: entity.entity_type_code,
        nativeIdentifier: entity.native_identifier,
        name: text(entity.metadata.projectionName) || entity.name || entity.native_identifier,
        definition: entity.metadata.projectionDefinition !== undefined ? text(entity.metadata.projectionDefinition) : (entity.definition ?? ""),
        sourceSheet: entity.sourceSheet,
        ...browseMetadata(entity),
      }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.releaseKey.localeCompare(b.releaseKey) || a.entityType.localeCompare(b.entityType) || a.nativeIdentifier.localeCompare(b.nativeIdentifier));
  }

  private projectRelationships(entities: Entity[], relationships: Relationship[]): RdlRuntimeRelationshipRecord[] {
    const output = new Map<string, RdlRuntimeRelationshipRecord>();
    const packages = new Map<string, { context: PackageContext; entities: Entity[]; relationships: Relationship[] }>();
    for (const entity of entities) {
      const group = packages.get(entity.context.packageKey) ?? { context: entity.context, entities: [], relationships: [] };
      group.entities.push(entity);
      packages.set(entity.context.packageKey, group);
    }
    for (const relationship of relationships) {
      const group = packages.get(relationship.context.packageKey) ?? { context: relationship.context, entities: [], relationships: [] };
      group.relationships.push(relationship);
      packages.set(relationship.context.packageKey, group);
    }

    const add = (context: PackageContext, relationshipType: string, sourceEntityType: string, sourceNativeIdentifier: string, targetEntityType: string, targetNativeIdentifier: string, attributes: Record<string, unknown>, sheet: string) => {
      if (!sourceNativeIdentifier || !targetNativeIdentifier) return;
      const record: RdlRuntimeRelationshipRecord = {
        ...context,
        relationshipType,
        sourceEntityType,
        sourceNativeIdentifier,
        targetEntityType,
        targetNativeIdentifier,
        attributes: compactAttributes(attributes),
        sourceSheet: sheet,
      };
      const key = [context.packageKey, relationshipType, sourceEntityType, sourceNativeIdentifier, targetEntityType, targetNativeIdentifier, relationshipType.startsWith("mapping_") ? (record.attributes.mappingId ?? "") : ""].join("|");
      output.set(key, record);
    };

    for (const group of packages.values()) {
      const { context, entities: packageEntities, relationships: packageRelationships } = group;
      const byEntity = new Map(packageEntities.map((entity) => [entityKey(entity.entity_type_code, entity.native_identifier), entity]));
      const byType = (type: string) => packageEntities.filter((entity) => entity.entity_type_code === type);
      const isCfihos = context.sourceKey === "cfihos";

      for (const relationship of packageRelationships) {
        const attrs = relationship.attributes ?? {};
        switch (relationship.relationship_type_code) {
          case "entity_parent":
            add(context, "entity_parent", relationship.source_type, relationship.source_identifier, relationship.target_type, relationship.target_identifier, {}, relationship.sourceSheet);
            break;
          case "class_property":
            add(context, "class_property", relationship.source_type, relationship.source_identifier, relationship.target_type, relationship.target_identifier,
              isCfihos
                ? selected(attrs, relationship.source_type === "tag_class" ? ["siUnitId", "siUnitName", "imperialUnitId", "imperialUnitName"] : ["equipmentRelevant", "modelPartRelevant", "siUnitId", "siUnitName"])
                : selected(attrs, ["mandatory", "relevance", "sequence"]),
              relationship.sourceSheet);
            break;
          case "document_discipline":
            add(context, "document_discipline", relationship.source_type, relationship.source_identifier, relationship.target_type, relationship.target_identifier,
              selected(attrs, ["relationshipId", "requirementLevel", "contextCode", "assetType", "representationType", "nativeFileDeliveryTiming", "nativeDocumentFormat", "authenticatedRecordFormat", "detailedEngineeringStatus", "constructionStatus", "commissioningStatus", "startupStatus", "operationsStatus", "reviewType", "comment"]),
              relationship.sourceSheet);
            break;
          case "tag_equipment_mapping":
            add(context, "tag_equipment_mapping", relationship.source_type, relationship.source_identifier, relationship.target_type, relationship.target_identifier,
              isCfihos ? selected(attrs, ["reason"]) : selected(attrs, ["mappingId", "relationshipType", "reason"]), relationship.sourceSheet);
            break;
          case "class_document":
            add(context, "class_document", relationship.source_type, relationship.source_identifier, relationship.target_type, relationship.target_identifier,
              isCfihos ? selected(attrs, ["requirementId", "sourceStandardId", "sourceStandardCode", "assetType"]) : selected(attrs, ["requirementId", "requirementLevel"]), relationship.sourceSheet);
            break;
          case "entity_source_standard":
            if (relationship.source_type === "tag_class" || relationship.source_type === "equipment_class") {
              add(context, "entity_source_standard", relationship.source_type, relationship.source_identifier, relationship.target_type, relationship.target_identifier,
                isCfihos ? {} : selected(attrs, ["mappingNote"]), relationship.sourceSheet);
            }
            break;
        }
      }

      // CFIHOS class-property rows can identify explicit SI / Imperial units. These are
      // projected first; dimension-derived property/unit links below intentionally win
      // when the browser projection has the same endpoint pair.
      if (isCfihos) {
        // Match the committed CFIHOS relationship generator exactly. It walks tag-class
        // property rows first, then equipment-class property rows, both in source-row
        // order. Because property_unit identity is property + unit, later evidence is
        // allowed to overwrite an earlier duplicate endpoint. The raw PostgreSQL read
        // order is source-type lexical order (equipment before tag), so normalize that
        // order here rather than leaking database ordering into browser semantics.
        const explicitUnitAssignments = packageRelationships
          .filter((row) => row.relationship_type_code === "class_property")
          .sort((a, b) => {
            const rank = (type: string) => type === "tag_class" ? 0 : type === "equipment_class" ? 1 : 2;
            const sourceRank = rank(a.source_type) - rank(b.source_type);
            if (sourceRank) return sourceRank;
            const rowA = Number(a.source_locator?.row ?? Number.MAX_SAFE_INTEGER);
            const rowB = Number(b.source_locator?.row ?? Number.MAX_SAFE_INTEGER);
            if (rowA !== rowB) return rowA - rowB;
            return a.source_identifier.localeCompare(b.source_identifier) || a.target_identifier.localeCompare(b.target_identifier);
          });
        for (const relationship of explicitUnitAssignments) {
          const attrs = relationship.attributes ?? {};
          for (const [unitId, system] of [[text(attrs.siUnitId), "SI"], [text(attrs.imperialUnitId), "Imperial"]] as const) {
            if (byEntity.has(entityKey("unit_of_measure", unitId))) add(context, "property_unit", "property", relationship.target_identifier, "unit_of_measure", unitId, { system }, relationship.sourceSheet);
          }
        }
      }

      const units = byType("unit_of_measure");
      for (const property of byType("property")) {
        const propertyRefs = isCfihos
          ? unique([property.metadata.dimensionId, property.metadata.dimensionCode])
          : unique([property.metadata.unitId, property.metadata.dimensionReference]);
        const matched = new Set<string>();
        if (!isCfihos && byEntity.has(entityKey("unit_of_measure", text(property.metadata.unitId)))) matched.add(text(property.metadata.unitId));
        for (const unit of units) {
          const unitRefs = isCfihos
            ? unique([unit.metadata.dimensionId, unit.metadata.dimensionCode, unit.metadata.dimensionName])
            : unique([unit.metadata.dimensionName, unit.metadata.dimensionReference]);
          if (propertyRefs.some((left) => unitRefs.some((right) => same(left, right)))) matched.add(unit.native_identifier);
        }
        for (const unitId of matched) {
          const unit = byEntity.get(entityKey("unit_of_measure", unitId));
          add(context, "property_unit", "property", property.native_identifier, "unit_of_measure", unitId, {
            symbol: unit?.metadata.symbol,
            dimension: isCfihos ? (unit?.metadata.dimensionName || unit?.metadata.dimensionCode) : unit?.metadata.dimensionName,
          }, property.sourceSheet);
        }

        const controlledListReference = text(property.metadata.controlledListId);
        if (controlledListReference) {
          for (const controlled of byType("controlled_value")) {
            const listId = text(controlled.metadata.controlledListId);
            const listName = text(controlled.metadata.controlledListName);
            const matches = isCfihos ? same(controlledListReference, listId) : (same(controlledListReference, listId) || same(controlledListReference, listName));
            if (!matches) continue;
            add(context, "property_controlled_value", "property", property.native_identifier, "controlled_value", controlled.native_identifier, {
              controlledListId: listId,
              controlledListName: listName,
              sequence: controlled.metadata.sequence,
              sourceStandardId: controlled.metadata.sourceStandardId,
              sourceStandardCode: controlled.metadata.sourceStandardCode,
            }, controlled.sourceSheet);
          }
        }
      }

      for (const controlled of byType("controlled_value")) {
        const standardId = text(controlled.metadata.sourceStandardId);
        if (standardId && byEntity.has(entityKey("source_standard", standardId))) {
          add(context, "controlled_value_source_standard", "controlled_value", controlled.native_identifier, "source_standard", standardId, {
            controlledListId: controlled.metadata.controlledListId,
            controlledListName: controlled.metadata.controlledListName,
            sourceStandardCode: controlled.metadata.sourceStandardCode,
          }, controlled.sourceSheet);
        }
      }

      for (const mapping of byType("source_mapping")) {
        const m = mapping.metadata;
        const classId = text(m.classId);
        const propertyId = text(m.propertyId);
        const standardId = text(m.sourceStandardId);
        if (!byEntity.has(entityKey("property", propertyId)) || !byEntity.has(entityKey("source_standard", standardId))) continue;
        const mappingId = mapping.native_identifier;
        const attributes: Record<string, unknown> = isCfihos
          ? {
              mappingId,
              classId,
              className: m.className,
              propertyId,
              propertyName: m.propertyName,
              sourceStandardId: standardId,
              sourceStandardCode: m.sourceStandardCode,
              sourceSection: m.sourceSection,
              sourcePropertyName: m.sourcePropertyName || m.propertyNameInSource,
              sequence: m.sequence,
            }
          : {
              mappingId,
              classId,
              propertyId,
              sourceStandardId: standardId,
              sourceStandardCode: m.sourceStandardCode,
              sourceSection: m.sourceSection,
              sourcePropertyName: m.sourcePropertyName || m.sourceField,
              sequence: m.sequence,
              mappingNote: m.mappingNote,
            };
        add(context, "mapping_property_standard", "property", propertyId, "source_standard", standardId, attributes, mapping.sourceSheet);
        if (byEntity.has(entityKey("tag_class", classId))) {
          add(context, "mapping_class_property", "tag_class", classId, "property", propertyId, attributes, mapping.sourceSheet);
          add(context, "mapping_class_standard", "tag_class", classId, "source_standard", standardId, attributes, mapping.sourceSheet);
        }
        if (byEntity.has(entityKey("equipment_class", classId))) {
          add(context, "mapping_class_property", "equipment_class", classId, "property", propertyId, attributes, mapping.sourceSheet);
          add(context, "mapping_class_standard", "equipment_class", classId, "source_standard", standardId, attributes, mapping.sourceSheet);
        }
      }

      // Class-document rows introduce requirement edges before the requirement rows
      // themselves. Later, richer requirement-row metadata overwrites identical endpoint
      // pairs just as the committed static relationship generator does.
      for (const relationship of packageRelationships.filter((row) => row.relationship_type_code === "class_document")) {
        const requirementId = text(relationship.attributes?.requirementId);
        if (!requirementId || !byEntity.has(entityKey("information_requirement", requirementId))) continue;
        const requirementLevel = text(relationship.attributes?.requirementLevel);
        add(context, "information_requirement_class", "information_requirement", requirementId, relationship.source_type, relationship.source_identifier, isCfihos ? {} : { requirementLevel }, relationship.sourceSheet);
        add(context, "information_requirement_document", "information_requirement", requirementId, "document_type", relationship.target_identifier, isCfihos ? {} : { requirementLevel }, relationship.sourceSheet);
        const standardId = text(relationship.attributes?.sourceStandardId);
        if (standardId && byEntity.has(entityKey("source_standard", standardId))) add(context, "information_requirement_standard", "information_requirement", requirementId, "source_standard", standardId, {}, relationship.sourceSheet);
      }

      // CFIHOS JIP33 can contain more than one relationship row for the same
      // information-requirement entity. Entity metadata is necessarily one row per
      // identity, so reconstructing requirement links from metadata alone can drop
      // valid class/document/standard endpoints. Preserve the authoritative normalized
      // relationship rows and enrich them with the stable requirement attributes. This
      // mirrors the static generator ordering: class-document-derived edges first, then
      // JIP33 edges overwrite identical endpoints with the richer requirement evidence.
      if (isCfihos) {
        const directRequirementTypes = new Set([
          "information_requirement_class",
          "information_requirement_document",
          "information_requirement_standard",
        ]);
        for (const relationship of packageRelationships.filter((row) => directRequirementTypes.has(row.relationship_type_code))) {
          if (relationship.source_type !== "information_requirement") continue;
          const requirement = byEntity.get(entityKey("information_requirement", relationship.source_identifier));
          if (!requirement) continue;
          add(
            context,
            relationship.relationship_type_code,
            relationship.source_type,
            relationship.source_identifier,
            relationship.target_type,
            relationship.target_identifier,
            cfihosBrowserRequirementAttributes(requirement.metadata),
            relationship.sourceSheet,
          );
        }
      }

      for (const requirement of byType("information_requirement")) {
        const m = requirement.metadata;
        const attrs = isCfihos
          ? cfihosBrowserRequirementAttributes(m)
          : selected(m, ["requirementNumber", "requirementTitle", "requirementLevel", "requirementGroup", "typicalDeliverable", "submitAtProposal", "submitForReview", "submitAtDelivery", "requiredHandoverStatus", "requiredTranslation", "deliverableFormat", "sourceChapter", "reviewWeeks", "reviewReferenceDate", "approvalWeeks", "approvalReferenceDate", "informationWeeks", "informationReferenceDate"]);
        const classId = text(m.classId);
        const propertyId = text(m.propertyId);
        if (classId && byEntity.has(entityKey("tag_class", classId))) add(context, "information_requirement_class", "information_requirement", requirement.native_identifier, "tag_class", classId, attrs, requirement.sourceSheet);
        else if (classId && byEntity.has(entityKey("equipment_class", classId))) add(context, "information_requirement_class", "information_requirement", requirement.native_identifier, "equipment_class", classId, attrs, requirement.sourceSheet);
        if (propertyId && byEntity.has(entityKey("property", propertyId))) add(context, "information_requirement_property", "information_requirement", requirement.native_identifier, "property", propertyId, attrs, requirement.sourceSheet);
        if (isCfihos) {
          const documentId = text(m.documentId);
          const standardId = text(m.sourceStandardId);
          if (documentId && byEntity.has(entityKey("document_type", documentId))) add(context, "information_requirement_document", "information_requirement", requirement.native_identifier, "document_type", documentId, attrs, requirement.sourceSheet);
          if (standardId && byEntity.has(entityKey("source_standard", standardId))) add(context, "information_requirement_standard", "information_requirement", requirement.native_identifier, "source_standard", standardId, attrs, requirement.sourceSheet);
        }
      }
    }

    return [...output.values()].sort((a, b) =>
      a.sourceKey.localeCompare(b.sourceKey)
      || a.releaseKey.localeCompare(b.releaseKey)
      || a.relationshipType.localeCompare(b.relationshipType)
      || a.sourceEntityType.localeCompare(b.sourceEntityType)
      || a.sourceNativeIdentifier.localeCompare(b.sourceNativeIdentifier)
      || a.targetEntityType.localeCompare(b.targetEntityType)
      || a.targetNativeIdentifier.localeCompare(b.targetNativeIdentifier)
      || (a.attributes.mappingId ?? "").localeCompare(b.attributes.mappingId ?? ""),
    );
  }

  private async loadEntities(sourceKey: string | null, releaseKey: string | null) {
    const { sourceFilter, releaseFilter } = filters(sourceKey, releaseKey);
    return this.client.query<EntityRow>(`
      WITH selected_packages AS (
        SELECT DISTINCT ON (r.release_id)
          p.package_id, p.package_key, s.source_key, s.name AS source_name,
          r.release_key, r.release_status, r.version_label
        FROM rdl.rdl_package p
        JOIN rdl.rdl_release r ON r.release_id = p.release_id
        JOIN rdl.rdl_source s ON s.source_id = r.source_id
        WHERE p.package_status = 'validated'
          ${sourceFilter}
          ${releaseFilter}
        ORDER BY r.release_id, p.package_id DESC
      )
      SELECT sp.source_key, sp.source_name, sp.release_key, sp.release_status, sp.version_label, sp.package_key,
             e.entity_type_code, e.native_identifier, e.name, e.definition,
             e.normalized_metadata, e.source_locator
      FROM selected_packages sp
      JOIN rdl.rdl_entity e ON e.package_id = sp.package_id
      ORDER BY sp.source_key, sp.release_key, e.entity_type_code, e.native_identifier
    `);
  }

  private async loadRelationships(sourceKey: string | null, releaseKey: string | null) {
    const { sourceFilter, releaseFilter } = filters(sourceKey, releaseKey);
    const RELATIONSHIP_PAGE_SIZE = 1000;
    const rows: RelationshipRow[] = [];
    let offset = 0;

    // PsqlJsonClient intentionally has a bounded stdout buffer. Large packages such as
    // CFIHOS exceed that bound if the complete relationship graph is serialized in one
    // query, so page deterministically without changing projection semantics.
    while (true) {
      const page = await this.client.query<RelationshipRow>(`
        WITH selected_packages AS (
          SELECT DISTINCT ON (r.release_id)
            p.package_id, p.package_key, s.source_key, s.name AS source_name,
            r.release_key, r.release_status, r.version_label
          FROM rdl.rdl_package p
          JOIN rdl.rdl_release r ON r.release_id = p.release_id
          JOIN rdl.rdl_source s ON s.source_id = r.source_id
          WHERE p.package_status = 'validated'
            ${sourceFilter}
            ${releaseFilter}
          ORDER BY r.release_id, p.package_id DESC
        )
        SELECT sp.source_key, sp.source_name, sp.release_key, sp.release_status, sp.version_label, sp.package_key,
               rel.relationship_type_code,
               src.entity_type_code AS source_type, src.native_identifier AS source_identifier,
               tgt.entity_type_code AS target_type, tgt.native_identifier AS target_identifier,
               rel.attributes, rel.source_locator
        FROM selected_packages sp
        JOIN rdl.rdl_relationship rel ON rel.package_id = sp.package_id
        JOIN rdl.rdl_entity src ON src.entity_id = rel.source_entity_id
        JOIN rdl.rdl_entity tgt ON tgt.entity_id = rel.target_entity_id
        ORDER BY sp.source_key, sp.release_key, rel.relationship_type_code, src.entity_type_code, src.native_identifier, tgt.entity_type_code, tgt.native_identifier, rel.relationship_id
        LIMIT ${RELATIONSHIP_PAGE_SIZE}
        OFFSET ${offset}
      `);
      rows.push(...page);
      if (page.length < RELATIONSHIP_PAGE_SIZE) break;
      offset += page.length;
    }

    return rows;
  }
}

function filters(sourceKey: string | null, releaseKey: string | null) {
  return {
    sourceFilter: sourceKey ? `AND s.source_key = ${sqlLiteral(sourceKey)}` : "",
    releaseFilter: releaseKey ? `AND r.release_key = ${sqlLiteral(releaseKey)}` : "",
  };
}
