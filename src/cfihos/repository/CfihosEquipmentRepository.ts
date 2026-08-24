import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";

import {
  normalizeBoolean,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeSynonyms,
} from "../model/common";

import type {
  CfihosEffectiveEquipmentClassProperty,
  CfihosEquipmentClass,
  CfihosEquipmentClassProperty,
  CfihosEquipmentClassTreeNode,
  CfihosResolvedEquipmentClassProperty,
} from "../model/equipmentClass";

import type {
  CfihosProperty,
  CfihosPropertyPicklistValue,
} from "../model/property";

export type CfihosEquipmentHierarchyIssueType =
  | "unresolved-parent"
  | "ambiguous-parent"
  | "self-parent"
  | "cycle";

export type CfihosEquipmentHierarchyIssue = {
  type: CfihosEquipmentHierarchyIssueType;

  equipmentClassId: string;
  equipmentClassName: string;

  parentName: string | null;

  candidateParentIds: string[];

  message: string;
};

export type CfihosEquipmentHierarchyDiagnostics = {
  equipmentClassCount: number;
  rootCount: number;

  resolvedParentCount: number;
  unresolvedParentCount: number;
  ambiguousParentCount: number;
  selfParentCount: number;
  cycleCount: number;

  duplicateNameCount: number;

  issues: CfihosEquipmentHierarchyIssue[];
};

export type CfihosEquipmentInheritanceSourceSummary = {
  equipmentClassId: string;
  equipmentClassName: string;
  propertyCount: number;
};

export type CfihosEquipmentInheritanceExample = {
  equipmentClassId: string;
  equipmentClassName: string;

  directPropertyCount: number;
  inheritedPropertyCount: number;
  effectivePropertyCount: number;

  inheritedFrom: CfihosEquipmentInheritanceSourceSummary[];
};

type ParentResolutionResult = {
  issues: CfihosEquipmentHierarchyIssue[];
  duplicateNameCount: number;
};

type EquipmentRepositoryState = {
  equipmentClasses: CfihosEquipmentClass[];

  equipmentClassesById: Map<
    string,
    CfihosEquipmentClass
  >;

  equipmentClassChildrenByParentId: Map<
    string,
    CfihosEquipmentClass[]
  >;

  hierarchyDiagnostics:
    CfihosEquipmentHierarchyDiagnostics;

  properties: CfihosProperty[];

  propertiesById: Map<
    string,
    CfihosProperty
  >;

  equipmentClassProperties:
    CfihosEquipmentClassProperty[];

  equipmentClassPropertiesByClassId: Map<
    string,
    CfihosEquipmentClassProperty[]
  >;

  picklistValues:
    CfihosPropertyPicklistValue[];

  picklistValuesByPicklistId: Map<
    string,
    CfihosPropertyPicklistValue[]
  >;
};

export class CfihosEquipmentRepository {
  private state: EquipmentRepositoryState | null =
    null;

  private loadingPromise:
    | Promise<EquipmentRepositoryState>
    | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getEquipmentClasses(): Promise<
    CfihosEquipmentClass[]
  > {
    const state = await this.getState();

    return state.equipmentClasses;
  }

  async getEquipmentClass(
    id: string,
  ): Promise<CfihosEquipmentClass | null> {
    const state = await this.getState();

    return (
      state.equipmentClassesById.get(id) ??
      null
    );
  }

  async getRootEquipmentClasses(): Promise<
    CfihosEquipmentClass[]
  > {
    const state = await this.getState();

    return state.equipmentClasses.filter(
      (equipmentClass) =>
        equipmentClass.parentId === null,
    );
  }

  async getEquipmentClassChildren(
    equipmentClassId: string,
  ): Promise<CfihosEquipmentClass[]> {
    const state = await this.getState();

    return (
      state.equipmentClassChildrenByParentId.get(
        equipmentClassId,
      ) ?? []
    );
  }

  async getEquipmentClassAncestors(
    equipmentClassId: string,
  ): Promise<CfihosEquipmentClass[]> {
    const state = await this.getState();

    return this.buildAncestorList(
      equipmentClassId,
      state,
    );
  }

