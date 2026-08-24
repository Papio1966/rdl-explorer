import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";

import {
  normalizeBoolean,
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";

import type {
  CfihosClassDomain,
  CfihosClassMatchMethod,
  CfihosClassPropertySourceStandard,
  CfihosClassSourceStandard,
  CfihosResolvedClassReference,
  CfihosSourceStandard,
  CfihosSourceStandardDiagnostics,
  CfihosSourceStandardPicklistValue,
  CfihosSourceStandardUsage,
} from "../model/sourceStandard";

import type {
  CfihosTagClass,
} from "../model/tagClass";

import type {
  CfihosEquipmentClass,
} from "../model/equipmentClass";

import {
  cfihosRepository,
} from "./CfihosRepository";

import {
  cfihosEquipmentRepository,
} from "./CfihosEquipmentRepository";

type ClassResolutionIndexes = {
  tagClassesById: Map<
    string,
    CfihosTagClass
  >;

  equipmentClassesById: Map<
    string,
    CfihosEquipmentClass
  >;

  tagClassesByName: Map<
    string,
    CfihosTagClass[]
  >;

  equipmentClassesByName: Map<
    string,
    CfihosEquipmentClass[]
  >;
};

type SourceStandardRepositoryState = {
  standards: CfihosSourceStandard[];

  standardsById: Map<
    string,
    CfihosSourceStandard
  >;

  classRelationships:
    CfihosClassSourceStandard[];

  classRelationshipsByStandardId: Map<
    string,
    CfihosClassSourceStandard[]
  >;

  classRelationshipsByClassId: Map<
    string,
    CfihosClassSourceStandard[]
  >;

  propertyRelationships:
    CfihosClassPropertySourceStandard[];

  propertyRelationshipsByStandardId: Map<
    string,
    CfihosClassPropertySourceStandard[]
  >;

  propertyRelationshipsByClassId: Map<
    string,
    CfihosClassPropertySourceStandard[]
  >;

  propertyRelationshipsByPropertyId: Map<
    string,
    CfihosClassPropertySourceStandard[]
  >;

  picklistValues:
    CfihosSourceStandardPicklistValue[];

  picklistValuesByStandardId: Map<
    string,
    CfihosSourceStandardPicklistValue[]
  >;

  diagnostics:
    CfihosSourceStandardDiagnostics;
};

export class CfihosSourceStandardRepository {
  private state:
    | SourceStandardRepositoryState
    | null = null;

  private loadingPromise:
    | Promise<SourceStandardRepositoryState>
    | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getSourceStandards(): Promise<
    CfihosSourceStandard[]
  > {
    const state = await this.getState();

    return state.standards;
  }

  async getSourceStandard(
    id: string,
  ): Promise<CfihosSourceStandard | null> {
    const state = await this.getState();

    return (
      state.standardsById.get(id) ??
      null
    );
  }

  async searchSourceStandards(
    query: string,
  ): Promise<CfihosSourceStandard[]> {
    const state = await this.getState();

    const normalizedQuery =
      normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return [...state.standards];
    }

    return state.standards.filter(
      (standard) => {
        const values = [
          standard.id,
          standard.code,
          standard.description,
        ];

        return values.some((value) =>
          value
            ?.toLowerCase()
            .includes(
              normalizedQuery,
            ),
        );
      },
    );
  }

  async getSourceStandardUsage(
    sourceStandardId: string,
  ): Promise<CfihosSourceStandardUsage | null> {
    const state = await this.getState();

    const standard =
      state.standardsById.get(
        sourceStandardId,
      );

    if (!standard) {
      return null;
    }

    return {
      standard,

      classRelationships:
        state.classRelationshipsByStandardId.get(
          sourceStandardId,
        ) ?? [],

      propertyRelationships:
        state.propertyRelationshipsByStandardId.get(
          sourceStandardId,
        ) ?? [],

      picklistValues:
        state.picklistValuesByStandardId.get(
          sourceStandardId,
        ) ?? [],
    };
  }

  async getStandardsForClass(
    classId: string,
  ): Promise<CfihosClassSourceStandard[]> {
    const state = await this.getState();

    return (
      state.classRelationshipsByClassId.get(
        classId,
      ) ?? []
    );
  }

  async getPropertyStandardsForClass(
    classId: string,
  ): Promise<
    CfihosClassPropertySourceStandard[]
  > {
    const state = await this.getState();

    return (
      state.propertyRelationshipsByClassId.get(
        classId,
      ) ?? []
    );
  }

  async getStandardsForProperty(
    propertyId: string,
  ): Promise<
    CfihosClassPropertySourceStandard[]
  > {
    const state = await this.getState();

    return (
      state.propertyRelationshipsByPropertyId.get(
        propertyId,
      ) ?? []
    );
  }

  async getDiagnostics(): Promise<
    CfihosSourceStandardDiagnostics
  > {
    const state = await this.getState();

    return state.diagnostics;
  }

  private async getState(): Promise<
    SourceStandardRepositoryState
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
    SourceStandardRepositoryState
  > {
    const [
      sourceStandardRows,
      classStandardRows,
      propertyStandardRows,
      picklistRows,
      tagClasses,
      equipmentClasses,
    ] = await Promise.all([
      getCfihosWorksheetRows(
        "source standard",
      ),

      getCfihosWorksheetRows(
        "tag or equip class src standard",
      ),

      getCfihosWorksheetRows(
        "tag equip class prop src std",
      ),

      getCfihosWorksheetRows(
        "property picklist values",
      ),

      cfihosRepository.getTagClasses(),

      cfihosEquipmentRepository.getEquipmentClasses(),
    ]);

    const classIndexes =
      buildClassResolutionIndexes(
        tagClasses,
        equipmentClasses,
      );

    const standards =
      this.buildSourceStandards(
        sourceStandardRows,
      );

    const standardsById =
      new Map<
        string,
        CfihosSourceStandard
      >();

    for (const standard of standards) {
      standardsById.set(
        standard.id,
        standard,
      );
    }

    const classRelationships =
      this.buildClassRelationships(
        classStandardRows,
        classIndexes,
      );

    const propertyRelationships =
      this.buildPropertyRelationships(
        propertyStandardRows,
        classIndexes,
      );

    const picklistValues =
      this.buildPicklistValues(
        picklistRows,
      );

    const classRelationshipsByStandardId =
      buildIndex(
        classRelationships,
        (relationship) =>
          relationship.sourceStandardId,
      );

    /*
     * Preserve lookup by the raw relationship ID.
     *
     * We also add resolved Tag/Equipment IDs below,
     * allowing callers to query using whichever
     * identifier is used by the browser page.
     */
    const classRelationshipsByClassId =
      new Map<
        string,
        CfihosClassSourceStandard[]
      >();

    for (
      const relationship of
        classRelationships
    ) {
      addToIndex(
        classRelationshipsByClassId,
        relationship.classId,
        relationship,
      );

      if (
        relationship.tagClassId &&
        relationship.tagClassId !==
          relationship.classId
      ) {
        addToIndex(
          classRelationshipsByClassId,
          relationship.tagClassId,
          relationship,
        );
      }

      if (
        relationship.equipmentClassId &&
        relationship.equipmentClassId !==
          relationship.classId &&
        relationship.equipmentClassId !==
          relationship.tagClassId
      ) {
        addToIndex(
          classRelationshipsByClassId,
          relationship.equipmentClassId,
          relationship,
        );
      }
    }

    const propertyRelationshipsByStandardId =
      buildIndex(
        propertyRelationships,
        (relationship) =>
          relationship.sourceStandardId,
      );

    const propertyRelationshipsByClassId =
      new Map<
        string,
        CfihosClassPropertySourceStandard[]
      >();

    for (
      const relationship of
        propertyRelationships
    ) {
      addToIndex(
        propertyRelationshipsByClassId,
        relationship.classId,
        relationship,
      );

      if (
        relationship.tagClassId &&
        relationship.tagClassId !==
          relationship.classId
      ) {
        addToIndex(
          propertyRelationshipsByClassId,
          relationship.tagClassId,
          relationship,
        );
      }

      if (
        relationship.equipmentClassId &&
        relationship.equipmentClassId !==
          relationship.classId &&
        relationship.equipmentClassId !==
          relationship.tagClassId
      ) {
        addToIndex(
          propertyRelationshipsByClassId,
          relationship.equipmentClassId,
          relationship,
        );
      }
    }

    const propertyRelationshipsByPropertyId =
      buildIndex(
        propertyRelationships,
        (relationship) =>
          relationship.propertyId,
      );

    const picklistValuesByStandardId =
      buildIndex(
        picklistValues,
        (value) =>
          value.sourceStandardId,
      );

    sortIndexes(
      classRelationshipsByStandardId,
      compareClassRelationships,
    );

    sortIndexes(
      classRelationshipsByClassId,
      compareClassRelationships,
    );

    sortIndexes(
      propertyRelationshipsByStandardId,
      comparePropertyRelationships,
    );

    sortIndexes(
      propertyRelationshipsByClassId,
      comparePropertyRelationships,
    );

    sortIndexes(
      propertyRelationshipsByPropertyId,
      comparePropertyRelationships,
    );

    sortIndexes(
      picklistValuesByStandardId,
      comparePicklistValues,
    );

    const diagnostics =
      this.buildDiagnostics(
        standards,
        standardsById,
        classRelationships,
        propertyRelationships,
        picklistValues,
        classRelationshipsByStandardId,
        propertyRelationshipsByStandardId,
        picklistValuesByStandardId,
      );

    return {
      standards,
      standardsById,

      classRelationships,

      classRelationshipsByStandardId,
      classRelationshipsByClassId,

      propertyRelationships,

      propertyRelationshipsByStandardId,
      propertyRelationshipsByClassId,
      propertyRelationshipsByPropertyId,

      picklistValues,

      picklistValuesByStandardId,

      diagnostics,
    };
  }

  private buildSourceStandards(
    rows: CfihosWorksheetRow[],
  ): CfihosSourceStandard[] {
    return rows
      .map(
        (
          row,
        ): CfihosSourceStandard => ({
          id: normalizeRequiredString(
            row["CFIHOS unique code"],
          ),

          code: normalizeRequiredString(
            row[
              "source standard code"
            ],
          ),

          description:
            normalizeOptionalString(
              row[
                "source standard description"
              ],
            ),

          stillToBeCompleted:
            normalizeBoolean(
              row[
                "source standard still to be completed indicator"
              ],
            ),
        }),
      )
      .filter(
        (standard) =>
          standard.id.length > 0 &&
          standard.code.length > 0,
      )
      .sort(compareStandards);
  }

  private buildClassRelationships(
    rows: CfihosWorksheetRow[],

    classIndexes:
      ClassResolutionIndexes,
  ): CfihosClassSourceStandard[] {
    return rows
      .map(
        (
          row,
        ): CfihosClassSourceStandard => {
          const classId =
            normalizeRequiredString(
              row[
                "tag or equipment class CFIHOS unique code"
              ],
            );

          const className =
            normalizeRequiredString(
              row[
                "tag or equipment class"
              ],
            );

          const resolution =
            resolveClassReference(
              classId,
              className,
              classIndexes,
            );

          return {
            ...resolution,

            sourceStandardId:
              normalizeRequiredString(
                row[
                  "source standard CFIHOS unique code"
                ],
              ),

            sourceStandardCode:
              normalizeRequiredString(
                row[
                  "source standard code"
                ],
              ),
          };
        },
      )
      .filter(
        (relationship) =>
          relationship.classId.length >
            0 &&
          relationship.sourceStandardId
            .length > 0,
      )
      .sort(compareClassRelationships);
  }

  private buildPropertyRelationships(
    rows: CfihosWorksheetRow[],

    classIndexes:
      ClassResolutionIndexes,
  ): CfihosClassPropertySourceStandard[] {
    return rows
      .map(
        (
          row,
        ): CfihosClassPropertySourceStandard => {
          const classId =
            normalizeRequiredString(
              row[
                "tag or equipment class CFIHOS unique code"
              ],
            );

          const className =
            normalizeRequiredString(
              row[
                "tag or equipment class name"
              ],
            );

          const resolution =
            resolveClassReference(
              classId,
              className,
              classIndexes,
            );

          return {
            ...resolution,

            id: normalizeRequiredString(
              row["CFIHOS unique code"],
            ),

            propertyId:
              normalizeRequiredString(
                row[
                  "property CFIHOS unique code"
                ],
              ),

            propertyName:
              normalizeRequiredString(
                row["property name"],
              ),

            sourceStandardId:
              normalizeRequiredString(
                row[
                  "source standard code CFIHOS unique code"
                ],
              ),

            sourceStandardCode:
              normalizeRequiredString(
                row[
                  "source standard code"
                ],
              ),

            sourceStandardSection:
              normalizeOptionalString(
                row[
                  "source standard section"
                ],
              ),

            propertyNameInSourceStandard:
              normalizeOptionalString(
                row[
                  "property name in source standard"
                ],
              ),

            propertySequenceNumber:
              normalizeOptionalString(
                row[
                  "property sequence number"
                ],
              ),
          };
        },
      )
      .filter(
        (relationship) =>
          relationship.id.length > 0 &&
          relationship.classId.length >
            0 &&
          relationship.propertyId.length >
            0 &&
          relationship.sourceStandardId
            .length > 0,
      )
      .sort(comparePropertyRelationships);
  }

  private buildPicklistValues(
    rows: CfihosWorksheetRow[],
  ): CfihosSourceStandardPicklistValue[] {
    return rows
      .map(
        (
          row,
        ):
          | CfihosSourceStandardPicklistValue
          | null => {
          const sourceStandardId =
            normalizeOptionalString(
              row[
                "Source standard CFIHOS unique code"
              ],
            );

          if (!sourceStandardId) {
            return null;
          }

          return {
            picklistId:
              normalizeRequiredString(
                row[
                  "property picklist CFIHOS unique code"
                ],
              ),

            picklistName:
              normalizeRequiredString(
                row[
                  "property picklist name"
                ],
              ),

            valueId:
              normalizeRequiredString(
                row[
                  "property picklist value CFIHOS unique code"
                ],
              ),

            valueCode:
              normalizeRequiredString(
                row[
                  "property picklist value code"
                ],
              ),

            valueDescription:
              normalizeOptionalString(
                row[
                  "property picklist value description"
                ],
              ),

            sourceStandardId,

            sourceStandardCode:
              normalizeRequiredString(
                row[
                  "source standard code"
                ],
              ),
          };
        },
      )
      .filter(
        (
          value,
        ): value is CfihosSourceStandardPicklistValue =>
          value !== null &&
          value.valueId.length > 0,
      )
      .sort(comparePicklistValues);
  }

  private buildDiagnostics(
    standards: CfihosSourceStandard[],

    standardsById: Map<
      string,
      CfihosSourceStandard
    >,

    classRelationships:
      CfihosClassSourceStandard[],

    propertyRelationships:
      CfihosClassPropertySourceStandard[],

    picklistValues:
      CfihosSourceStandardPicklistValue[],

    classRelationshipsByStandardId: Map<
      string,
      CfihosClassSourceStandard[]
    >,

    propertyRelationshipsByStandardId: Map<
      string,
      CfihosClassPropertySourceStandard[]
    >,

    picklistValuesByStandardId: Map<
      string,
      CfihosSourceStandardPicklistValue[]
    >,
  ): CfihosSourceStandardDiagnostics {
    const tagClassRelationshipCount =
      classRelationships.filter(
        (relationship) =>
          relationship.tagClassId !==
          null,
      ).length;

    const equipmentClassRelationshipCount =
      classRelationships.filter(
        (relationship) =>
          relationship
            .equipmentClassId !== null,
      ).length;

    const unknownClassRelationshipCount =
      classRelationships.filter(
        (relationship) =>
          relationship.tagClassId ===
            null &&
          relationship
            .equipmentClassId === null,
      ).length;

    const dualClassRelationshipCount =
      classRelationships.filter(
        (relationship) =>
          relationship.tagClassId !==
            null &&
          relationship
            .equipmentClassId !== null,
      ).length;

    const tagClassPropertyRelationshipCount =
      propertyRelationships.filter(
        (relationship) =>
          relationship.tagClassId !==
          null,
      ).length;

    const equipmentClassPropertyRelationshipCount =
      propertyRelationships.filter(
        (relationship) =>
          relationship
            .equipmentClassId !== null,
      ).length;

    const unknownClassPropertyRelationshipCount =
      propertyRelationships.filter(
        (relationship) =>
          relationship.tagClassId ===
            null &&
          relationship
            .equipmentClassId === null,
      ).length;

    const dualClassPropertyRelationshipCount =
      propertyRelationships.filter(
        (relationship) =>
          relationship.tagClassId !==
            null &&
          relationship
            .equipmentClassId !== null,
      ).length;

    const classRelationshipsMatchedByNameCount =
      classRelationships.filter(
        (relationship) =>
          relationship.tagMatchMethod ===
            "name" ||
          relationship
            .equipmentMatchMethod ===
            "name",
      ).length;

    const propertyRelationshipsMatchedByNameCount =
      propertyRelationships.filter(
        (relationship) =>
          relationship.tagMatchMethod ===
            "name" ||
          relationship
            .equipmentMatchMethod ===
            "name",
      ).length;

    const unresolvedStandardClassRelationshipCount =
      classRelationships.filter(
        (relationship) =>
          !standardsById.has(
            relationship.sourceStandardId,
          ),
      ).length;

    const unresolvedStandardPropertyRelationshipCount =
      propertyRelationships.filter(
        (relationship) =>
          !standardsById.has(
            relationship.sourceStandardId,
          ),
      ).length;

    const unresolvedStandardPicklistReferenceCount =
      picklistValues.filter(
        (value) =>
          !standardsById.has(
            value.sourceStandardId,
          ),
      ).length;

    const standardsWithoutUsageCount =
      standards.filter((standard) => {
        const classUsage =
          classRelationshipsByStandardId.get(
            standard.id,
          ) ?? [];

        const propertyUsage =
          propertyRelationshipsByStandardId.get(
            standard.id,
          ) ?? [];

        const picklistUsage =
          picklistValuesByStandardId.get(
            standard.id,
          ) ?? [];

        return (
          classUsage.length === 0 &&
          propertyUsage.length === 0 &&
          picklistUsage.length === 0
        );
      }).length;

    return {
      sourceStandardCount:
        standards.length,

      classRelationshipCount:
        classRelationships.length,

      propertyRelationshipCount:
        propertyRelationships.length,

      picklistValueReferenceCount:
        picklistValues.length,

      tagClassRelationshipCount,

      equipmentClassRelationshipCount,

      unknownClassRelationshipCount,

      tagClassPropertyRelationshipCount,

      equipmentClassPropertyRelationshipCount,

      unknownClassPropertyRelationshipCount,

      unresolvedStandardClassRelationshipCount,

      unresolvedStandardPropertyRelationshipCount,

      unresolvedStandardPicklistReferenceCount,

      standardsWithoutUsageCount,

      dualClassRelationshipCount,

      dualClassPropertyRelationshipCount,

      classRelationshipsMatchedByNameCount,

      propertyRelationshipsMatchedByNameCount,
    };
  }
}

