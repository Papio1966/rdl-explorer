import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type RdlSchemaConstraintRecord = {
  kind: string;
  value: string;
  normalized: Record<string, unknown>;
};

export type RdlSchemaDictionaryRecord = {
  schemaDefinitionId: number;
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  versionLabel: string;
  releaseStatus: string;
  packageId: number;
  packageKey: string;
  sourceRecordId: number;
  sourceRowNumber: number;
  rowSha256: string;
  nativeIdentifier: string;
  conceptKind: string;
  section: string | null;
  entityName: string | null;
  propertyName: string | null;
  entityAttributeName: string | null;
  definition: string | null;
  noteComment: string | null;
  example: string | null;
  requirementStatus: string | null;
  formatSpecification: string | null;
  dataTypeHint: string | null;
  presenceConstraint: string | null;
  dataSource: string | null;
  formerSection: string | null;
  relationshipVerb: string | null;
  constraints: RdlSchemaConstraintRecord[];
};

type Row = {
  schema_definition_id: number;
  source_key: string;
  source_name: string;
  release_key: string;
  version_label: string;
  release_status: string;
  package_id: number;
  package_key: string;
  source_record_id: number;
  source_row_number: number;
  row_sha256: string;
  native_identifier: string;
  concept_kind: string;
  section: string | null;
  entity_name: string | null;
  property_name: string | null;
  entity_attribute_name: string | null;
  definition: string | null;
  note_comment: string | null;
  example: string | null;
  requirement_status: string | null;
  format_specification: string | null;
  data_type_hint: string | null;
  presence_constraint: string | null;
  data_source: string | null;
  former_section: string | null;
  relationship_verb: string | null;
  constraints: RdlSchemaConstraintRecord[];
};

export type RdlSchemaReleaseContext = {
  sourceKey: string;
  sourceName: string;
  releaseKey: string;
  versionLabel: string;
  releaseStatus: string;
  packageKey: string;
};

type ReleaseRow = {
  source_key: string;
  source_name: string;
  release_key: string;
  version_label: string;
  release_status: string;
  package_key: string;
};

export class RdlSchemaDictionaryRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async release(sourceKey: string, releaseKey: string): Promise<RdlSchemaReleaseContext | null> {
    const rows = await this.client.query<ReleaseRow>(`
      SELECT
        s.source_key,
        s.name AS source_name,
        r.release_key,
        r.version_label,
        r.release_status,
        p.package_key
      FROM rdl.rdl_source s
      JOIN rdl.rdl_release r ON r.source_id=s.source_id
      JOIN rdl.rdl_package p ON p.release_id=r.release_id
      WHERE s.source_key=${sqlLiteral(sourceKey)}
        AND r.release_key=${sqlLiteral(releaseKey)}
      ORDER BY p.package_id DESC
      LIMIT 1
    `);
    const row = rows[0];
    return row ? {
      sourceKey: row.source_key,
      sourceName: row.source_name,
      releaseKey: row.release_key,
      versionLabel: row.version_label,
      releaseStatus: row.release_status,
      packageKey: row.package_key,
    } : null;
  }

  async records(sourceKey: string, releaseKey: string): Promise<RdlSchemaDictionaryRecord[]> {
    const rows = await this.client.query<Row>(`
      SELECT *
      FROM rdl.schema_dictionary_projection
      WHERE source_key=${sqlLiteral(sourceKey)}
        AND release_key=${sqlLiteral(releaseKey)}
      ORDER BY source_row_number, schema_definition_id
    `);
    return rows.map((row) => ({
      schemaDefinitionId: Number(row.schema_definition_id),
      sourceKey: row.source_key,
      sourceName: row.source_name,
      releaseKey: row.release_key,
      versionLabel: row.version_label,
      releaseStatus: row.release_status,
      packageId: Number(row.package_id),
      packageKey: row.package_key,
      sourceRecordId: Number(row.source_record_id),
      sourceRowNumber: Number(row.source_row_number),
      rowSha256: row.row_sha256,
      nativeIdentifier: row.native_identifier,
      conceptKind: row.concept_kind,
      section: row.section,
      entityName: row.entity_name,
      propertyName: row.property_name,
      entityAttributeName: row.entity_attribute_name,
      definition: row.definition,
      noteComment: row.note_comment,
      example: row.example,
      requirementStatus: row.requirement_status,
      formatSpecification: row.format_specification,
      dataTypeHint: row.data_type_hint,
      presenceConstraint: row.presence_constraint,
      dataSource: row.data_source,
      formerSection: row.former_section,
      relationshipVerb: row.relationship_verb,
      constraints: Array.isArray(row.constraints) ? row.constraints : [],
    }));
  }
}
