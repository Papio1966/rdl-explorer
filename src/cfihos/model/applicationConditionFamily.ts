export type CfihosApplicationConditionWorksheetUsage = {
  sheetName: string;
  applicationConditionOccurrences: number;
  applicationConditionObjects: number;
  requirementConditionOccurrences: number;
  requirementConditionObjects: number;
  conditionGroupOccurrences: number;
  conditionGroupObjects: number;
  sourceRequirementOccurrences: number;
  sourceRequirementObjects: number;
  rowsWithRequirementAndCondition: number;
  rowsWithConditionAndApplicationCondition: number;
  rowsWithApplicationConditionAndGroup: number;
};

export type CfihosApplicationConditionRelationshipSample = {
  sheetName: string;
  sourceRequirementId: string | null;
  sourceRequirementName: string | null;
  requirementConditionId: string | null;
  requirementConditionName: string | null;
  applicationConditionId: string | null;
  applicationConditionName: string | null;
  conditionGroupId: string | null;
  conditionGroupName: string | null;
};

export type CfihosApplicationConditionFamilyDiagnostics = {
  masterApplicationConditionCount: number;
  masterRequirementConditionCount: number;
  masterConditionGroupCount: number;
  masterSourceRequirementCount: number;
  worksheetsScannedCount: number;

  applicationConditionOccurrences: number;
  referencedApplicationConditionCount: number;
  masterOnlyApplicationConditionCount: number;

  requirementConditionOccurrences: number;
  referencedRequirementConditionCount: number;
  masterOnlyRequirementConditionCount: number;

  conditionGroupOccurrences: number;
  referencedConditionGroupCount: number;
  masterOnlyConditionGroupCount: number;

  rowsWithRequirementAndConditionCount: number;
  distinctRequirementConditionPairCount: number;
  rowsWithConditionAndApplicationConditionCount: number;
  distinctConditionApplicationPairCount: number;
  rowsWithApplicationConditionAndGroupCount: number;
  distinctApplicationGroupPairCount: number;
  rowsWithAllConditionLayersCount: number;

  worksheetUsage: CfihosApplicationConditionWorksheetUsage[];
  relationshipSamples: CfihosApplicationConditionRelationshipSample[];
};
