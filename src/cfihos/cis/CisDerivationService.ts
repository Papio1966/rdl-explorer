import type {
  CisAssetContextType,
  CisClassSelection,
  CisDerivedDocumentRequirement,
  CisDerivedDocumentType,
  CisDerivedLifecycleRequirement,
  CisDerivedProperty,
  CisDerivedRequirements,
  CisDerivedSourceStandard,
  CisLifecyclePhaseKey,
  CisRequirementProvenance,
  ProjectInformationProfile,
} from "./projectInformationProfile";

export type CisPropertyRecord = {
  property: {
    id: string;
    name: string;
    definition: string | null;
    dataType: string | null;
    dataTypeLength: string | null;
    unitOfMeasureDimensionId: string | null;
    unitOfMeasureDimensionCode: string | null;
    picklistId: string | null;
    picklistName: string | null;
  };
  assignmentType: "direct" | "inherited";
  inheritanceDepth: number;
  sourceClassId: string;
  sourceClassName: string;
  picklistValues: Array<{
    sourceStandardId: string | null;
    sourceStandardCode: string | null;
  }>;
};

export type CisClassDocumentRecord = {
  requirementId: string;
  referencedClassId: string;
  referencedClassName: string;
  assetContext: CisAssetContextType;
  documentTypeId: string;
  documentTypeName: string;
  sourceStandardId: string | null;
  sourceStandardCode: string | null;
};

export type CisClassStandardRecord = {
  sourceStandardId: string;
  sourceStandardCode: string;
};

export type CisPropertyStandardRecord = CisClassStandardRecord & {
  propertyId: string;
  propertyName: string;
  sourceStandardSection: string | null;
};

export type CisSourceStandardRecord = {
  id: string;
  code: string;
  description: string | null;
};

export type CisDisciplineDocumentRecord = {
  id: string;
  disciplineId: string;
  disciplineName: string;
  documentTypeId: string;
  documentTypeName: string;
  requiredStatusDetailedEngineering: string | null;
  requiredStatusConstruction: string | null;
  requiredStatusCommissioning: string | null;
  requiredStatusStartup: string | null;
  requiredStatusOperations: string | null;
};

export type CisDerivationDataSource = {
  resolveClass(selection: CisClassSelection): Promise<{
    id: string;
    name: string;
  } | null>;
  getEffectiveProperties(selection: CisClassSelection): Promise<CisPropertyRecord[]>;
  getClassDocumentRequirements(
    selection: CisClassSelection,
  ): Promise<CisClassDocumentRecord[]>;
  getClassStandards(selection: CisClassSelection): Promise<CisClassStandardRecord[]>;
  getPropertyStandardsForClass(
    selection: CisClassSelection,
  ): Promise<CisPropertyStandardRecord[]>;
  getSourceStandard(id: string): Promise<CisSourceStandardRecord | null>;
  getDisciplineDocumentRelationships(): Promise<CisDisciplineDocumentRecord[]>;
};

export type CisDerivationWarning = {
  code:
    | "class-not-found"
    | "source-standard-not-found"
    | "discipline-not-found-in-lifecycle-model";
  message: string;
};

export type CisDerivationResult = {
  profile: ProjectInformationProfile;
  warnings: CisDerivationWarning[];
};

const LIFECYCLE_PHASES: ReadonlyArray<{
  key: CisLifecyclePhaseKey;
  name: string;
  getStatus: (relationship: CisDisciplineDocumentRecord) => string | null;
}> = [
  {
    key: "detailed-engineering",
    name: "Detailed Engineering",
    getStatus: (relationship) => relationship.requiredStatusDetailedEngineering,
  },
  {
    key: "construction",
    name: "Construction",
    getStatus: (relationship) => relationship.requiredStatusConstruction,
  },
  {
    key: "commissioning",
    name: "Commissioning",
    getStatus: (relationship) => relationship.requiredStatusCommissioning,
  },
  {
    key: "startup",
    name: "Startup",
    getStatus: (relationship) => relationship.requiredStatusStartup,
  },
  {
    key: "operations",
    name: "Operations",
    getStatus: (relationship) => relationship.requiredStatusOperations,
  },
];

export class CisDerivationService {
  private readonly dataSource: CisDerivationDataSource;

  constructor(dataSource: CisDerivationDataSource) {
    this.dataSource = dataSource;
  }

