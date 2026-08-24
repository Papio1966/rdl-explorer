export type CfihosExternalEquivalenceNeighbor = {
  id: string;
  name: string;
  definitionFile: string | null;
};

export type CfihosExternalEquivalenceOccurrence = {
  worksheet: string;
  column: string;
  count: number;
};

export type CfihosExternalEquivalenceOrphanDetail = {
  objectId: string;
  codingSourceCode: string;
  equivalentValue: string;
  mappingCount: number;
  outsideMappingOccurrenceCount: number;
  outsideMappingWorksheetCount: number;
  occurrences: CfihosExternalEquivalenceOccurrence[];
  previousMasterObject: CfihosExternalEquivalenceNeighbor | null;
  nextMasterObject: CfihosExternalEquivalenceNeighbor | null;
  neighborsShareFamily: boolean;
};

export type CfihosExternalEquivalenceSourceSummary = {
  codingSourceCode: string;
  unresolvedMappingCount: number;
  unresolvedObjectCount: number;
};

export type CfihosExternalEquivalenceOrphanAuditDiagnostics = {
  equivalenceMappingCount: number;
  resolvedMappingCount: number;
  unresolvedMappingCount: number;
  unresolvedObjectCount: number;
  worksheetsScanned: number;
  unresolvedObjectsReferencedElsewhere: number;
  mappingOnlyUnresolvedObjects: number;
  outsideMappingOccurrenceCount: number;
  sameFamilyNeighborGapCount: number;
  sourceSummaries: CfihosExternalEquivalenceSourceSummary[];
  details: CfihosExternalEquivalenceOrphanDetail[];
};