  async getEquipmentClassPath(
    equipmentClassId: string,
  ): Promise<CfihosEquipmentClass[]> {
    const state = await this.getState();

    const equipmentClass =
      state.equipmentClassesById.get(
        equipmentClassId,
      );

    if (!equipmentClass) {
      return [];
    }

    const ancestors =
      this.buildAncestorList(
        equipmentClassId,
        state,
      );

    return [...ancestors]
      .reverse()
      .concat(equipmentClass);
  }

  async getEquipmentClassTree(): Promise<
    CfihosEquipmentClassTreeNode[]
  > {
    const state = await this.getState();

    const buildNode = (
      equipmentClass: CfihosEquipmentClass,
      visited: Set<string>,
    ): CfihosEquipmentClassTreeNode => {
      if (
        visited.has(equipmentClass.id)
      ) {
        return {
          ...equipmentClass,
          children: [],
        };
      }

      const nextVisited =
        new Set(visited);

      nextVisited.add(
        equipmentClass.id,
      );

      const children =
        state.equipmentClassChildrenByParentId.get(
          equipmentClass.id,
        ) ?? [];

      return {
        ...equipmentClass,

        children: children.map(
          (child) =>
            buildNode(
              child,
              nextVisited,
            ),
        ),
      };
    };

    const roots =
      state.equipmentClasses.filter(
        (equipmentClass) =>
          equipmentClass.parentId === null,
      );

    return roots
      .sort(compareEquipmentClasses)
      .map((root) =>
        buildNode(
          root,
          new Set(),
        ),
      );
  }

  async getHierarchyDiagnostics(): Promise<
    CfihosEquipmentHierarchyDiagnostics
  > {
    const state = await this.getState();

    return state.hierarchyDiagnostics;
  }

  /**
   * Returns only properties explicitly assigned
   * to this Equipment Class.
   */
  async getEquipmentClassProperties(
    equipmentClassId: string,
  ): Promise<
    CfihosResolvedEquipmentClassProperty[]
  > {
    const state = await this.getState();

    return this.resolvePropertiesForClass(
      equipmentClassId,
      state,
    );
  }

  /**
   * Returns direct + inherited properties.
   *
   * A property assigned closer to the selected
   * Equipment Class overrides the same property
   * inherited from a more distant ancestor.
   */
  async getEffectiveEquipmentClassProperties(
    equipmentClassId: string,
  ): Promise<
    CfihosEffectiveEquipmentClassProperty[]
  > {
    const state = await this.getState();

    return this.resolveEffectivePropertiesForClass(
      equipmentClassId,
      state,
    );
  }

  async searchEquipmentClasses(
    query: string,
  ): Promise<CfihosEquipmentClass[]> {
    const state = await this.getState();

    const normalizedQuery =
      query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [
        ...state.equipmentClasses,
      ].sort(compareEquipmentClasses);
    }

