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
  CfihosTagClass,
  CfihosTagClassTreeNode,
} from "../model/tagClass";

import type {
  CfihosEffectiveTagClassProperty,
  CfihosProperty,
  CfihosPropertyPicklistValue,
  CfihosResolvedTagClassProperty,
  CfihosTagClassProperty,
} from "../model/property";

export type CfihosHierarchyIssueType =
  | "unresolved-parent"
  | "ambiguous-parent"
  | "self-parent"
  | "cycle";

export type CfihosHierarchyIssue = {
  type: CfihosHierarchyIssueType;

  tagClassId: string;
  tagClassName: string;

  parentName: string | null;

  candidateParentIds: string[];

  message: string;
};

export type CfihosHierarchyDiagnostics = {
  tagClassCount: number;
  rootCount: number;

  resolvedParentCount: number;
  unresolvedParentCount: number;
  ambiguousParentCount: number;
  selfParentCount: number;
  cycleCount: number;

  duplicateNameCount: number;

  issues: CfihosHierarchyIssue[];
};

export type CfihosInheritanceSourceSummary = {
  tagClassId: string;
  tagClassName: string;
  propertyCount: number;
};

export type CfihosInheritanceExample = {
  tagClassId: string;
  tagClassName: string;

  directPropertyCount: number;
  inheritedPropertyCount: number;
  effectivePropertyCount: number;

  inheritedFrom: CfihosInheritanceSourceSummary[];
};

type ParentResolutionResult = {
  issues: CfihosHierarchyIssue[];
  duplicateNameCount: number;
};

type RepositoryState = {
  tagClasses: CfihosTagClass[];
  tagClassesById: Map<string, CfihosTagClass>;

  tagClassChildrenByParentId: Map<string, CfihosTagClass[]>;

  hierarchyDiagnostics: CfihosHierarchyDiagnostics;

  properties: CfihosProperty[];
  propertiesById: Map<string, CfihosProperty>;

  tagClassProperties: CfihosTagClassProperty[];
  tagClassPropertiesByTagClassId: Map<
    string,
    CfihosTagClassProperty[]
  >;

  picklistValues: CfihosPropertyPicklistValue[];
  picklistValuesByPicklistId: Map<
    string,
    CfihosPropertyPicklistValue[]
  >;
};

export class CfihosRepository {
  private state: RepositoryState | null = null;

  private loadingPromise: Promise<RepositoryState> | null =
    null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getTagClasses(): Promise<CfihosTagClass[]> {
    const state = await this.getState();

    return state.tagClasses;
  }

  async getTagClass(
    id: string,
  ): Promise<CfihosTagClass | null> {
    const state = await this.getState();

    return state.tagClassesById.get(id) ?? null;
  }

  async getRootTagClasses(): Promise<CfihosTagClass[]> {
    const state = await this.getState();

    return state.tagClasses.filter(
      (tagClass) => tagClass.parentId === null,
    );
  }

  async getTagClassChildren(
    tagClassId: string,
  ): Promise<CfihosTagClass[]> {
    const state = await this.getState();

    return (
      state.tagClassChildrenByParentId.get(tagClassId) ?? []
    );
  }

  async getTagClassAncestors(
    tagClassId: string,
  ): Promise<CfihosTagClass[]> {
    const state = await this.getState();

    return this.buildAncestorList(tagClassId, state);
  }

  async getTagClassPath(
    tagClassId: string,
  ): Promise<CfihosTagClass[]> {
    const state = await this.getState();

    const tagClass =
      state.tagClassesById.get(tagClassId);

    if (!tagClass) {
      return [];
    }

    const ancestors =
      this.buildAncestorList(tagClassId, state);

    return [...ancestors]
      .reverse()
      .concat(tagClass);
  }