function buildClassResolutionIndexes(
  tagClasses: CfihosTagClass[],

  equipmentClasses:
    CfihosEquipmentClass[],
): ClassResolutionIndexes {
  const tagClassesById =
    new Map<
      string,
      CfihosTagClass
    >();

  const equipmentClassesById =
    new Map<
      string,
      CfihosEquipmentClass
    >();

  const tagClassesByName =
    new Map<
      string,
      CfihosTagClass[]
    >();

  const equipmentClassesByName =
    new Map<
      string,
      CfihosEquipmentClass[]
    >();

  for (const tagClass of tagClasses) {
    tagClassesById.set(
      tagClass.id,
      tagClass,
    );

    addToIndex(
      tagClassesByName,
      normalizeClassName(
        tagClass.name,
      ),
      tagClass,
    );
  }

  for (
    const equipmentClass of
      equipmentClasses
  ) {
    equipmentClassesById.set(
      equipmentClass.id,
      equipmentClass,
    );

    addToIndex(
      equipmentClassesByName,
      normalizeClassName(
        equipmentClass.name,
      ),
      equipmentClass,
    );
  }

  return {
    tagClassesById,
    equipmentClassesById,
    tagClassesByName,
    equipmentClassesByName,
  };
}

function resolveClassReference(
  classId: string,
  className: string,

  indexes:
    ClassResolutionIndexes,
): CfihosResolvedClassReference {
  const tagIdMatch =
    indexes.tagClassesById.get(
      classId,
    );

  const equipmentIdMatch =
    indexes.equipmentClassesById.get(
      classId,
    );

  let tagClassId:
    | string
    | null =
    tagIdMatch?.id ?? null;

  let equipmentClassId:
    | string
    | null =
    equipmentIdMatch?.id ?? null;

  let tagMatchMethod:
    CfihosClassMatchMethod =
    tagIdMatch ? "id" : null;

  let equipmentMatchMethod:
    CfihosClassMatchMethod =
    equipmentIdMatch ? "id" : null;

  /*
   * The old CFIHOS browser correctly treated
   * the relationship's class name as useful
   * navigation information.
   *
   * We therefore use normalized-name matching
   * as the fallback when the raw relationship
   * ID does not match the class master data.
   */
  const normalizedName =
    normalizeClassName(className);

  if (
    !tagClassId &&
    normalizedName
  ) {
    const candidates =
      indexes.tagClassesByName.get(
        normalizedName,
      ) ?? [];

    /*
     * Only accept an unambiguous name match.
     */
    if (candidates.length === 1) {
      tagClassId =
        candidates[0].id;

      tagMatchMethod = "name";
    }
  }

  if (
    !equipmentClassId &&
    normalizedName
  ) {
    const candidates =
      indexes.equipmentClassesByName.get(
        normalizedName,
      ) ?? [];

    /*
     * Again, avoid silently choosing one
     * record if duplicate names ever appear
     * in a future RDL.
     */
    if (candidates.length === 1) {
      equipmentClassId =
        candidates[0].id;

      equipmentMatchMethod =
        "name";
    }
  }

  return {
    classId,
    className,

    classDomain:
      determineClassDomain(
        tagClassId,
        equipmentClassId,
      ),

    tagClassId,
    equipmentClassId,

    tagMatchMethod,
    equipmentMatchMethod,
  };
}

