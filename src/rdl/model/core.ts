/**
 * Application-level vocabulary for the normalized RDL model introduced in RDL-003.
 * These types describe stable concepts; they do not make the browser runtime
 * database-backed yet. PostgreSQL parity remains an RDL-004 concern.
 */
export type RdlEntityTypeCode =
  | "class"
  | "tag_class"
  | "equipment_class"
  | "property"
  | "document_type"
  | "unit_of_measure"
  | "controlled_value"
  | "source_standard"
  | "discipline"
  | "lifecycle_requirement";

export type RdlSourceIdentity = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
};

export type RdlEntityIdentity = RdlSourceIdentity & {
  entityType: RdlEntityTypeCode | string;
  nativeIdentifier: string;
};

export type RdlProvenance = {
  authoritative: boolean;
  sourceLocator?: Record<string, unknown>;
};

export type RdlEntityRecord = {
  identity: RdlEntityIdentity;
  name: string;
  definition?: string;
  lifecycleStatus: "active" | "deprecated" | "superseded" | "withdrawn";
  provenance: RdlProvenance;
  metadata?: Record<string, unknown>;
};

export type RdlRelationshipRecord = {
  packageKey: string;
  relationshipType: string;
  source: RdlEntityIdentity;
  target: RdlEntityIdentity;
  provenance: RdlProvenance;
  attributes?: Record<string, unknown>;
};