  async getTagClassTree(): Promise<
    CfihosTagClassTreeNode[]
  > {
    const state = await this.getState();

    const buildNode = (
      tagClass: CfihosTagClass,
      visited: Set<string>,
    ): CfihosTagClassTreeNode => {
      if (visited.has(tagClass.id)) {
        return {
          ...tagClass,
          children: [],
        };
      }

      const nextVisited = new Set(visited);
      nextVisited.add(tagClass.id);

      const children =
        state.tagClassChildrenByParentId.get(
          tagClass.id,
        ) ?? [];

      return {
        ...tagClass,
        children: children.map((child) =>
          buildNode(child, nextVisited),
        ),
      };
    };

    const roots = state.tagClasses.filter(
      (tagClass) => tagClass.parentId === null,
    );

    return roots
      .sort(compareByName)
      .map((root) =>
        buildNode(root, new Set()),
      );
  }

  async getHierarchyDiagnostics(): Promise<CfihosHierarchyDiagnostics> {
    const state = await this.getState();

    return state.hierarchyDiagnostics;
  }

  async getProperties(): Promise<CfihosProperty[]> {
    const state = await this.getState();

    return state.properties;
  }

  async getProperty(
    id: string,
  ): Promise<CfihosProperty | null> {
    const state = await this.getState();

    return state.propertiesById.get(id) ?? null;
  }

  /**
   * Returns only the properties explicitly assigned
   * to this Tag Class.
   */
  async getTagClassProperties(
    tagClassId: string,
  ): Promise<CfihosResolvedTagClassProperty[]> {
    const state = await this.getState();

    return this.resolvePropertiesForClass(
      tagClassId,
      state,
    );
  }

  /**
   * Returns the effective property set for a Tag Class.
   *
   * Properties assigned directly to the selected
   * class take precedence over identical properties
   * inherited from its ancestors.
   */
  async getEffectiveTagClassProperties(
    tagClassId: string,
  ): Promise<CfihosEffectiveTagClassProperty[]> {
    const state = await this.getState();

    return this.resolveEffectivePropertiesForClass(
      tagClassId,
      state,
    );
  }

  /**
   * Diagnostic helper.
   *
   * Returns the first Tag Class in the official RDL
   * that has both direct and inherited effective
   * properties.
   */
  async findTagClassWithMixedPropertyInheritance(): Promise<
    CfihosInheritanceExample | null
  > {
    const state = await this.getState();

    const sortedTagClasses = [
      ...state.tagClasses,
    ].sort(compareByName);

    for (const tagClass of sortedTagClasses) {
      const effectiveProperties =
        this.resolveEffectivePropertiesForClass(
          tagClass.id,
          state,
        );

      const directProperties =
        effectiveProperties.filter(
          (property) =>
            property.assignmentType === "direct",
        );

      const inheritedProperties =
        effectiveProperties.filter(
          (property) =>
            property.assignmentType === "inherited",
        );

      if (
        directProperties.length === 0 ||
        inheritedProperties.length === 0
      ) {
        continue;
      }

      const sourceCounts = new Map<
        string,
        CfihosInheritanceSourceSummary
      >();

      for (const property of inheritedProperties) {
        const existing = sourceCounts.get(
          property.sourceTagClassId,
        );

        if (existing) {
          existing.propertyCount += 1;
          continue;
        }

        sourceCounts.set(
          property.sourceTagClassId,
          {
            tagClassId:
              property.sourceTagClassId,
            tagClassName:
              property.sourceTagClassName,
            propertyCount: 1,
          },
        );
      }

      const inheritedFrom = Array.from(
        sourceCounts.values(),
      ).sort((a, b) => {
        if (
          b.propertyCount !== a.propertyCount
        ) {
          return (
            b.propertyCount -
            a.propertyCount
          );
        }

        return a.tagClassName.localeCompare(
          b.tagClassName,
          undefined,
          {
            sensitivity: "base",
          },
        );
      });

      return {
        tagClassId: tagClass.id,
        tagClassName: tagClass.name,

        directPropertyCount:
          directProperties.length,

        inheritedPropertyCount:
          inheritedProperties.length,

        effectivePropertyCount:
          effectiveProperties.length,

        inheritedFrom,
      };
    }

    return null;
  }

  async getPropertyPicklistValues(
    propertyId: string,
  ): Promise<CfihosPropertyPicklistValue[]> {
    const state = await this.getState();

    const property =
      state.propertiesById.get(propertyId);

    if (!property?.picklistId) {
      return [];
    }

    return (
      state.picklistValuesByPicklistId.get(
        property.picklistId,
      ) ?? []
    );
  }

