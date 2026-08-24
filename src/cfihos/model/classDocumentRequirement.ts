export type CfihosClassDocumentAssetType =
  | "Tag"
  | "Equipment"
  | "Model_Part"
  | "Plant"
  | "Process_Unit"
  | "Unknown";

export type CfihosClassDocumentRequirement = {
  id: string;

  classId: string;
  className: string;

  assetTypeReference: string | null;
  assetType: CfihosClassDocumentAssetType;

  sourceStandardId: string | null;
  sourceStandardCode: string | null;

  documentTypeId: string;
  documentTypeName: string;
};

export type CfihosResolvedClassDocumentRequirement = {
  requirement: CfihosClassDocumentRequirement;

  resolvedTagClassId: string | null;
  resolvedEquipmentClassId: string | null;

  resolvedDocumentTypeId: string | null;
  resolvedSourceStandardId: string | null;
};

export type CfihosUnresolvedEquipmentRequirement = {
  requirementId: string;
  classId: string;
  className: string;
  documentTypeId: string;
  documentTypeName: string;
  sourceStandardId: string | null;
  sourceStandardCode: string | null;
};

export type CfihosClassDocumentDiagnostics = {
  sourceRequirementCount: number;
  uniqueSemanticRequirementCount: number;
  duplicateSemanticRequirementCount: number;

  tagRequirementCount: number;
  equipmentRequirementCount: number;
  modelPartRequirementCount: number;
  plantRequirementCount: number;
  processUnitRequirementCount: number;
  unknownAssetTypeRequirementCount: number;
  unknownAssetTypeValues: string[];

  resolvedClassReferenceCount: number;
  unresolvedClassReferenceCount: number;

  resolvedTagClassReferenceCount: number;
  unresolvedTagClassReferenceCount: number;

  resolvedEquipmentClassReferenceCount: number;
  unresolvedEquipmentClassReferenceCount: number;
  unresolvedEquipmentRequirements: CfihosUnresolvedEquipmentRequirement[];

  modelPartResolvedAsTagOnlyCount: number;
  modelPartResolvedAsEquipmentOnlyCount: number;
  modelPartResolvedInBothDomainsCount: number;
  modelPartUnresolvedClassCount: number;

  resolvedDocumentTypeReferenceCount: number;
  unresolvedDocumentTypeReferenceCount: number;

  resolvedSourceStandardReferenceCount: number;
  unresolvedSourceStandardReferenceCount: number;
  missingSourceStandardReferenceCount: number;

  unresolvedClassIds: string[];
  unresolvedDocumentTypeIds: string[];
  unresolvedSourceStandardIds: string[];
};