    return state.equipmentClasses
      .filter((equipmentClass) => {
        const searchableValues = [
          equipmentClass.id,
          equipmentClass.name,
          equipmentClass.definition,
          equipmentClass.parentName,
          equipmentClass.existenceReason,
          ...equipmentClass.synonyms,
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
      .sort(compareEquipmentClasses);
  }

  /**
   * Diagnostic helper used before enabling
   * inheritance in the production UI.
   */
  async findEquipmentClassWithMixedPropertyInheritance(): Promise<
    CfihosEquipmentInheritanceExample | null
  > {
    const state = await this.getState();

    const classes = [
      ...state.equipmentClasses,
    ].sort(compareEquipmentClasses);

    for (
      const equipmentClass of classes
    ) {
      const effective =
        this.resolveEffectivePropertiesForClass(
          equipmentClass.id,
          state,
        );

      const direct =
        effective.filter(
          (item) =>
            item.assignmentType ===
            "direct",
        );

      const inherited =
        effective.filter(
          (item) =>
            item.assignmentType ===
            "inherited",
        );

      if (
        direct.length === 0 ||
        inherited.length === 0
      ) {
        continue;
      }

      const sourceCounts =
        new Map<
          string,
          CfihosEquipmentInheritanceSourceSummary
        >();

      for (
        const property of inherited
      ) {
        const existing =
          sourceCounts.get(
            property.sourceEquipmentClassId,
          );

        if (existing) {
          existing.propertyCount += 1;

          continue;
        }

        sourceCounts.set(
          property.sourceEquipmentClassId,
          {
            equipmentClassId:
              property.sourceEquipmentClassId,

            equipmentClassName:
              property.sourceEquipmentClassName,

            propertyCount: 1,
          },
        );
      }

      const inheritedFrom =
        Array.from(
          sourceCounts.values(),
        ).sort((a, b) => {
          if (
            b.propertyCount !==
            a.propertyCount
          ) {
            return (
              b.propertyCount -
              a.propertyCount
            );
          }

          return a.equipmentClassName.localeCompare(
            b.equipmentClassName,
            undefined,
            {
              sensitivity: "base",
            },
          );
        });

      return {
        equipmentClassId:
          equipmentClass.id,

        equipmentClassName:
          equipmentClass.name,

        directPropertyCount:
          direct.length,

        inheritedPropertyCount:
          inherited.length,

        effectivePropertyCount:
          effective.length,

        inheritedFrom,
      };
    }

    return null;
  }

  private async getState(): Promise<
    EquipmentRepositoryState
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
    EquipmentRepositoryState
  > {
    const [
      equipmentClassRows,
      equipmentClassPropertyRows,
      propertyRows,
      picklistRows,
    ] = await Promise.all([
      getCfihosWorksheetRows(
        "equipment class",
      ),

      getCfihosWorksheetRows(
        "equipment class property",
      ),

      getCfihosWorksheetRows(
        "property",
      ),

      getCfihosWorksheetRows(
        "property picklist values",
      ),
    ]);

    const equipmentClasses =
      this.buildEquipmentClasses(
        equipmentClassRows,
      );

    const equipmentClassesById =
      new Map<
        string,
        CfihosEquipmentClass
      >();

    for (
      const equipmentClass of
        equipmentClasses
    ) {
      equipmentClassesById.set(
        equipmentClass.id,
        equipmentClass,
      );
    }

    const parentResolution =
      this.resolveParents(
        equipmentClasses,
      );

    const cycleIssues =
      this.detectHierarchyCycles(
        equipmentClasses,
        equipmentClassesById,
      );

    const hierarchyIssues = [
      ...parentResolution.issues,
      ...cycleIssues,
    ];

    const equipmentClassChildrenByParentId =
      this.buildChildrenIndex(
        equipmentClasses,
      );

    const hierarchyDiagnostics =
      this.buildHierarchyDiagnostics(
        equipmentClasses,
        hierarchyIssues,
        parentResolution.duplicateNameCount,
      );

    const properties =
      this.buildProperties(
        propertyRows,
      );

    const propertiesById =
      new Map<
        string,
        CfihosProperty
      >();

    for (
      const property of properties
    ) {
      propertiesById.set(
        property.id,
        property,
      );
    }

    const equipmentClassProperties =
      this.buildEquipmentClassProperties(
        equipmentClassPropertyRows,
      );

    const equipmentClassPropertiesByClassId =
      this.buildEquipmentPropertyIndex(
        equipmentClassProperties,
      );

    const picklistValues =
      this.buildPicklistValues(
        picklistRows,
      );

    const picklistValuesByPicklistId =
      this.buildPicklistValueIndex(
        picklistValues,
      );

    return {
      equipmentClasses,
      equipmentClassesById,

      equipmentClassChildrenByParentId,

      hierarchyDiagnostics,

      properties,
      propertiesById,

      equipmentClassProperties,
      equipmentClassPropertiesByClassId,

      picklistValues,
      picklistValuesByPicklistId,
    };
  }

  private buildEquipmentClasses(
    rows: CfihosWorksheetRow[],
  ): CfihosEquipmentClass[] {
    return rows
      .map(
        (
          row,
        ): CfihosEquipmentClass => ({
          id: normalizeRequiredString(
            row[
              "equipment class CFIHOS unique code"
            ],
          ),

          name: normalizeRequiredString(
            row[
              "equipment class name"
            ],
          ),

          definition:
            normalizeOptionalString(
              row[
                "equipment class definition"
              ],
            ),

          parentName:
            normalizeOptionalString(
              row[
                "parent equipment class name"
              ],
            ),

          parentId: null,

          abstract: normalizeBoolean(
            row[
              "abstract class indicator"
            ],
          ),

          sparePartInformationRequired:
            normalizeBoolean(
              row[
                "spare part information required indicator"
              ],
            ),

          existenceReason:
            normalizeOptionalString(
              row[
                "equipment class existence reason description"
              ],
            ),

          synonyms:
            normalizeSynonyms(
              row[
                "equipment class synonym name"
              ],
            ),
        }),
      )
      .filter(
        (equipmentClass) =>
          equipmentClass.id.length > 0 &&
          equipmentClass.name.length > 0,
      );
  }

  private resolveParents(
    equipmentClasses:
      CfihosEquipmentClass[],
  ): ParentResolutionResult {
    const classesByNormalizedName =
      new Map<
        string,
        CfihosEquipmentClass[]
      >();

    const issues:
      CfihosEquipmentHierarchyIssue[] =
      [];

    for (
      const equipmentClass of
        equipmentClasses
    ) {
      const normalizedName =
        normalizeName(
          equipmentClass.name,
        );

      const existing =
        classesByNormalizedName.get(
          normalizedName,
        ) ?? [];

      existing.push(
        equipmentClass,
      );

      classesByNormalizedName.set(
        normalizedName,
        existing,
      );
    }

    const duplicateNameCount =
      Array.from(
        classesByNormalizedName.values(),
      ).filter(
        (classes) =>
          classes.length > 1,
      ).length;

    for (
      const equipmentClass of
        equipmentClasses
    ) {
      if (
        !equipmentClass.parentName
      ) {
        continue;
      }

      const candidates =
        classesByNormalizedName.get(
          normalizeName(
            equipmentClass.parentName,
          ),
        ) ?? [];

      if (
        candidates.length === 0
      ) {
        issues.push({
          type: "unresolved-parent",

          equipmentClassId:
            equipmentClass.id,

          equipmentClassName:
            equipmentClass.name,

          parentName:
            equipmentClass.parentName,

          candidateParentIds: [],

          message:
            `Parent "${equipmentClass.parentName}" could not be resolved ` +
            `for Equipment Class "${equipmentClass.name}".`,
        });

        continue;
      }

      if (
        candidates.length > 1
      ) {
        issues.push({
          type: "ambiguous-parent",

          equipmentClassId:
            equipmentClass.id,

          equipmentClassName:
            equipmentClass.name,

          parentName:
            equipmentClass.parentName,

          candidateParentIds:
            candidates.map(
              (candidate) =>
                candidate.id,
            ),

          message:
            `Parent "${equipmentClass.parentName}" is ambiguous for ` +
            `Equipment Class "${equipmentClass.name}".`,
        });

        continue;
      }

      const parent =
        candidates[0];

      if (
        parent.id ===
        equipmentClass.id
      ) {
        issues.push({
          type: "self-parent",

          equipmentClassId:
            equipmentClass.id,

          equipmentClassName:
            equipmentClass.name,

          parentName:
            equipmentClass.parentName,

          candidateParentIds: [
            parent.id,
          ],

          message:
            `Equipment Class "${equipmentClass.name}" resolves to itself as its parent.`,
        });

        continue;
      }

      equipmentClass.parentId =
        parent.id;
    }

    return {
      issues,
      duplicateNameCount,
    };
  }

  private detectHierarchyCycles(
    equipmentClasses:
      CfihosEquipmentClass[],

    equipmentClassesById: Map<
      string,
      CfihosEquipmentClass
    >,
  ): CfihosEquipmentHierarchyIssue[] {
    const issues:
      CfihosEquipmentHierarchyIssue[] =
      [];

    const cycleSignatures =
      new Set<string>();

    for (
      const equipmentClass of
        equipmentClasses
    ) {
      const visited =
        new Map<
          string,
          number
        >();

      const path: string[] = [];

      let current:
        | CfihosEquipmentClass
        | undefined =
        equipmentClass;

      while (current) {
        if (
          visited.has(
            current.id,
          )
        ) {
          const cycleStart =
            visited.get(
              current.id,
            ) ?? 0;

          const cycleIds =
            path.slice(
              cycleStart,
            );

          const signature = [
            ...cycleIds,
          ]
            .sort()
            .join("|");

          if (
            !cycleSignatures.has(
              signature,
            )
          ) {
            cycleSignatures.add(
              signature,
            );

            issues.push({
              type: "cycle",

              equipmentClassId:
                equipmentClass.id,

              equipmentClassName:
                equipmentClass.name,

              parentName:
                equipmentClass.parentName,

              candidateParentIds:
                cycleIds,

              message:
                `Hierarchy cycle detected involving: ` +
                `${cycleIds.join(", ")}.`,
            });
          }

          break;
        }

        visited.set(
          current.id,
          path.length,
        );

        path.push(
          current.id,
        );

        if (
          !current.parentId
        ) {
          break;
        }

        current =
          equipmentClassesById.get(
            current.parentId,
          );
      }
    }

    return issues;
  }

  private buildHierarchyDiagnostics(
    equipmentClasses:
      CfihosEquipmentClass[],

    issues:
      CfihosEquipmentHierarchyIssue[],

    duplicateNameCount: number,
  ): CfihosEquipmentHierarchyDiagnostics {
    const unresolvedParentCount =
      issues.filter(
        (issue) =>
          issue.type ===
          "unresolved-parent",
      ).length;

    const ambiguousParentCount =
      issues.filter(
        (issue) =>
          issue.type ===
          "ambiguous-parent",
      ).length;

    const selfParentCount =
      issues.filter(
        (issue) =>
          issue.type ===
          "self-parent",
      ).length;

    const cycleCount =
      issues.filter(
        (issue) =>
          issue.type ===
          "cycle",
      ).length;

    const rootCount =
      equipmentClasses.filter(
        (equipmentClass) =>
          equipmentClass.parentId ===
          null,
      ).length;

    const resolvedParentCount =
      equipmentClasses.filter(
        (equipmentClass) =>
          equipmentClass.parentId !==
          null,
      ).length;

    return {
      equipmentClassCount:
        equipmentClasses.length,

      rootCount,

      resolvedParentCount,
      unresolvedParentCount,
      ambiguousParentCount,
      selfParentCount,
      cycleCount,

      duplicateNameCount,

      issues,
    };
  }

  private buildChildrenIndex(
    equipmentClasses:
      CfihosEquipmentClass[],
  ): Map<
    string,
    CfihosEquipmentClass[]
  > {
    const index =
      new Map<
        string,
        CfihosEquipmentClass[]
      >();

    for (
      const equipmentClass of
        equipmentClasses
    ) {
      if (
        !equipmentClass.parentId
      ) {
        continue;
      }

      const children =
        index.get(
          equipmentClass.parentId,
        ) ?? [];

      children.push(
        equipmentClass,
      );

      index.set(
        equipmentClass.parentId,
        children,
      );
    }

    for (
      const children of
        index.values()
    ) {
      children.sort(
        compareEquipmentClasses,
      );
    }

    return index;
  }

  private buildAncestorList(
    equipmentClassId: string,
    state: EquipmentRepositoryState,
  ): CfihosEquipmentClass[] {
    const ancestors:
      CfihosEquipmentClass[] =
      [];

    const visited =
      new Set<string>();

    let current =
      state.equipmentClassesById.get(
        equipmentClassId,
      );

    while (
      current?.parentId
    ) {
      if (
        visited.has(
          current.id,
        )
      ) {
        break;
      }

      visited.add(
        current.id,
      );

      const parent =
        state.equipmentClassesById.get(
          current.parentId,
        );

      if (!parent) {
        break;
      }

      ancestors.push(
        parent,
      );

      current = parent;
    }

    return ancestors;
  }

  private buildProperties(
    rows: CfihosWorksheetRow[],
  ): CfihosProperty[] {
    return rows
      .map(
        (
          row,
        ): CfihosProperty => ({
          id: normalizeRequiredString(
            row["CFIHOS unique code"],
          ),

          name: normalizeRequiredString(
            row["property name"],
          ),

          definition:
            normalizeOptionalString(
              row[
                "property definition"
              ],
            ),

          dataType:
            normalizeOptionalString(
              row[
                "property data type"
              ],
            ),

          dataTypeLength:
            normalizeOptionalString(
              row[
                "property data type length"
              ],
            ),

          unitOfMeasureDimensionId:
            normalizeOptionalString(
              row[
                "unit of measure dimension code CFIHOS unique code"
              ],
            ),

          unitOfMeasureDimensionCode:
            normalizeOptionalString(
              row[
                "unit of measure dimension code"
              ],
            ),

          picklistId:
            normalizeOptionalString(
              row[
                "property picklist name CFIHOS unique code"
              ],
            ),

          picklistName:
            normalizeOptionalString(
              row[
                "property picklist name"
              ],
            ),

          existenceReason:
            normalizeOptionalString(
              row[
                "property existence reason description"
              ],
            ),

          synonyms:
            normalizeSynonyms(
              row[
                "property synonym name"
              ],
            ),
        }),
      )
      .filter(
        (property) =>
          property.id.length > 0 &&
          property.name.length > 0,
      );
  }

  private buildEquipmentClassProperties(
    rows: CfihosWorksheetRow[],
  ): CfihosEquipmentClassProperty[] {
    return rows
      .map(
        (
          row,
        ): CfihosEquipmentClassProperty => ({
          equipmentClassId:
            normalizeRequiredString(
              row[
                "equipment class CFIHOS unique code"
              ],
            ),

          equipmentClassName:
            normalizeRequiredString(
              row[
                "equipment class name"
              ],
            ),

          propertyId:
            normalizeRequiredString(
              row[
                "property CFIHOS unique code"
              ],
            ),

          propertyName:
            normalizeRequiredString(
              row[
                "property name"
              ],
            ),

          relevantForEquipment:
            normalizeBoolean(
              row[
                "property relevant for equipment indicator"
              ],
            ),

          relevantForModelOrPart:
            normalizeBoolean(
              row[
                "property relevant for model / part indicator"
              ],
            ),

          siUnit: {
            id: normalizeOptionalString(
              row[
                "SI unit of measure CFIHOS unique code"
              ],
            ),

            name: normalizeOptionalString(
              row[
                "SI unit of measure name"
              ],
            ),
          },

          imperialUnit: {
            id: normalizeOptionalString(
              row[
                "imperial unit of measure CFIHOS unique code"
              ],
            ),

            name: normalizeOptionalString(
              row[
                "imperial unit of measure name"
              ],
            ),
          },
        }),
      )
      .filter(
        (relationship) =>
          relationship
            .equipmentClassId.length >
            0 &&
          relationship
            .propertyId.length >
            0,
      );
  }

  private buildEquipmentPropertyIndex(
    relationships:
      CfihosEquipmentClassProperty[],
  ): Map<
    string,
    CfihosEquipmentClassProperty[]
  > {
    const index =
      new Map<
        string,
        CfihosEquipmentClassProperty[]
      >();

    for (
      const relationship of
        relationships
    ) {
      const existing =
        index.get(
          relationship.equipmentClassId,
        ) ?? [];

      existing.push(
        relationship,
      );

      index.set(
        relationship.equipmentClassId,
        existing,
      );
    }

    for (
      const classRelationships of
        index.values()
    ) {
      classRelationships.sort(
        (a, b) =>
          a.propertyName.localeCompare(
            b.propertyName,
            undefined,
            {
              sensitivity: "base",
            },
          ),
      );
    }

    return index;
  }

  private resolvePropertiesForClass(
    equipmentClassId: string,
    state: EquipmentRepositoryState,
  ): CfihosResolvedEquipmentClassProperty[] {
    const relationships =
      state.equipmentClassPropertiesByClassId.get(
        equipmentClassId,
      ) ?? [];

    const resolved:
      CfihosResolvedEquipmentClassProperty[] =
      [];

    for (
      const relationship of
        relationships
    ) {
      const property =
        state.propertiesById.get(
          relationship.propertyId,
        );

      if (!property) {
        continue;
      }

      const picklistValues =
        property.picklistId
          ? state.picklistValuesByPicklistId.get(
              property.picklistId,
            ) ?? []
          : [];

      resolved.push({
        relationship,
        property,
        picklistValues,
      });
    }

    return resolved.sort(
      compareResolvedProperties,
    );
  }

  private resolveEffectivePropertiesForClass(
    equipmentClassId: string,
    state: EquipmentRepositoryState,
  ): CfihosEffectiveEquipmentClassProperty[] {
    const selectedClass =
      state.equipmentClassesById.get(
        equipmentClassId,
      );

    if (!selectedClass) {
      return [];
    }

    const ancestry = [
      selectedClass,
      ...this.buildAncestorList(
        equipmentClassId,
        state,
      ),
    ];

    const effectiveByPropertyId =
      new Map<
        string,
        CfihosEffectiveEquipmentClassProperty
      >();

    ancestry.forEach(
      (
        sourceClass,
        inheritanceDepth,
      ) => {
        const resolvedProperties =
          this.resolvePropertiesForClass(
            sourceClass.id,
            state,
          );

        for (
          const resolvedProperty of
            resolvedProperties
        ) {
          /*
           * We walk from descendant toward
           * the root. Therefore the first
           * assignment encountered has the
           * highest precedence.
           */
          if (
            effectiveByPropertyId.has(
              resolvedProperty.property.id,
            )
          ) {
            continue;
          }

          effectiveByPropertyId.set(
            resolvedProperty.property.id,
            {
              ...resolvedProperty,

              assignmentType:
                inheritanceDepth === 0
                  ? "direct"
                  : "inherited",

              sourceEquipmentClassId:
                sourceClass.id,

              sourceEquipmentClassName:
                sourceClass.name,

              inheritanceDepth,
            },
          );
        }
      },
    );

    return Array.from(
      effectiveByPropertyId.values(),
    ).sort(
      compareResolvedProperties,
    );
  }

  private buildPicklistValues(
    rows: CfihosWorksheetRow[],
  ): CfihosPropertyPicklistValue[] {
    return rows
      .map(
        (
          row,
        ): CfihosPropertyPicklistValue => ({
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

          id: normalizeRequiredString(
            row[
              "property picklist value CFIHOS unique code"
            ],
          ),

          code: normalizeRequiredString(
            row[
              "property picklist value code"
            ],
          ),

          description:
            normalizeOptionalString(
              row[
                "property picklist value description"
              ],
            ),

          sourceStandardId:
            normalizeOptionalString(
              row[
                "Source standard CFIHOS unique code"
              ],
            ),

          sourceStandardCode:
            normalizeOptionalString(
              row[
                "source standard code"
              ],
            ),
        }),
      )
      .filter(
        (value) =>
          value.picklistId.length >
            0 &&
          value.id.length > 0,
      );
  }

  private buildPicklistValueIndex(
    values:
      CfihosPropertyPicklistValue[],
  ): Map<
    string,
    CfihosPropertyPicklistValue[]
  > {
    const index =
      new Map<
        string,
        CfihosPropertyPicklistValue[]
      >();

    for (
      const value of values
    ) {
      const existing =
        index.get(
          value.picklistId,
        ) ?? [];

      existing.push(
        value,
      );

      index.set(
        value.picklistId,
        existing,
      );
    }

    for (
      const picklistValues of
        index.values()
    ) {
      picklistValues.sort(
        (a, b) =>
          a.code.localeCompare(
            b.code,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            },
          ),
      );
    }

    return index;
  }
}

function normalizeName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function compareEquipmentClasses(
  a: CfihosEquipmentClass,
  b: CfihosEquipmentClass,
): number {
  return a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

function compareResolvedProperties(
  a: CfihosResolvedEquipmentClassProperty,
  b: CfihosResolvedEquipmentClassProperty,
): number {
  return a.property.name.localeCompare(
    b.property.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

export const cfihosEquipmentRepository =
  new CfihosEquipmentRepository();