import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";

import {
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeSynonyms,
} from "../model/common";

import type {
  CfihosDiscipline,
  CfihosDisciplineDocumentType,
  CfihosDisciplineWithDocumentTypes,
  CfihosDocumentDomainDiagnostics,
  CfihosDocumentType,
  CfihosDocumentTypeWithDisciplines,
} from "../model/document";

type DocumentRepositoryState = {
  disciplines: CfihosDiscipline[];
  disciplinesById: Map<string, CfihosDiscipline>;

  documentTypes: CfihosDocumentType[];
  documentTypesById: Map<string, CfihosDocumentType>;

  relationships: CfihosDisciplineDocumentType[];

  relationshipsByDisciplineId: Map<
    string,
    CfihosDisciplineDocumentType[]
  >;

  relationshipsByDocumentTypeId: Map<
    string,
    CfihosDisciplineDocumentType[]
  >;

  diagnostics: CfihosDocumentDomainDiagnostics;
};

export class CfihosDocumentRepository {
  private state: DocumentRepositoryState | null =
    null;

  private loadingPromise:
    | Promise<DocumentRepositoryState>
    | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getDisciplines(): Promise<
    CfihosDiscipline[]
  > {
    const state = await this.getState();

    return state.disciplines;
  }

  async getDiscipline(
    disciplineId: string,
  ): Promise<CfihosDiscipline | null> {
    const state = await this.getState();

    return (
      state.disciplinesById.get(
        disciplineId,
      ) ?? null
    );
  }

  async getDocumentTypes(): Promise<
    CfihosDocumentType[]
  > {
    const state = await this.getState();

    return state.documentTypes;
  }

  async getDocumentType(
    documentTypeId: string,
  ): Promise<CfihosDocumentType | null> {
    const state = await this.getState();

    return (
      state.documentTypesById.get(
        documentTypeId,
      ) ?? null
    );
  }

  async getRelationships(): Promise<
    CfihosDisciplineDocumentType[]
  > {
    const state = await this.getState();

    return state.relationships;
  }

  async getDocumentTypesForDiscipline(
    disciplineId: string,
  ): Promise<CfihosDisciplineDocumentType[]> {
    const state = await this.getState();

    return (
      state.relationshipsByDisciplineId.get(
        disciplineId,
      ) ?? []
    );
  }

  async getDisciplinesForDocumentType(
    documentTypeId: string,
  ): Promise<CfihosDisciplineDocumentType[]> {
    const state = await this.getState();

    return (
      state.relationshipsByDocumentTypeId.get(
        documentTypeId,
      ) ?? []
    );
  }

  async getDisciplineWithDocumentTypes(
    disciplineId: string,
  ): Promise<CfihosDisciplineWithDocumentTypes | null> {
    const state = await this.getState();

    const discipline =
      state.disciplinesById.get(
        disciplineId,
      );

    if (!discipline) {
      return null;
    }

    return {
      discipline,

      relationships:
        state.relationshipsByDisciplineId.get(
          disciplineId,
        ) ?? [],
    };
  }

  async getDocumentTypeWithDisciplines(
    documentTypeId: string,
  ): Promise<CfihosDocumentTypeWithDisciplines | null> {
    const state = await this.getState();

    const documentType =
      state.documentTypesById.get(
        documentTypeId,
      );

    if (!documentType) {
      return null;
    }

    return {
      documentType,

      relationships:
        state.relationshipsByDocumentTypeId.get(
          documentTypeId,
        ) ?? [],
    };
  }

  async searchDisciplines(
    query: string,
  ): Promise<CfihosDiscipline[]> {
    const state = await this.getState();

    const normalizedQuery =
      normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return [
        ...state.disciplines,
      ].sort(compareDisciplines);
    }