function determineClassDomain(
  tagClassId: string | null,

  equipmentClassId:
    | string
    | null,
): CfihosClassDomain {
  if (
    tagClassId &&
    equipmentClassId
  ) {
    return "tag-and-equipment";
  }

  if (tagClassId) {
    return "tag";
  }

  if (equipmentClassId) {
    return "equipment";
  }

  return "unknown";
}

function normalizeClassName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function addToIndex<T>(
  index: Map<string, T[]>,

  key: string,

  value: T,
): void {
  if (!key) {
    return;
  }

  const existing =
    index.get(key) ?? [];

  /*
   * Avoid duplicate insertion where the
   * raw and resolved IDs happen to be
   * identical or a caller indexes the same
   * relationship through multiple paths.
   */
  if (!existing.includes(value)) {
    existing.push(value);
  }

  index.set(
    key,
    existing,
  );
}

function buildIndex<T>(
  values: T[],

  keySelector: (
    value: T,
  ) => string,
): Map<string, T[]> {
  const index =
    new Map<string, T[]>();

  for (const value of values) {
    const key =
      keySelector(value);

    addToIndex(
      index,
      key,
      value,
    );
  }

  return index;
}

function sortIndexes<T>(
  index: Map<string, T[]>,

  comparator: (
    a: T,
    b: T,
  ) => number,
): void {
  for (const values of index.values()) {
    values.sort(comparator);
  }
}

