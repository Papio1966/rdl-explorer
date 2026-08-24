export type CfihosPropertyGroupingPurposeMasterObject = {
  id: string;
  name: string;
  description: string | null;
};

export type CfihosPropertyGroupingPurposeFamilyDiagnostics = {
  masterPurposeCount: number;
  uniqueMasterPurposeIdCount: number;
  duplicateMasterPurposeIdCount: number;

  groupingRowCount: number;
  rowsWithPurposeReferenceCount: number;
  uniquePurposeReferenceCount: number;
  resolvedPurposeReferenceCount: number;
  unresolvedPurposeReferenceCount: number;

  referencedMasterPurposeCount: number;
  masterOnlyPurposeCount: number;
  purposeCoveragePercent: number;

  purposes: CfihosPropertyGroupingPurposeMasterObject[];
  masterOnlyPurposes: CfihosPropertyGroupingPurposeMasterObject[];
  unresolvedPurposeIds: string[];
};