    return state.disciplines
      .filter((discipline) => {
        const searchableValues = [
          discipline.id,
          discipline.code,
          discipline.name,
          discipline.description,
        ];

        return searchableValues.some(
          (value) =>
            value
              ?.toLowerCase()
              .includes(
                normalizedQuery,
              ),
        );
      })
      .sort(compareDisciplines);
  }

  async searchDocumentTypes(
    query: string,
  ): Promise<CfihosDocumentType[]> {
    const state = await this.getState();

    const normalizedQuery =
      normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return [
        ...state.documentTypes,
      ].sort(compareDocumentTypes);
    }

    return state.documentTypes
      .filter((documentType) => {
        const searchableValues = [
          documentType.id,
          documentType.shortCode,
          documentType.name,
          documentType.description,
          documentType.classification,
          ...documentType.synonyms,
        ];

        return searchableValues.some(
          (value) =>
            value
              ?.toLowerCase()
              .includes(
                normalizedQuery,
              ),
        );
      })
      .sort(compareDocumentTypes);
  }

  async searchRelationships(
    query: string,
  ): Promise<
    CfihosDisciplineDocumentType[]
  > {
    const state = await this.getState();

    const normalizedQuery =
      normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return [
        ...state.relationships,
      ].sort(compareRelationships);
    }

    return state.relationships
      .filter((relationship) => {
        const searchableValues = [
          relationship.id,

          relationship.disciplineId,
          relationship.disciplineCode,
          relationship.disciplineName,

          relationship.documentTypeId,
          relationship.documentTypeShortCode,
          relationship.documentTypeName,
          relationship.documentTypeDescription,

          relationship.disciplineDocumentTypeShortCode,

          relationship.assetTypeReference,
          relationship.representationType,

          relationship.nativeFileDeliveryTiming,
          relationship.nativeDocumentFormat,
          relationship.authenticatedRecordFormat,

          relationship.requiredStatusDetailedEngineering,
          relationship.requiredStatusConstruction,
          relationship.requiredStatusCommissioning,
          relationship.requiredStatusStartup,
          relationship.requiredStatusOperations,

          relationship.reviewType,
          relationship.comment,

          ...relationship.synonyms,
        ];

        return searchableValues.some(
          (value) =>
            value
              ?.toLowerCase()
              .includes(
                normalizedQuery,
              ),
        );
      })
      .sort(compareRelationships);
  }

  async getRelationshipsByLifecycleStatus(
    status: string,
  ): Promise<
    CfihosDisciplineDocumentType[]
  > {
    const state = await this.getState();

    const normalizedStatus =
      normalizeSearchQuery(status);

    if (!normalizedStatus) {
      return [];
    }

    return state.relationships
      .filter((relationship) => {
        const statuses = [
          relationship.requiredStatusDetailedEngineering,
          relationship.requiredStatusConstruction,
          relationship.requiredStatusCommissioning,
          relationship.requiredStatusStartup,
          relationship.requiredStatusOperations,
        ];

        return statuses.some(
          (value) =>
            value
              ?.trim()
              .toLowerCase() ===
            normalizedStatus,
        );
      })
      .sort(compareRelationships);
  }

  async getRelationshipsByAssetType(
    assetTypeReference: string,
  ): Promise<
    CfihosDisciplineDocumentType[]
  > {
    const state = await this.getState();

    return filterRelationshipsByValue(
      state.relationships,
      (relationship) =>
        relationship.assetTypeReference,
      assetTypeReference,
    );
  }

  async getRelationshipsByRepresentationType(
    representationType: string,
  ): Promise<
    CfihosDisciplineDocumentType[]
  > {
    const state = await this.getState();

    return filterRelationshipsByValue(
      state.relationships,
      (relationship) =>
        relationship.representationType,
      representationType,
    );
  }

  async getRelationshipsByDeliveryTiming(
    deliveryTiming: string,
  ): Promise<
    CfihosDisciplineDocumentType[]
  > {
    const state = await this.getState();

    return filterRelationshipsByValue(
      state.relationships,
      (relationship) =>
        relationship.nativeFileDeliveryTiming,
      deliveryTiming,
    );
  }

  async getDiagnostics(): Promise<
    CfihosDocumentDomainDiagnostics
  > {
    const state = await this.getState();

    return state.diagnostics;
  }

  private async getState(): Promise<
    DocumentRepositoryState
  > {
    if (this.state) {
      return this.state;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise =
      this.buildState();

    try {
      this.state =
        await this.loadingPromise;

      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildState(): Promise<
    DocumentRepositoryState
  > {
    const [
      disciplineRows,
      documentTypeRows,
      relationshipRows,
    ] = await Promise.all([
      getCfihosWorksheetRows(
        "discipline",
      ),

      getCfihosWorksheetRows(
        "document type",
      ),

      getCfihosWorksheetRows(
        "discipline document type",
      ),
    ]);

    const disciplines =
      this.buildDisciplines(
        disciplineRows,
      );

    const documentTypes =
      this.buildDocumentTypes(
        documentTypeRows,
      );

    const relationships =
      this.buildRelationships(
        relationshipRows,
      );

    const disciplinesById =
      new Map<
        string,
        CfihosDiscipline
      >();

    for (
      const discipline of disciplines
    ) {
      disciplinesById.set(
        discipline.id,
        discipline,
      );
    }

    const documentTypesById =
      new Map<
        string,
        CfihosDocumentType
      >();

    for (
      const documentType of
        documentTypes
    ) {
      documentTypesById.set(
        documentType.id,
        documentType,
      );
    }

    const relationshipsByDisciplineId =
      new Map<
        string,
        CfihosDisciplineDocumentType[]
      >();

    const relationshipsByDocumentTypeId =
      new Map<
        string,
        CfihosDisciplineDocumentType[]
      >();

    for (
      const relationship of relationships
    ) {
      addToIndex(
        relationshipsByDisciplineId,
        relationship.disciplineId,
        relationship,
      );

      addToIndex(
        relationshipsByDocumentTypeId,
        relationship.documentTypeId,
        relationship,
      );
    }

    for (
      const disciplineRelationships of
        relationshipsByDisciplineId.values()
    ) {
      disciplineRelationships.sort(
        compareRelationships,
      );
    }

    for (
      const documentRelationships of
        relationshipsByDocumentTypeId.values()
    ) {
      documentRelationships.sort(
        compareRelationshipsByDiscipline,
      );
    }

    const diagnostics =
      this.buildDiagnostics(
        disciplines,
        documentTypes,
        relationships,
        disciplinesById,
        documentTypesById,
        relationshipsByDisciplineId,
        relationshipsByDocumentTypeId,
      );

    return {
      disciplines,
      disciplinesById,

      documentTypes,
      documentTypesById,

      relationships,

      relationshipsByDisciplineId,
      relationshipsByDocumentTypeId,

      diagnostics,
    };
  }

  private buildDisciplines(
    rows: CfihosWorksheetRow[],
  ): CfihosDiscipline[] {
    return rows
      .map(
        (
          row,
        ): CfihosDiscipline => ({
          id: normalizeRequiredString(
            row["CFIHOS unique code"],
          ),

          code: normalizeRequiredString(
            row["discipline code"],
          ),

          name: normalizeRequiredString(
            row["discipline name"],
          ),

          description:
            normalizeOptionalString(
              row[
                "discipline description"
              ],
            ),
        }),
      )
      .filter(
        (discipline) =>
          discipline.id.length > 0 &&
          discipline.code.length > 0 &&
          discipline.name.length > 0,
      )
      .sort(compareDisciplines);
  }

  private buildDocumentTypes(
    rows: CfihosWorksheetRow[],
  ): CfihosDocumentType[] {
    return rows
      .map(
        (
          row,
        ): CfihosDocumentType => ({
          id: normalizeRequiredString(
            row["CFIHOS unique code"],
          ),

          shortCode:
            normalizeRequiredString(
              row[
                "document type short code"
              ],
            ),

          name: normalizeRequiredString(
            row[
              "document type name"
            ],
          ),

          description:
            normalizeOptionalString(
              row[
                "document type description"
              ],
            ),

          classification:
            normalizeOptionalString(
              row[
                "document type classification"
              ],
            ),

          synonyms:
            normalizeSynonyms(
              row[
                "document type synonym name"
              ],
            ),
        }),
      )
      .filter(
        (documentType) =>
          documentType.id.length > 0 &&
          documentType.name.length > 0,
      )
      .sort(compareDocumentTypes);
  }

  private buildRelationships(
    rows: CfihosWorksheetRow[],
  ): CfihosDisciplineDocumentType[] {
    return rows
      .map(
        (
          row,
        ): CfihosDisciplineDocumentType => ({
          id: normalizeRequiredString(
            row[
              "discipline document type CFIHOS unique code"
            ],
          ),

          disciplineId:
            normalizeRequiredString(
              row[
                "discipline CFIHOS unique code"
              ],
            ),

          disciplineCode:
            normalizeRequiredString(
              row["discipline code"],
            ),

          disciplineName:
            normalizeRequiredString(
              row["discipline name"],
            ),

          documentTypeId:
            normalizeRequiredString(
              row[
                "document type CFIHOS unique code"
              ],
            ),

          documentTypeShortCode:
            normalizeRequiredString(
              row[
                "document type short code"
              ],
            ),

          documentTypeName:
            normalizeRequiredString(
              row[
                "document type name"
              ],
            ),

          documentTypeDescription:
            normalizeOptionalString(
              row[
                "document type description"
              ],
            ),

          disciplineDocumentTypeShortCode:
            normalizeOptionalString(
              row[
                "discipline document type short code"
              ],
            ),

          assetTypeReference:
            normalizeOptionalString(
              row[
                "asset type reference"
              ],
            ),

          representationType:
            normalizeOptionalString(
              row[
                "representation type"
              ],
            ),

          nativeFileDeliveryTiming:
            normalizeOptionalString(
              row[
                "native file delivery timing"
              ],
            ),

          nativeDocumentFormat:
            normalizeOptionalString(
              row[
                "native document format"
              ],
            ),

          authenticatedRecordFormat:
            normalizeOptionalString(
              row[
                "authenticated record format"
              ],
            ),

          requiredStatusDetailedEngineering:
            normalizeOptionalString(
              row[
                "required document status for detailed engineering"
              ],
            ),

          requiredStatusConstruction:
            normalizeOptionalString(
              row[
                "required document status for construction"
              ],
            ),

          requiredStatusCommissioning:
            normalizeOptionalString(
              row[
                "required document status for commissioning"
              ],
            ),

          requiredStatusStartup:
            normalizeOptionalString(
              row[
                "required document status for startup"
              ],
            ),

          requiredStatusOperations:
            normalizeOptionalString(
              row[
                "required document status for operations"
              ],
            ),

          reviewType:
            normalizeOptionalString(
              row["review type"],
            ),

          comment:
            normalizeOptionalString(
              row[
                "discipline document type comment"
              ],
            ),

          hardcopyRequired:
            normalizeNullableBoolean(
              row[
                "hardcopy document required"
              ],
            ),

          translatedDocumentRequired:
            normalizeNullableBoolean(
              row[
                "translated document required"
              ],
            ),

          synonyms:
            normalizeSynonyms(
              row[
                "document type synonym name"
              ],
            ),
        }),
      )
      .filter(
        (relationship) =>
          relationship.id.length > 0 &&
          relationship.disciplineId.length >
            0 &&
          relationship.documentTypeId.length >
            0,
      )
      .sort(compareRelationships);
  }

  private buildDiagnostics(
    disciplines: CfihosDiscipline[],
    documentTypes: CfihosDocumentType[],
    relationships:
      CfihosDisciplineDocumentType[],

    disciplinesById: Map<
      string,
      CfihosDiscipline
    >,

    documentTypesById: Map<
      string,
      CfihosDocumentType
    >,

    relationshipsByDisciplineId: Map<
      string,
      CfihosDisciplineDocumentType[]
    >,

    relationshipsByDocumentTypeId: Map<
      string,
      CfihosDisciplineDocumentType[]
    >,
  ): CfihosDocumentDomainDiagnostics {
    const unresolvedDisciplineCount =
      relationships.filter(
        (relationship) =>
          !disciplinesById.has(
            relationship.disciplineId,
          ),
      ).length;

    const unresolvedDocumentTypeCount =
      relationships.filter(
        (relationship) =>
          !documentTypesById.has(
            relationship.documentTypeId,
          ),
      ).length;

    const duplicateDisciplineCodeCount =
      countDuplicateNormalizedValues(
        disciplines.map(
          (discipline) =>
            discipline.code,
        ),
      );

    const duplicateDocumentTypeShortCodeCount =
      countDuplicateNormalizedValues(
        documentTypes.map(
          (documentType) =>
            documentType.shortCode,
        ),
      );

    const orphanDocumentTypeCount =
      documentTypes.filter(
        (documentType) =>
          !relationshipsByDocumentTypeId.has(
            documentType.id,
          ),
      ).length;

    const orphanDisciplineCount =
      disciplines.filter(
        (discipline) =>
          !relationshipsByDisciplineId.has(
            discipline.id,
          ),
      ).length;

    return {
      disciplineCount:
        disciplines.length,

      documentTypeCount:
        documentTypes.length,

      relationshipCount:
        relationships.length,

      unresolvedDisciplineCount,
      unresolvedDocumentTypeCount,

      duplicateDisciplineCodeCount,
      duplicateDocumentTypeShortCodeCount,

      orphanDocumentTypeCount,
      orphanDisciplineCount,
    };
  }
}

function addToIndex<T>(
  index: Map<string, T[]>,
  key: string,
  value: T,
): void {
  const existing =
    index.get(key) ?? [];

  existing.push(value);

  index.set(
    key,
    existing,
  );
}

function normalizeSearchQuery(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function normalizeNullableBoolean(
  value: unknown,
): boolean | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    normalized === "" ||
    normalized === "-" ||
    normalized === "—" ||
    normalized === "not specified" ||
    normalized === "n/a" ||
    normalized === "not applicable"
  ) {
    return null;
  }

  if (
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "true" ||
    normalized === "1"
  ) {
    return true;
  }

  if (
    normalized === "no" ||
    normalized === "n" ||
    normalized === "false" ||
    normalized === "0"
  ) {
    return false;
  }

  /*
   * Do not silently interpret an unknown
   * future CFIHOS value as false.
   */
  return null;
}

function filterRelationshipsByValue(
  relationships:
    CfihosDisciplineDocumentType[],

  selector: (
    relationship:
      CfihosDisciplineDocumentType,
  ) => string | null,

  requestedValue: string,
): CfihosDisciplineDocumentType[] {
  const normalizedRequestedValue =
    normalizeSearchQuery(
      requestedValue,
    );

  if (!normalizedRequestedValue) {
    return [];
  }

  return relationships
    .filter((relationship) => {
      const value =
        selector(relationship);

      return (
        value
          ?.trim()
          .toLowerCase() ===
        normalizedRequestedValue
      );
    })
    .sort(compareRelationships);
}

function countDuplicateNormalizedValues(
  values: string[],
): number {
  const counts =
    new Map<string, number>();

  for (const value of values) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (!normalized) {
      continue;
    }

    counts.set(
      normalized,
      (counts.get(normalized) ?? 0) +
        1,
    );
  }

  return Array.from(
    counts.values(),
  ).filter(
    (count) => count > 1,
  ).length;
}

function compareDisciplines(
  a: CfihosDiscipline,
  b: CfihosDiscipline,
): number {
  const codeComparison =
    a.code.localeCompare(
      b.code,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );

  if (codeComparison !== 0) {
    return codeComparison;
  }

  return a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

function compareDocumentTypes(
  a: CfihosDocumentType,
  b: CfihosDocumentType,
): number {
  return a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

function compareRelationships(
  a: CfihosDisciplineDocumentType,
  b: CfihosDisciplineDocumentType,
): number {
  const nameComparison =
    a.documentTypeName.localeCompare(
      b.documentTypeName,
      undefined,
      {
        sensitivity: "base",
      },
    );

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return a.disciplineCode.localeCompare(
    b.disciplineCode,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function compareRelationshipsByDiscipline(
  a: CfihosDisciplineDocumentType,
  b: CfihosDisciplineDocumentType,
): number {
  const disciplineComparison =
    a.disciplineCode.localeCompare(
      b.disciplineCode,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );

  if (disciplineComparison !== 0) {
    return disciplineComparison;
  }

  return a.documentTypeName.localeCompare(
    b.documentTypeName,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

export const cfihosDocumentRepository =
  new CfihosDocumentRepository();