  async derive(profile: ProjectInformationProfile): Promise<CisDerivationResult> {
    const warnings: CisDerivationWarning[] = [];
    const properties = new Map<string, CisDerivedProperty>();
    const documentRequirements: CisDerivedDocumentRequirement[] = [];
    const documentTypes = new Map<string, CisDerivedDocumentType>();
    const sourceStandards = new Map<string, CisDerivedSourceStandard>();

    for (const selectedClass of profile.scope.classes) {
      const resolvedClass = await this.dataSource.resolveClass(selectedClass);
      if (!resolvedClass) {
        warnings.push({
          code: "class-not-found",
          message: `${selectedClass.domain} class ${selectedClass.classId} (${selectedClass.className}) could not be resolved and was not derived.`,
        });
        continue;
      }

      const effectiveProperties = await this.dataSource.getEffectiveProperties(selectedClass);
      const effectivePropertyIds = new Set(effectiveProperties.map((item) => item.property.id));

      for (const item of effectiveProperties) {
        const provenance = createPropertyProvenance(selectedClass, item);
        const existing = properties.get(item.property.id);
        if (existing) {
          addProvenance(existing.provenance, provenance);
        } else {
          properties.set(item.property.id, {
            kind: "property",
            propertyId: item.property.id,
            propertyName: item.property.name,
            definition: item.property.definition,
            dataType: item.property.dataType,
            dataTypeLength: item.property.dataTypeLength,
            unitOfMeasureDimensionId: item.property.unitOfMeasureDimensionId,
            unitOfMeasureDimensionCode: item.property.unitOfMeasureDimensionCode,
            picklistId: item.property.picklistId,
            picklistName: item.property.picklistName,
            provenance: [provenance],
          });
        }

        for (const value of item.picklistValues) {
          if (!value.sourceStandardId) continue;
          await addSourceStandardReferences(
            sourceStandards,
            this.dataSource,
            value.sourceStandardId,
            value.sourceStandardCode,
            false,
            {
              ...emptyProvenance(),
              selectedClass,
              reason: `Controlled values for property ${item.property.name} reference this Source Standard.`,
            },
            warnings,
          );
        }
      }

      const classDocumentRequirements =
        await this.dataSource.getClassDocumentRequirements(selectedClass);

      for (const requirement of classDocumentRequirements) {
        const provenance: CisRequirementProvenance = {
          ...emptyProvenance(),
          selectedClass,
          assetContext: requirement.assetContext,
          sourceStandardId: requirement.sourceStandardId,
          sourceStandardCode: requirement.sourceStandardCode,
          documentTypeId: requirement.documentTypeId,
          documentTypeName: requirement.documentTypeName,
          requirementId: requirement.requirementId,
          reason: `CFIHOS requirement ${requirement.requirementId} requires ${requirement.documentTypeName} in ${formatAssetContext(requirement.assetContext)} context.`,
        };

        documentRequirements.push({
          kind: "document-requirement",
          requirementId: requirement.requirementId,
          selectedClass,
          assetContext: requirement.assetContext,
          documentTypeId: requirement.documentTypeId,
          documentTypeName: requirement.documentTypeName,
          sourceStandardId: requirement.sourceStandardId,
          sourceStandardCode: requirement.sourceStandardCode,
          provenance: [provenance],
        });

        const existing = documentTypes.get(requirement.documentTypeId);
        if (existing) {
          if (!existing.requirementIds.includes(requirement.requirementId)) {
            existing.requirementIds.push(requirement.requirementId);
            existing.requirementIds.sort();
          }
          if (!existing.assetContexts.includes(requirement.assetContext)) {
            existing.assetContexts.push(requirement.assetContext);
            existing.assetContexts.sort(compareAssetContext);
          }
          addProvenance(existing.provenance, provenance);
        } else {
          documentTypes.set(requirement.documentTypeId, {
            kind: "document-type",
            documentTypeId: requirement.documentTypeId,
            documentTypeName: requirement.documentTypeName,
            requirementIds: [requirement.requirementId],
            assetContexts: [requirement.assetContext],
            provenance: [provenance],
          });
        }

        if (requirement.sourceStandardId) {
          await addSourceStandardReferences(
            sourceStandards,
            this.dataSource,
            requirement.sourceStandardId,
            requirement.sourceStandardCode,
            false,
            provenance,
            warnings,
          );
        }
      }

      const classStandards = await this.dataSource.getClassStandards(selectedClass);
      for (const relationship of classStandards) {
        await addSourceStandard(
          sourceStandards,
          this.dataSource,
          relationship.sourceStandardId,
          relationship.sourceStandardCode,
          false,
          {
            ...emptyProvenance(),
            selectedClass,
            sourceStandardId: relationship.sourceStandardId,
            sourceStandardCode: relationship.sourceStandardCode,
            reason: `CFIHOS directly maps ${selectedClass.className} to this Source Standard.`,
          },
          warnings,
        );
      }

      const propertyStandards =
        await this.dataSource.getPropertyStandardsForClass(selectedClass);
      for (const relationship of propertyStandards) {
        if (!effectivePropertyIds.has(relationship.propertyId)) continue;

        await addSourceStandard(
          sourceStandards,
          this.dataSource,
          relationship.sourceStandardId,
          relationship.sourceStandardCode,
          false,
          {
            ...emptyProvenance(),
            selectedClass,
            sourceStandardId: relationship.sourceStandardId,
            sourceStandardCode: relationship.sourceStandardCode,
            sourceStandardSection: relationship.sourceStandardSection,
            reason: `Property ${relationship.propertyName} for ${selectedClass.className} is traced to this Source Standard.`,
          },
          warnings,
        );
      }
    }

    for (const selectedStandard of profile.scope.sourceStandards) {
      await addSourceStandard(
        sourceStandards,
        this.dataSource,
        selectedStandard.sourceStandardId,
        selectedStandard.sourceStandardCode,
        true,
        {
          ...emptyProvenance(),
          sourceStandardId: selectedStandard.sourceStandardId,
          sourceStandardCode: selectedStandard.sourceStandardCode,
          reason: "Explicitly selected as part of the contract information scope.",
        },
        warnings,
      );
    }

    const lifecycleRequirements = await this.deriveLifecycleRequirements(
      profile,
      new Set(documentTypes.keys()),
      warnings,
    );

    const derived: CisDerivedRequirements = {
      properties: [...properties.values()].sort((a, b) =>
        compareText(a.propertyName, b.propertyName),
      ),
      documentRequirements: documentRequirements.sort((a, b) => {
        const context = compareAssetContext(a.assetContext, b.assetContext);
        if (context !== 0) return context;
        const document = compareText(a.documentTypeName, b.documentTypeName);
        if (document !== 0) return document;
        return compareText(a.requirementId, b.requirementId);
      }),
      documentTypes: [...documentTypes.values()].sort((a, b) =>
        compareText(a.documentTypeName, b.documentTypeName),
      ),
      sourceStandards: [...sourceStandards.values()].sort((a, b) =>
        compareText(a.sourceStandardCode, b.sourceStandardCode),
      ),
      lifecycleRequirements,
    };

    return {
      profile: {
        ...profile,
        derived,
      },
      warnings,
    };
  }