function normalizeSearchQuery(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function compareStandards(
  a: CfihosSourceStandard,
  b: CfihosSourceStandard,
): number {
  return a.code.localeCompare(
    b.code,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function compareClassRelationships(
  a: CfihosClassSourceStandard,
  b: CfihosClassSourceStandard,
): number {
  const nameComparison =
    a.className.localeCompare(
      b.className,
      undefined,
      {
        sensitivity: "base",
      },
    );

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return a.sourceStandardCode.localeCompare(
    b.sourceStandardCode,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function comparePropertyRelationships(
  a: CfihosClassPropertySourceStandard,
  b: CfihosClassPropertySourceStandard,
): number {
  const classComparison =
    a.className.localeCompare(
      b.className,
      undefined,
      {
        sensitivity: "base",
      },
    );

  if (classComparison !== 0) {
    return classComparison;
  }

  const propertyComparison =
    a.propertyName.localeCompare(
      b.propertyName,
      undefined,
      {
        sensitivity: "base",
      },
    );

  if (propertyComparison !== 0) {
    return propertyComparison;
  }

  const standardComparison =
    a.sourceStandardCode.localeCompare(
      b.sourceStandardCode,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );

  if (standardComparison !== 0) {
    return standardComparison;
  }

  return (
    a.sourceStandardSection ?? ""
  ).localeCompare(
    b.sourceStandardSection ?? "",
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function comparePicklistValues(
  a: CfihosSourceStandardPicklistValue,
  b: CfihosSourceStandardPicklistValue,
): number {
  const picklistComparison =
    a.picklistName.localeCompare(
      b.picklistName,
      undefined,
      {
        sensitivity: "base",
      },
    );

  if (picklistComparison !== 0) {
    return picklistComparison;
  }

  return a.valueCode.localeCompare(
    b.valueCode,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

export const cfihosSourceStandardRepository =
  new CfihosSourceStandardRepository();