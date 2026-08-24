export type CfihosDiscipline = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type CfihosDocumentType = {
  id: string;
  shortCode: string;
  name: string;
  description: string | null;

  classification: string | null;

  synonyms: string[];
};

export type CfihosDisciplineDocumentType = {
  id: string;

  disciplineId: string;
  disciplineCode: string;
  disciplineName: string;

  documentTypeId: string;
  documentTypeShortCode: string;
  documentTypeName: string;
  documentTypeDescription: string | null;

  disciplineDocumentTypeShortCode: string | null;

  assetTypeReference: string | null;
  representationType: string | null;

  nativeFileDeliveryTiming: string | null;
  nativeDocumentFormat: string | null;
  authenticatedRecordFormat: string | null;

  requiredStatusDetailedEngineering: string | null;
  requiredStatusConstruction: string | null;
  requiredStatusCommissioning: string | null;
  requiredStatusStartup: string | null;
  requiredStatusOperations: string | null;

  reviewType: string | null;
  comment: string | null;

  hardcopyRequired: boolean | null;
  translatedDocumentRequired: boolean | null;

  synonyms: string[];
};

export type CfihosDisciplineWithDocumentTypes = {
  discipline: CfihosDiscipline;
  relationships: CfihosDisciplineDocumentType[];
};

export type CfihosDocumentTypeWithDisciplines = {
  documentType: CfihosDocumentType;
  relationships: CfihosDisciplineDocumentType[];
};

export type CfihosDocumentDomainDiagnostics = {
  disciplineCount: number;
  documentTypeCount: number;
  relationshipCount: number;

  unresolvedDisciplineCount: number;
  unresolvedDocumentTypeCount: number;

  duplicateDisciplineCodeCount: number;
  duplicateDocumentTypeShortCodeCount: number;

  orphanDocumentTypeCount: number;
  orphanDisciplineCount: number;
};