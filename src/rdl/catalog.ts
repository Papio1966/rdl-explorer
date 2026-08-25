export type RdlSourceKey = "cfihos" | "ccus" | "water-desalination";
export type RdlScopeKey = "all" | RdlSourceKey;

export type RdlSourceDefinition = {
  key: RdlSourceKey;
  name: string;
  shortName: string;
  versionLabel: string;
  status: "reviewed" | "candidate";
  description: string;
};

export const RDL_SOURCES: readonly RdlSourceDefinition[] = [
  {
    key: "cfihos",
    name: "CFIHOS",
    shortName: "CFIHOS",
    versionLabel: "2.0",
    status: "reviewed",
    description: "Reviewed CFIHOS 2.0 reference data baseline.",
  },
  {
    key: "ccus",
    name: "CCUS RDL Extension",
    shortName: "CCUS",
    versionLabel: "0.1 draft",
    status: "candidate",
    description: "Candidate Carbon Capture, Utilisation and Storage RDL extension.",
  },
  {
    key: "water-desalination",
    name: "Water / Desalination RDL Extension",
    shortName: "Water / Desalination",
    versionLabel: "0.1 draft",
    status: "candidate",
    description: "Candidate Water and Desalination RDL extension normalized through the generic mapping layer.",
  },
] as const;

export function getRdlSource(key: string | undefined): RdlSourceDefinition | undefined {
  return RDL_SOURCES.find((source) => source.key === key);
}

export const RDL_ENTITY_TYPE_LABELS: Record<string, string> = {
  tag_class: "Tag Class",
  equipment_class: "Equipment Class",
  property: "Property",
  document_type: "Document Type",
  discipline: "Discipline",
  unit_of_measure: "Unit of Measure",
  source_standard: "Source Standard",
  handover_event: "Handover Event",
  controlled_list: "Controlled List",
  controlled_value: "Controlled Value",
  information_requirement: "Information Requirement",
  source_mapping: "Source Mapping",
};

export function entityTypeLabel(entityType: string): string {
  return RDL_ENTITY_TYPE_LABELS[entityType] ?? entityType.replaceAll("_", " ");
}

export function rdlEntityRoute(sourceKey: string, entityType: string, nativeIdentifier: string): string {
  return `/rdl/${encodeURIComponent(sourceKey)}/${encodeURIComponent(entityType)}/${encodeURIComponent(nativeIdentifier)}`;
}
