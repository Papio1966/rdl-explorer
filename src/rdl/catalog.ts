export type RdlSourceKey = "cfihos" | "ccus" | "water-desalination";
export type RdlScopeKey = "all" | RdlSourceKey;
export type RdlReleaseStatus = "reviewed" | "candidate" | "superseded";

export type RdlReleaseDefinition = {
  key: string;
  versionLabel: string;
  status: RdlReleaseStatus;
  description: string;
};

export type RdlSourceDefinition = {
  key: RdlSourceKey;
  name: string;
  shortName: string;
  defaultReleaseKey: string;
  /** Compatibility fields: always describe the default release. */
  versionLabel: string;
  status: "reviewed" | "candidate";
  description: string;
  releases: readonly RdlReleaseDefinition[];
};

export const RDL_SOURCES: readonly RdlSourceDefinition[] = [
  {
    key: "cfihos",
    name: "CFIHOS",
    shortName: "CFIHOS",
    defaultReleaseKey: "cfihos-2.0",
    versionLabel: "2.0",
    status: "reviewed",
    description: "Reviewed CFIHOS 2.0 reference data baseline.",
    releases: [
      { key: "cfihos-2.0", versionLabel: "2.0", status: "reviewed", description: "Reviewed CFIHOS 2.0 baseline." },
    ],
  },
  {
    key: "ccus",
    name: "CCUS RDL Extension",
    shortName: "CCUS",
    defaultReleaseKey: "ccus-2.0-candidate",
    versionLabel: "2.0 candidate",
    status: "candidate",
    description: "Candidate Carbon Capture, Utilisation and Storage RDL extension.",
    releases: [
      { key: "ccus-2.0-candidate", versionLabel: "2.0 candidate", status: "candidate", description: "Release-safe candidate with expanded engineering coverage." },
      { key: "ccus-0.1-draft", versionLabel: "0.1 draft", status: "superseded", description: "Historical draft retained for release comparison and pinned consumers." },
    ],
  },
  {
    key: "water-desalination",
    name: "Water / Desalination RDL Extension",
    shortName: "Water / Desalination",
    defaultReleaseKey: "water-desalination-2.0-candidate",
    versionLabel: "2.0 candidate",
    status: "candidate",
    description: "Candidate Water and Desalination RDL extension normalized through the generic mapping layer.",
    releases: [
      { key: "water-desalination-2.0-candidate", versionLabel: "2.0 candidate", status: "candidate", description: "Release-safe candidate with normalized names, provenance and richer requirements." },
      { key: "water-desalination-0.1-draft", versionLabel: "0.1 draft", status: "superseded", description: "Historical draft retained for release comparison and pinned consumers." },
    ],
  },
] as const;

export function getRdlSource(key: string | undefined): RdlSourceDefinition | undefined {
  return RDL_SOURCES.find((source) => source.key === key);
}

export function getRdlRelease(sourceKey: string | undefined, releaseKey: string | undefined): RdlReleaseDefinition | undefined {
  return getRdlSource(sourceKey)?.releases.find((release) => release.key === releaseKey);
}

export function getDefaultReleaseKey(sourceKey: string | undefined): string | undefined {
  return getRdlSource(sourceKey)?.defaultReleaseKey;
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

export function rdlEntityRoute(sourceKey: string, entityType: string, nativeIdentifier: string): string;
export function rdlEntityRoute(sourceKey: string, releaseKey: string, entityType: string, nativeIdentifier: string): string;
export function rdlEntityRoute(sourceKey: string, releaseOrType: string, typeOrIdentifier: string, maybeIdentifier?: string): string {
  const releaseKey = maybeIdentifier === undefined ? (getDefaultReleaseKey(sourceKey) ?? "current") : releaseOrType;
  const entityType = maybeIdentifier === undefined ? releaseOrType : typeOrIdentifier;
  const nativeIdentifier = maybeIdentifier === undefined ? typeOrIdentifier : maybeIdentifier;
  return `/rdl/${encodeURIComponent(sourceKey)}/${encodeURIComponent(releaseKey)}/${encodeURIComponent(entityType)}/${encodeURIComponent(nativeIdentifier)}`;
}
