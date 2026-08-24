export type CfihosPropertyGrouping = {
  allowedForPurposeId: string | null;
  purposeId: string | null;
  purposeCode: string | null;
  purposeDescription: string | null;

  sourceStandardId: string | null;
  sourceStandardCode: string | null;

  propertyGroupId: string | null;
  propertyGroupCode: string | null;
  propertyGroupDescription: string | null;

  assignmentId: string | null;

  classId: string | null;
  className: string | null;

  propertyId: string | null;
  propertyName: string | null;
  sequenceNumber: number | null;
};

export type CfihosPropertyGroupingPurposeSummary = {
  purposeId: string | null;
  purposeCode: string;
  purposeDescription: string | null;
  rowCount: number;
  groupCount: number;
  classCount: number;
  propertyCount: number;
};

export type CfihosPropertyGroupingDiagnostics = {
  sourceRowCount: number;
  uniqueAssignmentCount: number;
  duplicateAssignmentCount: number;

  purposeCount: number;
  propertyGroupCount: number;
  classReferenceCount: number;
  propertyReferenceCount: number;

  resolvedTagOnlyClassCount: number;
  resolvedEquipmentOnlyClassCount: number;
  resolvedInBothClassCount: number;
  unresolvedClassCount: number;

  resolvedPropertyReferenceCount: number;
  unresolvedPropertyReferenceCount: number;

  sourceStandardReferenceCount: number;
  missingSourceStandardReferenceCount: number;
  resolvedSourceStandardReferenceCount: number;
  unresolvedSourceStandardReferenceCount: number;

  sequencedRowCount: number;
  unsequencedRowCount: number;
  invalidSequenceCount: number;

  purposes: CfihosPropertyGroupingPurposeSummary[];
  unresolvedClassIds: string[];
  unresolvedPropertyIds: string[];
  unresolvedSourceStandardIds: string[];
};


export type CfihosPropertyGroupingSourceStandard = {
  id: string;
  code: string | null;
};

export type CfihosPropertyGroupingGroup = {
  id: string | null;
  code: string | null;
  description: string | null;
  sourceStandards: CfihosPropertyGroupingSourceStandard[];
  assignments: CfihosPropertyGrouping[];
};

export type CfihosClassPropertyGroupingView = {
  classId: string;
  purposeId: string | null;
  purposeCode: string;
  purposeDescription: string | null;
  groups: CfihosPropertyGroupingGroup[];
  assignmentCount: number;
  propertyCount: number;
};
