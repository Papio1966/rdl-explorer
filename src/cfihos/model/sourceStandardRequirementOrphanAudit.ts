export type CfihosRequirementOrphanOccurrence = {
  worksheetName: string;
  rowNumber: number;
  matchingColumns: string[];
  context: string;
};

export type CfihosRequirementOrphanObjectAudit = {
  id: string;
  name: string | null;
  occurrenceCount: number;
  nonMasterOccurrenceCount: number;
  occurrences: CfihosRequirementOrphanOccurrence[];
};

export type CfihosSourceStandardRequirementOrphanAuditDiagnostics = {
  targetObjectCount: number;
  workbookWorksheetCount: number;
  totalOccurrenceCount: number;
  objectsWithOnlyMasterOccurrenceCount: number;
  objectsWithAdditionalOccurrencesCount: number;
  objectsNotFoundCount: number;
  objects: CfihosRequirementOrphanObjectAudit[];
};