  private async deriveLifecycleRequirements(
    profile: ProjectInformationProfile,
    derivedDocumentTypeIds: Set<string>,
    warnings: CisDerivationWarning[],
  ): Promise<CisDerivedLifecycleRequirement[]> {
    if (profile.scope.disciplines.length === 0 || derivedDocumentTypeIds.size === 0) {
      return [];
    }

    const relationships = await this.dataSource.getDisciplineDocumentRelationships();
    const relationshipDisciplineIds = new Set(
      relationships.map((relationship) => relationship.disciplineId),
    );

    for (const discipline of profile.scope.disciplines) {
      if (!relationshipDisciplineIds.has(discipline.disciplineId)) {
        warnings.push({
          code: "discipline-not-found-in-lifecycle-model",
          message: `Discipline ${discipline.disciplineId} (${discipline.disciplineName}) is selected but has no Discipline x Document Type relationships.`,
        });
      }
    }

    const selectedDisciplineIds = new Set(
      profile.scope.disciplines.map((discipline) => discipline.disciplineId),
    );
    const result = new Map<string, CisDerivedLifecycleRequirement>();

    for (const relationship of relationships) {
      if (!selectedDisciplineIds.has(relationship.disciplineId)) continue;
      if (!derivedDocumentTypeIds.has(relationship.documentTypeId)) continue;

      for (const phase of LIFECYCLE_PHASES) {
        const requiredStatus = phase.getStatus(relationship)?.trim() ?? "";
        if (!requiredStatus) continue;

        const id = [relationship.id, phase.key, requiredStatus].join("|");
        const provenance: CisRequirementProvenance = {
          ...emptyProvenance(),
          disciplineId: relationship.disciplineId,
          disciplineName: relationship.disciplineName,
          documentTypeId: relationship.documentTypeId,
          documentTypeName: relationship.documentTypeName,
          reason: `${relationship.disciplineName} requires status "${requiredStatus}" for ${relationship.documentTypeName} at ${phase.name}.`,
        };

        result.set(id, {
          kind: "lifecycle-requirement",
          id,
          disciplineId: relationship.disciplineId,
          disciplineName: relationship.disciplineName,
          documentTypeId: relationship.documentTypeId,
          documentTypeName: relationship.documentTypeName,
          lifecyclePhase: phase.key,
          lifecyclePhaseName: phase.name,
          requiredStatus,
          disciplineDocumentTypeRelationshipId: relationship.id,
          provenance: [provenance],
        });
      }
    }

    return [...result.values()].sort((a, b) => {
      const discipline = compareText(a.disciplineName, b.disciplineName);
      if (discipline !== 0) return discipline;
      const document = compareText(a.documentTypeName, b.documentTypeName);
      if (document !== 0) return document;
      return lifecyclePhaseOrder(a.lifecyclePhase) - lifecyclePhaseOrder(b.lifecyclePhase);
    });
  }
}

