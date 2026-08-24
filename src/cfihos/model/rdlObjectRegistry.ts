export type CfihosRdlMasterObject = {
  id: string;
  name: string;
  description: string | null;
  definitionFile: string | null;
};

export type CfihosObjectEquivalentMapping = {
  objectId: string;
  codingSourceCode: string;
  equivalentValue: string;
};

export type CfihosRdlObjectFamilyDiagnostic = {
  definitionFile: string;
  objectCount: number;
  explorerCoverage: "implemented" | "supporting" | "unclassified";
};

export type CfihosCodingSourceDiagnostic = {
  codingSourceCode: string;
  mappingCount: number;
  objectCount: number;
};

export type CfihosRdlObjectRegistryDiagnostics = {
  masterObjectCount: number;
  uniqueMasterObjectIdCount: number;
  duplicateMasterObjectIdCount: number;
  duplicateMasterObjectNameCount: number;
  missingNameCount: number;
  missingDescriptionCount: number;
  missingDefinitionFileCount: number;

  definitionFileCount: number;
  implementedFamilyCount: number;
  supportingFamilyCount: number;
  unclassifiedFamilyCount: number;
  families: CfihosRdlObjectFamilyDiagnostic[];

  equivalenceMappingCount: number;
  mappedObjectCount: number;
  codingSourceCount: number;
  resolvedEquivalenceMappingCount: number;
  unresolvedEquivalenceMappingCount: number;
  duplicateEquivalenceMappingCount: number;
  codingSources: CfihosCodingSourceDiagnostic[];
  unresolvedObjectIds: string[];
};
