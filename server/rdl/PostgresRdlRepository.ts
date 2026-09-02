import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";
import type { RdlPackageRecord, RdlReadEntity } from "./RdlReadRepository.ts";
import type { RdlCutoverRepository } from "./RdlCutoverRepository.ts";

export type PostgresRdlEntity = RdlReadEntity;

export type PostgresRdlRelationship = {
  relationshipId: number;
  relationshipType: string;
  sourceType: string;
  sourceIdentifier: string;
  targetType: string;
  targetIdentifier: string;
  attributes: Record<string, unknown>;
  sourceLocator: Record<string, unknown>;
};

export class PostgresRdlRepository implements RdlCutoverRepository {
  constructor(
    private readonly client: SqlJsonClient,
    private readonly sourceKey = "cfihos",
    private readonly releaseKey = "cfihos-2.0",
  ) {}

  async getPackage(): Promise<RdlPackageRecord | null> {
    const rows = await this.client.query<{
      source_key: string;
      release_key: string;
      version_label: string;
      package_key: string;
      content_sha256: string | null;
      source_uri: string | null;
    }>(`
      SELECT s.source_key, r.release_key, r.version_label,
             p.package_key, p.content_sha256, p.source_uri
      FROM rdl.rdl_package p
      JOIN rdl.rdl_release r ON r.release_id = p.release_id
      JOIN rdl.rdl_source s ON s.source_id = r.source_id
      WHERE s.source_key = ${sqlLiteral(this.sourceKey)}
        AND r.release_key = ${sqlLiteral(this.releaseKey)}
      ORDER BY p.package_id DESC
      LIMIT 1
    `);
    const row = rows[0];
    return row
      ? {
          sourceKey: row.source_key,
          releaseKey: row.release_key,
          versionLabel: row.version_label,
          packageKey: row.package_key,
          contentSha256: row.content_sha256,
          sourceUri: row.source_uri,
        }
      : null;
  }