function createPropertyProvenance(
  selectedClass: CisClassSelection,
  item: CisPropertyRecord,
): CisRequirementProvenance {
  const sourcePhrase =
    item.assignmentType === "direct"
      ? `directly assigned to ${selectedClass.className}`
      : `inherited from ${item.sourceClassName} at hierarchy depth ${item.inheritanceDepth}`;

  return {
    ...emptyProvenance(),
    selectedClass,
    assignmentType: item.assignmentType,
    inheritanceDepth: item.inheritanceDepth,
    sourceClassId: item.sourceClassId,
    sourceClassName: item.sourceClassName,
    reason: `Property ${item.property.name} is ${sourcePhrase}.`,
  };
}

async function addSourceStandardReferences(
  target: Map<string, CisDerivedSourceStandard>,
  dataSource: CisDerivationDataSource,
  rawIds: string,
  rawCodes: string | null,
  explicitlySelected: boolean,
  provenance: CisRequirementProvenance,
  warnings: CisDerivationWarning[],
): Promise<void> {
  const ids = splitSemicolonList(rawIds);
  const codes = splitSemicolonList(rawCodes);

  for (let index = 0; index < ids.length; index += 1) {
    const sourceStandardId = ids[index];
    const sourceStandardCode =
      cleanPairedCode(codes[index]) ??
      cleanPairedCode(codes.length === 1 ? codes[0] : null);

    await addSourceStandard(
      target,
      dataSource,
      sourceStandardId,
      sourceStandardCode,
      explicitlySelected,
      {
        ...provenance,
        sourceStandardId,
        sourceStandardCode,
      },
      warnings,
    );
  }
}

async function addSourceStandard(
  target: Map<string, CisDerivedSourceStandard>,
  dataSource: CisDerivationDataSource,
  sourceStandardId: string,
  fallbackCode: string | null,
  explicitlySelected: boolean,
  provenance: CisRequirementProvenance,
  warnings: CisDerivationWarning[],
): Promise<void> {
  const standard = await dataSource.getSourceStandard(sourceStandardId);
  if (!standard) {
    warnings.push({
      code: "source-standard-not-found",
      message: `Source Standard ${sourceStandardId}${fallbackCode ? ` (${fallbackCode})` : ""} could not be resolved.`,
    });
    return;
  }

  const existing = target.get(sourceStandardId);
  if (existing) {
    existing.explicitlySelected = existing.explicitlySelected || explicitlySelected;
    addProvenance(existing.provenance, provenance);
    return;
  }

  target.set(sourceStandardId, {
    kind: "source-standard",
    sourceStandardId: standard.id,
    sourceStandardCode: standard.code,
    description: standard.description,
    explicitlySelected,
    provenance: [provenance],
  });
}

function emptyProvenance(): CisRequirementProvenance {
  return {
    selectedClass: null,
    assetContext: null,
    assignmentType: null,
    inheritanceDepth: null,
    sourceClassId: null,
    sourceClassName: null,
    sourceStandardId: null,
    sourceStandardCode: null,
    sourceStandardSection: null,
    disciplineId: null,
    disciplineName: null,
    documentTypeId: null,
    documentTypeName: null,
    requirementId: null,
    reason: "",
  };
}

function addProvenance(
  target: CisRequirementProvenance[],
  value: CisRequirementProvenance,
): void {
  const key = provenanceKey(value);
  if (!target.some((item) => provenanceKey(item) === key)) {
    target.push(value);
  }
}

function provenanceKey(value: CisRequirementProvenance): string {
  return JSON.stringify([
    value.selectedClass?.domain ?? null,
    value.selectedClass?.classId ?? null,
    value.assetContext,
    value.assignmentType,
    value.inheritanceDepth,
    value.sourceClassId,
    value.sourceStandardId,
    value.sourceStandardSection,
    value.disciplineId,
    value.documentTypeId,
    value.requirementId,
    value.reason,
  ]);
}

function splitSemicolonList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPairedCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
  return cleaned || null;
}

const ASSET_CONTEXT_ORDER: readonly CisAssetContextType[] = [
  "Plant",
  "Process_Unit",
  "Tag",
  "Equipment",
  "Model_Part",
  "Unknown",
];

function compareAssetContext(
  a: CisAssetContextType,
  b: CisAssetContextType,
): number {
  return ASSET_CONTEXT_ORDER.indexOf(a) - ASSET_CONTEXT_ORDER.indexOf(b);
}

function formatAssetContext(value: CisAssetContextType): string {
  if (value === "Process_Unit") return "Process Unit";
  if (value === "Model_Part") return "Model / Part";
  return value;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function lifecyclePhaseOrder(value: CisLifecyclePhaseKey): number {
  return LIFECYCLE_PHASES.findIndex((phase) => phase.key === value);
}
