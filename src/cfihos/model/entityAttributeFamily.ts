export type CfihosEntityAttributeWorksheetUsage = {
  sheetName: string;
  entityOccurrenceCount: number;
  entityObjectCount: number;
  attributeOccurrenceCount: number;
  attributeObjectCount: number;
  rowsWithBothCount: number;
};

export type CfihosEntityAttributeCooccurrenceSample = {
  sheetName: string;
  entityId: string;
  entityName: string;
  attributeId: string;
  attributeName: string;
};

export type CfihosMasterObjectSample = {
  id: string;
  name: string;
};

export type CfihosEntityAttributeFamilyDiagnostics = {
  masterEntityObjectCount: number;
  masterEntityAttributeObjectCount: number;
  worksheetsScannedCount: number;
  entityOccurrenceCountOutsideMaster: number;
  referencedEntityObjectCount: number;
  masterOnlyEntityObjectCount: number;
  attributeOccurrenceCountOutsideMaster: number;
  referencedAttributeObjectCount: number;
  masterOnlyAttributeObjectCount: number;
  rowsWithEntityAndAttributeCount: number;
  distinctEntityAttributePairCount: number;
  worksheetUsage: CfihosEntityAttributeWorksheetUsage[];
  cooccurrenceSamples: CfihosEntityAttributeCooccurrenceSample[];
  masterOnlyEntitySamples: CfihosMasterObjectSample[];
  masterOnlyAttributeSamples: CfihosMasterObjectSample[];
};