  async countEntities(entityType: string): Promise<number> {
    const rows = await this.client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM rdl.rdl_entity e
      JOIN rdl.rdl_package p ON p.package_id = e.package_id
      JOIN rdl.rdl_release r ON r.release_id = p.release_id
      JOIN rdl.rdl_source s ON s.source_id = r.source_id
      WHERE s.source_key = ${sqlLiteral(this.sourceKey)}
        AND r.release_key = ${sqlLiteral(this.releaseKey)}
        AND e.entity_type_code = ${sqlLiteral(entityType)}
    `);
    return Number(rows[0]?.count ?? 0);
  }

  async getEntity(entityType: string, nativeIdentifier: string): Promise<PostgresRdlEntity | null> {
    const rows = await this.client.query<{
      entity_id: number;
      package_key: string;
      entity_type_code: string;
      native_identifier: string;
      name: string;
      definition: string | null;
      lifecycle_status: string;
      normalized_metadata: Record<string, unknown>;
      source_locator: Record<string, unknown>;
    }>(`
      SELECT e.entity_id, p.package_key, e.entity_type_code, e.native_identifier,
             e.name, e.definition, e.lifecycle_status,
             e.normalized_metadata, e.source_locator
      FROM rdl.rdl_entity e
      JOIN rdl.rdl_package p ON p.package_id = e.package_id
      JOIN rdl.rdl_release r ON r.release_id = p.release_id
      JOIN rdl.rdl_source s ON s.source_id = r.source_id
      WHERE s.source_key = ${sqlLiteral(this.sourceKey)}
        AND r.release_key = ${sqlLiteral(this.releaseKey)}
        AND e.entity_type_code = ${sqlLiteral(entityType)}
        AND e.native_identifier = ${sqlLiteral(nativeIdentifier)}
      ORDER BY e.entity_id DESC
      LIMIT 1
    `);
    const row = rows[0];
    return row ? mapEntity(row) : null;
  }

  async getChildren(entityType: string, nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    return this.getRelatedEntities("entity_parent", entityType, nativeIdentifier, "incoming");
  }

  async getParent(entityType: string, nativeIdentifier: string): Promise<PostgresRdlEntity | null> {
    const rows = await this.getRelatedEntities("entity_parent", entityType, nativeIdentifier, "outgoing");
    return rows[0] ?? null;
  }

  async getDirectProperties(entityType: "tag_class" | "equipment_class", nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    return this.getRelatedEntities("class_property", entityType, nativeIdentifier, "outgoing");
  }

  async getDocumentsForClass(entityType: "tag_class" | "equipment_class", nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    // RDL-036.1 compatibility boundary: the historical snapshot repository treats
    // only explicit Tag and Equipment document rows as part of this legacy read.
    // The normalized graph may also carry Model_Part/browser-complete edges; those
    // remain available to RdlRuntimeProjectionRepository but must not change the
    // RDL-005/RDL-006 snapshot-parity contract.
    const wantedAsset = entityType === "tag_class" ? "tag" : "equipment";
    const rows = await this.client.query<{
      entity_id: number;
      package_key: string;
      entity_type_code: string;
      native_identifier: string;
      name: string;
      definition: string | null;
      lifecycle_status: string;
      normalized_metadata: Record<string, unknown>;
      source_locator: Record<string, unknown>;
    }>(`
      SELECT related.entity_id, p.package_key, related.entity_type_code,
             related.native_identifier, related.name, related.definition,
             related.lifecycle_status, related.normalized_metadata, related.source_locator
      FROM rdl.rdl_relationship rel
      JOIN rdl.rdl_entity anchor ON anchor.entity_id = rel.source_entity_id
      JOIN rdl.rdl_entity related ON related.entity_id = rel.target_entity_id
      JOIN rdl.rdl_package p ON p.package_id = rel.package_id
      JOIN rdl.rdl_release rr ON rr.release_id = p.release_id
      JOIN rdl.rdl_source rs ON rs.source_id = rr.source_id
      WHERE rs.source_key = ${sqlLiteral(this.sourceKey)}
        AND rr.release_key = ${sqlLiteral(this.releaseKey)}
        AND rel.relationship_type_code = 'class_document'
        AND anchor.entity_type_code = ${sqlLiteral(entityType)}
        AND anchor.native_identifier = ${sqlLiteral(nativeIdentifier)}
        AND lower(trim(COALESCE(rel.attributes->>'assetType', ''))) = ${sqlLiteral(wantedAsset)}
      ORDER BY related.native_identifier
    `);
    return rows.map(mapEntity);
  }

  async getDocumentsForDiscipline(nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    return this.getRelatedEntities("document_discipline", "discipline", nativeIdentifier, "incoming");
  }

  async getControlledValuesForProperty(nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    const property = await this.getEntity("property", nativeIdentifier);
    const listId = String(property?.metadata.controlledListId ?? "").trim();
    if (!listId) return [];
    return this.getRelatedEntities("controlled_list_value", "controlled_list", listId, "outgoing");
  }

  async getJip33RequirementsForTagClass(nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    // RDL-036.1 compatibility boundary: the browser-complete normalized graph also
    // contains information_requirement_class edges derived from other governed
    // evidence (for example document required per class). The historical RDL-006
    // snapshot operation is specifically a JIP33-sheet read, so preserve that
    // provenance contract here without removing the additional normalized edges.
    return this.getRelatedEntities(
      "information_requirement_class",
      "tag_class",
      nativeIdentifier,
      "incoming",
      "Jip33 info required spec",
    );
  }

  async getEquipmentMappingsForTagClass(nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    return this.getRelatedEntities("tag_equipment_mapping", "tag_class", nativeIdentifier, "outgoing");
  }


  async getUnitsForDimension(dimensionId: string): Promise<PostgresRdlEntity[]> {
    const rows = await this.client.query<{
      entity_id: number;
      package_key: string;
      entity_type_code: string;
      native_identifier: string;
      name: string;
      definition: string | null;
      lifecycle_status: string;
      normalized_metadata: Record<string, unknown>;
      source_locator: Record<string, unknown>;
    }>(`
      SELECT e.entity_id, p.package_key, e.entity_type_code, e.native_identifier,
             e.name, e.definition, e.lifecycle_status, e.normalized_metadata, e.source_locator
      FROM rdl.rdl_entity e
      JOIN rdl.rdl_package p ON p.package_id = e.package_id
      JOIN rdl.rdl_release rr ON rr.release_id = p.release_id
      JOIN rdl.rdl_source rs ON rs.source_id = rr.source_id
      WHERE rs.source_key = ${sqlLiteral(this.sourceKey)}
        AND rr.release_key = ${sqlLiteral(this.releaseKey)}
        AND e.entity_type_code = 'unit_of_measure'
        AND e.normalized_metadata->>'dimensionId' = ${sqlLiteral(dimensionId)}
      ORDER BY e.native_identifier
    `);
    return rows.map(mapEntity);
  }

  async getSourceStandardsForEntity(entityType: string, nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    return this.getRelatedEntities("entity_source_standard", entityType, nativeIdentifier, "outgoing");
  }

  async getSourceMappingsForProperty(nativeIdentifier: string): Promise<PostgresRdlEntity[]> {
    return this.getRelatedEntities("mapping_property", "property", nativeIdentifier, "incoming");
  }

  async getRelationships(
    relationshipType: string,
    entityType: string,
    nativeIdentifier: string,
    direction: "outgoing" | "incoming" = "outgoing",
  ): Promise<PostgresRdlRelationship[]> {
    const anchor = direction === "outgoing" ? "source" : "target";
    return this.client.query<{
      relationship_id: number;
      relationship_type_code: string;
      source_type: string;
      source_identifier: string;
      target_type: string;
      target_identifier: string;
      attributes: Record<string, unknown>;
      source_locator: Record<string, unknown>;
    }>(`
      SELECT rel.relationship_id, rel.relationship_type_code,
             src.entity_type_code AS source_type,
             src.native_identifier AS source_identifier,
             tgt.entity_type_code AS target_type,
             tgt.native_identifier AS target_identifier,
             rel.attributes, rel.source_locator
      FROM rdl.rdl_relationship rel
      JOIN rdl.rdl_entity src ON src.entity_id = rel.source_entity_id
      JOIN rdl.rdl_entity tgt ON tgt.entity_id = rel.target_entity_id
      JOIN rdl.rdl_package p ON p.package_id = rel.package_id
      JOIN rdl.rdl_release rr ON rr.release_id = p.release_id
      JOIN rdl.rdl_source rs ON rs.source_id = rr.source_id
      JOIN rdl.rdl_entity anchor ON anchor.entity_id = rel.${anchor}_entity_id
      WHERE rs.source_key = ${sqlLiteral(this.sourceKey)}
        AND rr.release_key = ${sqlLiteral(this.releaseKey)}
        AND rel.relationship_type_code = ${sqlLiteral(relationshipType)}
        AND anchor.entity_type_code = ${sqlLiteral(entityType)}
        AND anchor.native_identifier = ${sqlLiteral(nativeIdentifier)}
      ORDER BY ${direction === "outgoing" ? "tgt" : "src"}.native_identifier, rel.relationship_id
    `).then((rows) => rows.map((row) => ({
      relationshipId: row.relationship_id,
      relationshipType: row.relationship_type_code,
      sourceType: row.source_type,
      sourceIdentifier: row.source_identifier,
      targetType: row.target_type,
      targetIdentifier: row.target_identifier,
      attributes: row.attributes ?? {},
      sourceLocator: row.source_locator ?? {},
    })));
  }

  private async getRelatedEntities(
    relationshipType: string,
    entityType: string,
    nativeIdentifier: string,
    direction: "outgoing" | "incoming",
    sourceSheet?: string,
  ): Promise<PostgresRdlEntity[]> {
    const anchorColumn = direction === "outgoing" ? "source_entity_id" : "target_entity_id";
    const relatedColumn = direction === "outgoing" ? "target_entity_id" : "source_entity_id";
    const rows = await this.client.query<{
      entity_id: number;
      package_key: string;
      entity_type_code: string;
      native_identifier: string;
      name: string;
      definition: string | null;
      lifecycle_status: string;
      normalized_metadata: Record<string, unknown>;
      source_locator: Record<string, unknown>;
    }>(`
      SELECT related.entity_id, p.package_key, related.entity_type_code,
             related.native_identifier, related.name, related.definition,
             related.lifecycle_status, related.normalized_metadata, related.source_locator
      FROM rdl.rdl_relationship rel
      JOIN rdl.rdl_entity anchor ON anchor.entity_id = rel.${anchorColumn}
      JOIN rdl.rdl_entity related ON related.entity_id = rel.${relatedColumn}
      JOIN rdl.rdl_package p ON p.package_id = rel.package_id
      JOIN rdl.rdl_release rr ON rr.release_id = p.release_id
      JOIN rdl.rdl_source rs ON rs.source_id = rr.source_id
      WHERE rs.source_key = ${sqlLiteral(this.sourceKey)}
        AND rr.release_key = ${sqlLiteral(this.releaseKey)}
        AND rel.relationship_type_code = ${sqlLiteral(relationshipType)}
        AND anchor.entity_type_code = ${sqlLiteral(entityType)}
        AND anchor.native_identifier = ${sqlLiteral(nativeIdentifier)}
        ${sourceSheet ? `AND COALESCE(rel.source_locator->>'sheet', '') = ${sqlLiteral(sourceSheet)}` : ""}
      ORDER BY related.native_identifier
    `);
    return rows.map(mapEntity);
  }
}

function legacySnapshotMetadata(entityType: string, metadata: Record<string, unknown>): Record<string, unknown> {
  const text = (key: string) => String(metadata[key] ?? "").trim();
  const bool = (key: string) => metadata[key] === true || ["yes", "true", "1"].includes(text(key).toLowerCase());

  switch (entityType) {
    case "tag_class":
      return {
        abstract: bool("abstract"),
        parentName: text("parentName"),
        tagNumberFormat: text("tagNumberFormat"),
        equipmentExpectedInstalled: text("equipmentExpectedInstalled"),
        synonym: text("synonym"),
      };
    case "equipment_class":
      return {
        abstract: bool("abstract"),
        parentName: text("parentName"),
        sparePartInformationRequired: text("sparePartInformationRequired"),
        synonym: text("synonym"),
      };
    case "property":
      return {
        dataType: text("dataType"),
        dataTypeLength: text("dataTypeLength"),
        dimensionId: text("dimensionId"),
        dimensionCode: text("dimensionCode"),
        controlledListId: text("controlledListId"),
        controlledListName: text("controlledListName"),
        synonym: text("synonym"),
      };
    case "document_type":
      return { shortCode: text("shortCode"), classification: text("classification"), synonym: text("synonym") };
    case "discipline":
      return { code: text("code") };
    case "unit_of_measure":
      return {
        uneceCode: text("uneceCode"),
        symbol: text("symbol"),
        dimensionId: text("dimensionId"),
        dimensionCode: text("dimensionCode"),
        dimensionName: text("dimensionName"),
        measurementSystemId: text("measurementSystemId"),
        measurementSystemCode: text("measurementSystemCode"),
        synonym: text("synonym"),
      };
    case "source_standard":
      return { incomplete: text("incomplete") };
    case "information_requirement":
      return {
        requirementNumber: text("requirementNumber"),
        requirementType: text("requirementType"),
        requirementGroup: text("requirementGroup"),
        sourceChapter: text("sourceChapter"),
        typicalDeliverable: text("typicalDeliverable"),
        handoverStatus: text("handoverStatus"),
      };
    case "source_mapping":
      return {
        classId: text("classId"),
        className: text("className"),
        propertyId: text("propertyId"),
        sourceStandardId: text("sourceStandardId"),
        sourceSection: text("sourceSection"),
        propertyNameInSource: text("propertyNameInSource"),
        sequence: text("sequence"),
      };
    case "controlled_value":
      return {
        controlledListId: text("controlledListId"),
        controlledListName: text("controlledListName"),
        sourceStandardId: text("sourceStandardId"),
        sourceStandardCode: text("sourceStandardCode"),
      };
    default:
      return metadata;
  }
}

function mapEntity(row: {
  entity_id: number;
  package_key: string;
  entity_type_code: string;
  native_identifier: string;
  name: string;
  definition: string | null;
  lifecycle_status: string;
  normalized_metadata: Record<string, unknown>;
  source_locator: Record<string, unknown>;
}): PostgresRdlEntity {
  return {
    entityId: row.entity_id,
    packageKey: row.package_key,
    entityType: row.entity_type_code,
    nativeIdentifier: row.native_identifier,
    name: row.name,
    definition: row.definition,
    lifecycleStatus: row.lifecycle_status,
    metadata: legacySnapshotMetadata(row.entity_type_code, row.normalized_metadata ?? {}),
    sourceLocator: row.source_locator ?? {},
  };
}
