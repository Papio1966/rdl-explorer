import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";
import {
  RdlRuntimeReadInputError,
  RdlRuntimeReleaseNotFoundError,
} from "./RdlRuntimeReadService.ts";

export type CfihosHandoverEventCompatibilityItem = {
  id: string;
  name: string;
  description: string | null;
  reportingSequence: string | null;
  sourceLocator: Record<string, unknown>;
};

export type CfihosHandoverEventCompatibilityResult = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: CfihosHandoverEventCompatibilityItem[];
  lifecycleRelationshipCount: number;
  lifecycleRelationshipsWithAnyStatusCount: number;
};

export type CfihosClassRelationshipCompatibilityItem = {
  tagClassId: string;
  tagClassName: string;
  equipmentClassId: string;
  equipmentClassName: string;
  mappingReason: string | null;
  sourceLocator: Record<string, unknown>;
};

export type CfihosClassRelationshipCompatibilityResult = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string;
  sourceUri: string | null;
  items: CfihosClassRelationshipCompatibilityItem[];
};

type PackageRow = {
  package_id: string;
  source_key: string;
  source_name: string;
  release_key: string;
  version_label: string;
  package_key: string;
  content_sha256: string | null;
  source_uri: string | null;
};

type HandoverRow = {
  native_identifier: string;
  name: string;
  definition: string | null;
  reporting_sequence: string | null;
  source_locator: Record<string, unknown>;
};

type ClassRelationshipRow = {
  tag_class_id: string;
  tag_class_name: string;
  equipment_class_id: string;
  equipment_class_name: string;
  mapping_reason: string | null;
  source_locator: Record<string, unknown>;
};

type LifecycleRelationshipCountRow = {
  relationship_count: string;
  relationships_with_any_status_count: string;
};

const text = (value: unknown) => String(value ?? "").trim();

export class CfihosRuntimeCompatibilityService {
  private readonly client: SqlJsonClient;

  constructor(client: SqlJsonClient) {
    this.client = client;
  }

  async handoverEvents(input: {
    sourceKey: string;
    releaseKey: string;
  }): Promise<CfihosHandoverEventCompatibilityResult> {
    const sourceKey = required("sourceKey", input.sourceKey);
    const releaseKey = required("releaseKey", input.releaseKey);
    if (sourceKey !== "cfihos") {
      throw new RdlRuntimeReadInputError(
        `CFIHOS compatibility reads require sourceKey 'cfihos', received '${sourceKey}'.`,
      );
    }

    const packageRow = await this.requireValidatedPackage(sourceKey, releaseKey);
    const packageId = Number(packageRow.package_id);
    if (!Number.isSafeInteger(packageId) || packageId <= 0) {
      throw new Error("Validated CFIHOS package returned an invalid package identifier.");
    }

    const contentSha256 = text(packageRow.content_sha256);
    if (!contentSha256) {
      throw new Error("Validated CFIHOS package is missing its source content SHA-256.");
    }

    const [rows, lifecycleCounts] = await Promise.all([
      this.client.query<HandoverRow>(`
        SELECT e.native_identifier, e.name, e.definition,
               NULLIF(e.normalized_metadata->>'sequence', '') AS reporting_sequence,
               e.source_locator
        FROM rdl.rdl_entity e
        WHERE e.package_id = ${packageId}
          AND e.entity_type_code = 'handover_event'
          AND COALESCE(e.source_locator->>'sheet', '') = 'handover event'
        ORDER BY e.entity_id
      `),
      this.client.query<LifecycleRelationshipCountRow>(`
        SELECT count(*)::text AS relationship_count,
               count(*) FILTER (
                 WHERE NULLIF(BTRIM(COALESCE(rel.attributes->>'detailedEngineeringStatus', '')), '') IS NOT NULL
                    OR NULLIF(BTRIM(COALESCE(rel.attributes->>'constructionStatus', '')), '') IS NOT NULL
                    OR NULLIF(BTRIM(COALESCE(rel.attributes->>'commissioningStatus', '')), '') IS NOT NULL
                    OR NULLIF(BTRIM(COALESCE(rel.attributes->>'startupStatus', '')), '') IS NOT NULL
                    OR NULLIF(BTRIM(COALESCE(rel.attributes->>'operationsStatus', '')), '') IS NOT NULL
               )::text AS relationships_with_any_status_count
        FROM rdl.rdl_relationship rel
        WHERE rel.package_id = ${packageId}
          AND rel.relationship_type_code = 'document_discipline'
          AND COALESCE(rel.source_locator->>'sheet', '') = 'discipline document type'
      `),
    ]);

    const counts = lifecycleCounts[0];
    const lifecycleRelationshipCount = nonNegativeInteger(
      "lifecycleRelationshipCount",
      counts?.relationship_count,
    );
    const lifecycleRelationshipsWithAnyStatusCount = nonNegativeInteger(
      "lifecycleRelationshipsWithAnyStatusCount",
      counts?.relationships_with_any_status_count,
    );
    if (lifecycleRelationshipsWithAnyStatusCount > lifecycleRelationshipCount) {
      throw new Error("CFIHOS lifecycle relationship status count exceeded total relationship count.");
    }

    return {
      sourceKey: packageRow.source_key,
      sourceName: packageRow.source_name,
      releaseKey: packageRow.release_key,
      versionLabel: packageRow.version_label,
      packageKey: packageRow.package_key,
      contentSha256,
      sourceUri: packageRow.source_uri,
      items: rows.map((row: HandoverRow) => ({
        id: text(row.native_identifier),
        name: text(row.name),
        description: nullableText(row.definition),
        reportingSequence: nullableText(row.reporting_sequence),
        sourceLocator: row.source_locator ?? {},
      })),
      lifecycleRelationshipCount,
      lifecycleRelationshipsWithAnyStatusCount,
    };
  }

