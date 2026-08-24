export type CfihosJip33RequirementMapping = {
  requirementId: string;

  tagClassId: string;
  tagClassName: string;

  sourceStandardId: string;
  sourceStandardCode: string | null;

  disciplineId: string | null;
  disciplineName: string | null;

  documentTypeId: string;
  documentTypeName: string;

  submitAtProposal: string | null;
  submitForReview: string | null;
  submitAtDelivery: string | null;

  issueForReviewNumberOfWeeks: string | null;
  issueForReviewReferenceDate: string | null;
  issueForApprovalNumberOfWeeks: string | null;
  issueForApprovalReferenceDate: string | null;
  forInformationNumberOfWeeks: string | null;
  forInformationReferenceDate: string | null;

  requiredHandoverStatusCode: string | null;
  requiredTranslationIndicator: string | null;
  deliverableFormatCode: string | null;
};

export type CfihosJip33Requirement = {
  id: string;
  number: string | null;
  title: string | null;
  typicalDeliverable: string | null;
  description: string | null;
  comment: string | null;
  requirementTypeCode: string | null;
  requirementGroupCode: string | null;
  engineeringStandardSourceChapter: string | null;
  mappings: CfihosJip33RequirementMapping[];
};

export type CfihosJip33RequirementSummary = {
  requirementCount: number;
  mappingCount: number;
  tagClassCount: number;
  sourceStandardCount: number;
  documentTypeCount: number;
  requirementGroupCount: number;
};

export type CfihosJip33RequirementDiagnostics = {
  sourceRowCount: number;
  uniqueRequirementIdCount: number;
  duplicateRequirementIdCount: number;
  tagClassCount: number;
  sourceStandardCount: number;
  disciplineCount: number;
  documentTypeCount: number;
  requirementTypeCount: number;
  requirementGroupCount: number;
  resolvedTagClassReferenceCount: number;
  unresolvedTagClassReferenceCount: number;
  resolvedSourceStandardReferenceCount: number;
  unresolvedSourceStandardReferenceCount: number;
  resolvedDisciplineReferenceCount: number;
  unresolvedDisciplineReferenceCount: number;
  resolvedDocumentTypeReferenceCount: number;
  unresolvedDocumentTypeReferenceCount: number;
  classDocumentCombinationCount: number;
  overlappingClassDocumentCombinationCount: number;
  additionalClassDocumentCombinationCount: number;
  proposalSubmissionCount: number;
  reviewSubmissionCount: number;
  deliverySubmissionCount: number;
  reviewTimingCount: number;
  approvalTimingCount: number;
  informationTimingCount: number;
  handoverStatusCount: number;
  translationIndicatorCount: number;
  deliverableFormatCount: number;
  unresolvedTagClassIds: string[];
  unresolvedSourceStandardIds: string[];
  unresolvedDisciplineIds: string[];
  unresolvedDocumentTypeIds: string[];
  requirementTypes: Array<{ code: string; count: number }>;
  requirementGroups: Array<{ code: string; count: number }>;
};
