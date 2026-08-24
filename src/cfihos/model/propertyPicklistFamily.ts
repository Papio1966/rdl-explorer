export type CfihosPropertyPicklistMasterObject = {
  id: string;
  name: string;
  description: string | null;
};

export type CfihosPropertyPicklistValueMasterObject = {
  id: string;
  name: string;
  description: string | null;
};

export type CfihosPropertyPicklistUsageSummary = {
  picklistId: string;
  picklistName: string;
  propertyCount: number;
  valueCount: number;
};

export type CfihosPropertyPicklistFamilyDiagnostics = {
  masterPicklistCount: number;
  uniqueMasterPicklistIdCount: number;
  duplicateMasterPicklistIdCount: number;

  masterPicklistValueCount: number;
  uniqueMasterPicklistValueIdCount: number;
  duplicateMasterPicklistValueIdCount: number;

  propertyCount: number;
  propertiesWithPicklistCount: number;
  uniquePropertyPicklistReferenceCount: number;
  resolvedPropertyPicklistReferenceCount: number;
  unresolvedPropertyPicklistReferenceCount: number;

  picklistValueRowCount: number;
  uniqueValueParentPicklistCount: number;
  resolvedValueParentPicklistCount: number;
  unresolvedValueParentPicklistCount: number;

  resolvedValueMasterObjectCount: number;
  unresolvedValueMasterObjectCount: number;

  referencedMasterPicklistCount: number;
  masterOnlyPicklistCount: number;
  picklistsWithoutValuesCount: number;

  propertyToPicklistToValueComplete: boolean;

  masterOnlyPicklists: CfihosPropertyPicklistMasterObject[];
  picklistsWithoutValues: CfihosPropertyPicklistMasterObject[];
  unresolvedPropertyPicklistIds: string[];
  unresolvedValueParentPicklistIds: string[];
  unresolvedValueIds: string[];
  representativePicklists: CfihosPropertyPicklistUsageSummary[];
};