  async searchTagClasses(
    query: string,
  ): Promise<CfihosTagClass[]> {
    const state = await this.getState();

    const normalizedQuery =
      query.trim().toLowerCase();

    if (!normalizedQuery) {
      return state.tagClasses;
    }

    return state.tagClasses.filter(
      (tagClass) => {
        const searchableValues = [
          tagClass.id,
          tagClass.name,
          tagClass.definition,
          tagClass.parentName,
          tagClass.tagNumberFormat,
          tagClass.existenceReason,
          ...tagClass.synonyms,
        ];

        return searchableValues.some(
          (value) =>
            value
              ?.toLowerCase()
              .includes(normalizedQuery),
        );
      },
    );
  }

  private async getState(): Promise<RepositoryState> {
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

  private async buildState(): Promise<RepositoryState> {
    const [
      tagClassRows,
      tagClassPropertyRows,
      propertyRows,
      picklistValueRows,
    ] = await Promise.all([
      getCfihosWorksheetRows("tag class"),
      getCfihosWorksheetRows(
        "tag class property",
      ),
      getCfihosWorksheetRows("property"),
      getCfihosWorksheetRows(
        "property picklist values",
      ),
    ]);

    const tagClasses =
      this.buildTagClasses(tagClassRows);

    const tagClassesById =
      new Map<string, CfihosTagClass>();

    for (const tagClass of tagClasses) {
      tagClassesById.set(
        tagClass.id,
        tagClass,
      );
    }

    const parentResolution =
      this.resolveTagClassParents(
        tagClasses,
      );

    const cycleIssues =
      this.detectHierarchyCycles(
        tagClasses,
        tagClassesById,
      );

    const hierarchyIssues = [
      ...parentResolution.issues,
      ...cycleIssues,
    ];

    const tagClassChildrenByParentId =
      this.buildTagClassChildrenIndex(
        tagClasses,
      );

    const hierarchyDiagnostics =
      this.buildHierarchyDiagnostics(
        tagClasses,
        hierarchyIssues,
        parentResolution.duplicateNameCount,
      );

    const properties =
      this.buildProperties(propertyRows);

    const propertiesById =
      new Map<string, CfihosProperty>();

    for (const property of properties) {
      propertiesById.set(
        property.id,
        property,
      );
    }

    const tagClassProperties =
      this.buildTagClassProperties(
        tagClassPropertyRows,
      );

    const tagClassPropertiesByTagClassId =
      this.buildTagClassPropertyIndex(
        tagClassProperties,
      );

    const picklistValues =
      this.buildPicklistValues(
        picklistValueRows,
      );

    const picklistValuesByPicklistId =
      this.buildPicklistValueIndex(
        picklistValues,
      );

    return {
      tagClasses,
      tagClassesById,
      tagClassChildrenByParentId,

      hierarchyDiagnostics,

      properties,
      propertiesById,

      tagClassProperties,
      tagClassPropertiesByTagClassId,

      picklistValues,
      picklistValuesByPicklistId,
    };
  }

  private buildTagClasses(
    rows: CfihosWorksheetRow[],
  ): CfihosTagClass[] {
    return rows
      .map(
        (row): CfihosTagClass => ({
          id: normalizeRequiredString(
            row["CFIHOS unique code"],
          ),

          name: normalizeRequiredString(
            row["tag class name"],
          ),

          definition:
            normalizeOptionalString(
              row[
                "tag class definition"
              ],
            ),

          parentName:
            normalizeOptionalString(
              row[
                "parent tag class name"
              ],
            ),

          parentId: null,

          abstract: normalizeBoolean(
            row[
              "abstract class indicator"
            ],
          ),

          tagNumberFormat:
            normalizeOptionalString(
              row["tag number format"],
            ),

          equipmentExpected:
            normalizeBoolean(
              row[
                "equipment expected to be installed indicator"
              ],
            ),

          existenceReason:
            normalizeOptionalString(
              row[
                "tag class existence reason description"
              ],
            ),

          synonyms: normalizeSynonyms(
            row["tag class synonym"],
          ),
        }),
      )
      .filter(
        (tagClass) =>
          tagClass.id.length > 0 &&
          tagClass.name.length > 0,
      );
  }

  private resolveTagClassParents(
    tagClasses: CfihosTagClass[],
  ): ParentResolutionResult {
    const classesByNormalizedName =
      new Map<
        string,
        CfihosTagClass[]
      >();

    const issues: CfihosHierarchyIssue[] =
      [];

    for (const tagClass of tagClasses) {
      const normalizedName =
        normalizeName(tagClass.name);

      const existing =
        classesByNormalizedName.get(
          normalizedName,
        ) ?? [];

      existing.push(tagClass);

      classesByNormalizedName.set(
        normalizedName,
        existing,
      );
    }

    const duplicateNameCount =
      Array.from(
        classesByNormalizedName.values(),
      ).filter(
        (classes) => classes.length > 1,
      ).length;

    for (const tagClass of tagClasses) {
      if (!tagClass.parentName) {
        continue;
      }

      const candidates =
        classesByNormalizedName.get(
          normalizeName(
            tagClass.parentName,
          ),
        ) ?? [];

      if (candidates.length === 0) {
        issues.push({
          type: "unresolved-parent",

          tagClassId: tagClass.id,
          tagClassName: tagClass.name,

          parentName:
            tagClass.parentName,

          candidateParentIds: [],

          message:
            `Parent "${tagClass.parentName}" could not be resolved ` +
            `for Tag Class "${tagClass.name}".`,
        });

        continue;
      }

      if (candidates.length > 1) {
        issues.push({
          type: "ambiguous-parent",

          tagClassId: tagClass.id,
          tagClassName: tagClass.name,

          parentName:
            tagClass.parentName,

          candidateParentIds:
            candidates.map(
              (candidate) =>
                candidate.id,
            ),

          message:
            `Parent "${tagClass.parentName}" is ambiguous for ` +
            `Tag Class "${tagClass.name}".`,
        });

        continue;
      }

      const parent = candidates[0];

      if (
        parent.id === tagClass.id
      ) {
        issues.push({
          type: "self-parent",

          tagClassId: tagClass.id,
          tagClassName: tagClass.name,

          parentName:
            tagClass.parentName,

          candidateParentIds: [
            parent.id,
          ],

          message:
            `Tag Class "${tagClass.name}" resolves to itself as its parent.`,
        });

        continue;
      }

      tagClass.parentId =
        parent.id;
    }

    return {
      issues,
      duplicateNameCount,
    };
  }

  private detectHierarchyCycles(
    tagClasses: CfihosTagClass[],
    tagClassesById: Map<
      string,
      CfihosTagClass
    >,
  ): CfihosHierarchyIssue[] {
    const issues: CfihosHierarchyIssue[] =
      [];

    const cycleSignatures =
      new Set<string>();

    for (const tagClass of tagClasses) {
      const visited =
        new Map<string, number>();

      const path: string[] = [];

      let current:
        | CfihosTagClass
        | undefined = tagClass;

      while (current) {
        if (
          visited.has(current.id)
        ) {
          const cycleStartIndex =
            visited.get(
              current.id,
            ) ?? 0;

          const cycleIds =
            path.slice(
              cycleStartIndex,
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

              tagClassId:
                tagClass.id,

              tagClassName:
                tagClass.name,

              parentName:
                tagClass.parentName,

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

        path.push(current.id);

        if (!current.parentId) {
          break;
        }

        current =
          tagClassesById.get(
            current.parentId,
          );
      }
    }

    return issues;
  }

  private buildHierarchyDiagnostics(
    tagClasses: CfihosTagClass[],
    issues: CfihosHierarchyIssue[],
    duplicateNameCount: number,
  ): CfihosHierarchyDiagnostics {
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
          issue.type === "cycle",
      ).length;

    const rootCount =
      tagClasses.filter(
        (tagClass) =>
          tagClass.parentId === null,
      ).length;

    const resolvedParentCount =
      tagClasses.filter(
        (tagClass) =>
          tagClass.parentId !== null,
      ).length;

    return {
      tagClassCount:
        tagClasses.length,

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

  private buildTagClassChildrenIndex(
    tagClasses: CfihosTagClass[],
  ): Map<
    string,
    CfihosTagClass[]
  > {
    const index =
      new Map<
        string,
        CfihosTagClass[]
      >();

    for (const tagClass of tagClasses) {
      if (!tagClass.parentId) {
        continue;
      }

      const children =
        index.get(
          tagClass.parentId,
        ) ?? [];

      children.push(tagClass);

      index.set(
        tagClass.parentId,
        children,
      );
    }

    for (const children of index.values()) {
      children.sort(compareByName);
    }

    return index;
  }

  private buildAncestorList(
    tagClassId: string,
    state: RepositoryState,
  ): CfihosTagClass[] {
    const ancestors:
      CfihosTagClass[] = [];

    const visited =
      new Set<string>();

    let current =
      state.tagClassesById.get(
        tagClassId,
      );

    while (current?.parentId) {
      if (
        visited.has(current.id)
      ) {
        break;
      }

      visited.add(current.id);

      const parent =
        state.tagClassesById.get(
          current.parentId,
        );

      if (!parent) {
        break;
      }

      ancestors.push(parent);

      current = parent;
    }

    return ancestors;
  }

  private buildProperties(
    rows: CfihosWorksheetRow[],
  ): CfihosProperty[] {
    return rows
      .map(
        (row): CfihosProperty => ({
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

  private buildTagClassProperties(
    rows: CfihosWorksheetRow[],
  ): CfihosTagClassProperty[] {
    return rows
      .map(
        (
          row,
        ): CfihosTagClassProperty => ({
          tagClassId:
            normalizeRequiredString(
              row[
                "tag class CFIHOS unique code"
              ],
            ),

          tagClassName:
            normalizeRequiredString(
              row[
                "tag class name"
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
          relationship.tagClassId
            .length > 0 &&
          relationship.propertyId
            .length > 0,
      );
  }

  private buildTagClassPropertyIndex(
    relationships: CfihosTagClassProperty[],
  ): Map<
    string,
    CfihosTagClassProperty[]
  > {
    const index =
      new Map<
        string,
        CfihosTagClassProperty[]
      >();

    for (
      const relationship of relationships
    ) {
      const existing =
        index.get(
          relationship.tagClassId,
        ) ?? [];

      existing.push(
        relationship,
      );

      index.set(
        relationship.tagClassId,
        existing,
      );
    }

    for (
      const relationshipsForClass of
        index.values()
    ) {
      relationshipsForClass.sort(
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
    tagClassId: string,
    state: RepositoryState,
  ): CfihosResolvedTagClassProperty[] {
    const relationships =
      state.tagClassPropertiesByTagClassId.get(
        tagClassId,
      ) ?? [];

    const resolved:
      CfihosResolvedTagClassProperty[] =
      [];

    for (
      const relationship of relationships
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
    tagClassId: string,
    state: RepositoryState,
  ): CfihosEffectiveTagClassProperty[] {
    const selectedClass =
      state.tagClassesById.get(
        tagClassId,
      );

    if (!selectedClass) {
      return [];
    }

    const ancestry = [
      selectedClass,
      ...this.buildAncestorList(
        tagClassId,
        state,
      ),
    ];

    const effectiveByPropertyId =
      new Map<
        string,
        CfihosEffectiveTagClassProperty
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

              sourceTagClassId:
                sourceClass.id,

              sourceTagClassName:
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
    values: CfihosPropertyPicklistValue[],
  ): Map<
    string,
    CfihosPropertyPicklistValue[]
  > {
    const index =
      new Map<
        string,
        CfihosPropertyPicklistValue[]
      >();

    for (const value of values) {
      const existing =
        index.get(
          value.picklistId,
        ) ?? [];

      existing.push(value);

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

function compareByName(
  a: CfihosTagClass,
  b: CfihosTagClass,
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
  a: CfihosResolvedTagClassProperty,
  b: CfihosResolvedTagClassProperty,
): number {
  return a.property.name.localeCompare(
    b.property.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

export const cfihosRepository =
  new CfihosRepository();