  async classRelationships(input: {
    sourceKey: string;
    releaseKey: string;
  }): Promise<CfihosClassRelationshipCompatibilityResult> {
    const sourceKey = required("sourceKey", input.sourceKey);
    const releaseKey = required("releaseKey", input.releaseKey);
    if (sourceKey !== "cfihos") {
      throw new RdlRuntimeReadInputError(
        `CFIHOS compatibility reads require sourceKey 'cfihos', received '${sourceKey}'.`,
      );
    }

    const packageRow = await this.requireValidatedPackage(sourceKey, releaseKey);
    const packageId = Number(packageRow.package_id);
    if (!Number.isSafeInteger(packageId) || packageId <= 0) {
      throw new Error("Validated CFIHOS package returned an invalid package identifier.");
    }

    const contentSha256 = text(packageRow.content_sha256);
    if (!contentSha256) {
      throw new Error("Validated CFIHOS package is missing its source content SHA-256.");
    }

    const rows = await this.client.query<ClassRelationshipRow>(`
      SELECT source.native_identifier AS tag_class_id,
             source.name AS tag_class_name,
             target.native_identifier AS equipment_class_id,
             target.name AS equipment_class_name,
             NULLIF(BTRIM(COALESCE(rel.attributes->>'reason', '')), '') AS mapping_reason,
             rel.source_locator
      FROM rdl.rdl_relationship rel
      JOIN rdl.rdl_entity source ON source.entity_id = rel.source_entity_id
      JOIN rdl.rdl_entity target ON target.entity_id = rel.target_entity_id
      WHERE rel.package_id = ${packageId}
        AND rel.relationship_type_code = 'tag_equipment_mapping'
        AND source.entity_type_code = 'tag_class'
        AND target.entity_type_code = 'equipment_class'
        AND COALESCE(rel.source_locator->>'sheet', '') = 'tag equipment class relationshi'
      ORDER BY source.native_identifier, target.native_identifier,
               COALESCE(rel.attributes->>'reason', '')
    `);

    return {
      sourceKey: packageRow.source_key,
      sourceName: packageRow.source_name,
      releaseKey: packageRow.release_key,
      versionLabel: packageRow.version_label,
      packageKey: packageRow.package_key,
      contentSha256,
      sourceUri: packageRow.source_uri,
      items: rows.map((row: ClassRelationshipRow) => ({
        tagClassId: text(row.tag_class_id),
        tagClassName: text(row.tag_class_name),
        equipmentClassId: text(row.equipment_class_id),
        equipmentClassName: text(row.equipment_class_name),
        mappingReason: nullableText(row.mapping_reason),
        sourceLocator: row.source_locator ?? {},
      })),
    };
  }

  private async requireValidatedPackage(sourceKey: string, releaseKey: string): Promise<PackageRow> {
    const rows = await this.client.query<PackageRow>(`
      SELECT p.package_id::text, s.source_key, s.name AS source_name,
             r.release_key, r.version_label, p.package_key,
             p.content_sha256, p.source_uri
      FROM rdl.rdl_package p
      JOIN rdl.rdl_release r ON r.release_id = p.release_id
      JOIN rdl.rdl_source s ON s.source_id = r.source_id
      WHERE p.package_status = 'validated'
        AND s.source_key = ${sqlLiteral(sourceKey)}
        AND r.release_key = ${sqlLiteral(releaseKey)}
      ORDER BY p.package_id DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) {
      throw new RdlRuntimeReleaseNotFoundError(
        `RDL release '${sourceKey}/${releaseKey}' was not found.`,
      );
    }
    return row;
  }
}

function required(name: string, value: unknown): string {
  const result = text(value);
  if (!result) throw new RdlRuntimeReadInputError(`${name} is required.`);
  return result;
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function nonNegativeInteger(name: string, value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} returned an invalid count.`);
  }
  return parsed;
}
