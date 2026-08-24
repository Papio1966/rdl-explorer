export type CfihosConditionSemanticTerm = {
  term: string;
  count: number;
};

export type CfihosConditionSemanticObject = {
  id: string;
  name: string;
  description: string | null;
};

export type CfihosConditionModelSemanticAuditDiagnostics = {
  applicationConditionCount: number;
  requirementConditionCount: number;
  conditionGroupCount: number;
  totalConditionObjectCount: number;

  applicationConditionsWithDescriptionCount: number;
  requirementConditionsWithDescriptionCount: number;
  conditionGroupsWithDescriptionCount: number;
  duplicateApplicationConditionNameCount: number;
  duplicateRequirementConditionNameCount: number;
  duplicateConditionGroupNameCount: number;

  requirementConditionsSharingApplicationVocabularyCount: number;
  applicationConditionsSharingGroupVocabularyCount: number;

  applicationConditionTopTerms: CfihosConditionSemanticTerm[];
  requirementConditionTopTerms: CfihosConditionSemanticTerm[];
  conditionGroupTopTerms: CfihosConditionSemanticTerm[];

  applicationConditionSamples: CfihosConditionSemanticObject[];
  requirementConditionSamples: CfihosConditionSemanticObject[];
  conditionGroupSamples: CfihosConditionSemanticObject[];
};
