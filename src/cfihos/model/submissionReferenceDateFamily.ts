export type CfihosSubmissionReferenceDateMasterObject = {
  id: string;
  name: string;
  description: string | null;
};

export type CfihosSubmissionReferenceDateOccurrence = {
  sheetName: string;
  excelRow: number;
  columnName: string;
  matchedBy: "id" | "name";
  objectId: string;
  objectName: string;
  value: string;
};

export type CfihosReferenceDateFieldUsage = {
  sheetName: string;
  columnName: string;
  nonEmptyValueCount: number;
  uniqueValueCount: number;
  masterIdMatchCount: number;
  masterNameMatchCount: number;
  sampleValues: string[];
};

export type CfihosSubmissionReferenceDateFamilyDiagnostics = {
  masterObjectCount: number;
  worksheetsScannedCount: number;

  idOccurrenceCount: number;
  nameOccurrenceCount: number;
  referencedMasterObjectCount: number;
  masterOnlyObjectCount: number;

  referenceDateFieldCount: number;
  populatedReferenceDateValueCount: number;
  referenceDateMasterIdMatchCount: number;
  referenceDateMasterNameMatchCount: number;

  masterObjects: CfihosSubmissionReferenceDateMasterObject[];
  occurrences: CfihosSubmissionReferenceDateOccurrence[];
  referenceDateFields: CfihosReferenceDateFieldUsage[];
};
