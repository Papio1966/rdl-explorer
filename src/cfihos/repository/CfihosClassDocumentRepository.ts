import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosClassDocumentAssetType,
  CfihosClassDocumentDiagnostics,
  CfihosClassDocumentRequirement,
  CfihosResolvedClassDocumentRequirement,
  CfihosUnresolvedEquipmentRequirement,
} from "../model/classDocumentRequirement";
import { cfihosRepository } from "./CfihosRepository";
import { cfihosEquipmentRepository } from "./CfihosEquipmentRepository";
import { cfihosDocumentRepository } from "./CfihosDocumentRepository";
import { cfihosSourceStandardRepository } from "./CfihosSourceStandardRepository";

const REQUIREMENT_SHEET = "document required per class";

type ClassDocumentRepositoryState = {
  requirements: CfihosClassDocumentRequirement[];
  resolvedRequirements: CfihosResolvedClassDocumentRequirement[];
  diagnostics: CfihosClassDocumentDiagnostics;
};

export class CfihosClassDocumentRepository {
  private state: ClassDocumentRepositoryState | null = null;

  private loadingPromise:
    | Promise<ClassDocumentRepositoryState>
    | null = null;

  async initialize(): Promise<void> {
    await this.getState();
  }

  async getRequirements(): Promise<
    CfihosClassDocumentRequirement[]
  > {
    const state = await this.getState();
    return state.requirements;
  }

  async getResolvedRequirements(): Promise<
    CfihosResolvedClassDocumentRequirement[]
  > {
    const state = await this.getState();
    return state.resolvedRequirements;
  }

  async getDiagnostics(): Promise<
    CfihosClassDocumentDiagnostics
  > {
    const state = await this.getState();
    return state.diagnostics;
  }

  async getRequirementsForTagClass(
    tagClassId: string,
  ): Promise<CfihosResolvedClassDocumentRequirement[]> {
    const state = await this.getState();
    const requested = canonicalizeCfihosId(tagClassId);

    return state.resolvedRequirements
      .filter((item) => {
        const assetType = item.requirement.assetType;
        if (assetType !== "Tag" && assetType !== "Model_Part") {
          return false;
        }

        return (
          item.resolvedTagClassId !== null &&
          canonicalizeCfihosId(item.resolvedTagClassId) === requested
        );
      })
      .sort(compareResolvedRequirements);
  }

  async getRequirementsForEquipmentClass(
    equipmentClassId: string,
  ): Promise<CfihosResolvedClassDocumentRequirement[]> {
    const state = await this.getState();
    const requested = canonicalizeCfihosId(equipmentClassId);

    return state.resolvedRequirements
      .filter((item) => {
        const assetType = item.requirement.assetType;
        if (assetType !== "Equipment" && assetType !== "Model_Part") {
          return false;
        }

        return (
          item.resolvedEquipmentClassId !== null &&
          canonicalizeCfihosId(item.resolvedEquipmentClassId) === requested
        );
      })
      .sort(compareResolvedRequirements);
  }

  async getRequirementsForDocumentType(
    documentTypeId: string,
  ): Promise<CfihosResolvedClassDocumentRequirement[]> {
    const state = await this.getState();
    const requested = canonicalizeCfihosId(documentTypeId);

    return state.resolvedRequirements
      .filter(
        (item) =>
          item.resolvedDocumentTypeId !== null &&
          canonicalizeCfihosId(item.resolvedDocumentTypeId) === requested,
      )
      .sort(compareResolvedRequirements);
  }

  async getRequirementsForSourceStandard(
    sourceStandardId: string,
  ): Promise<CfihosResolvedClassDocumentRequirement[]> {
    const state = await this.getState();
    const requested = canonicalizeCfihosId(sourceStandardId);

    return state.resolvedRequirements
      .filter(
        (item) =>
          item.resolvedSourceStandardId !== null &&
          canonicalizeCfihosId(item.resolvedSourceStandardId) === requested,
      )
      .sort(compareResolvedRequirements);
  }

  private async getState(): Promise<ClassDocumentRepositoryState> {
    if (this.state) {
      return this.state;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.loadState();
    }

    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadState(): Promise<ClassDocumentRepositoryState> {
    const [
      rows,
      tagClasses,
      equipmentClasses,
      documentTypes,
      sourceStandards,
    ] = await Promise.all([
      getCfihosWorksheetRows(REQUIREMENT_SHEET),
      cfihosRepository.getTagClasses(),
      cfihosEquipmentRepository.getEquipmentClasses(),
      cfihosDocumentRepository.getDocumentTypes(),
      cfihosSourceStandardRepository.getSourceStandards(),
    ]);

    const requirements = this.buildRequirements(rows);

    const tagLookup = buildEntityLookup(tagClasses);
    const equipmentLookup = buildEntityLookup(equipmentClasses);
    const documentTypeLookup = buildEntityLookup(documentTypes);
    const sourceStandardLookup = buildEntityLookup(sourceStandards);

    const resolvedRequirements: CfihosResolvedClassDocumentRequirement[] = [];

    const unresolvedClassIds = new Set<string>();
    const unresolvedDocumentTypeIds = new Set<string>();
    const unresolvedSourceStandardIds = new Set<string>();
    const unknownAssetTypeValues = new Set<string>();
    const semanticKeys = new Set<string>();

    let tagRequirementCount = 0;
    let equipmentRequirementCount = 0;
    let modelPartRequirementCount = 0;
    let plantRequirementCount = 0;
    let processUnitRequirementCount = 0;
    let unknownAssetTypeRequirementCount = 0;

    let resolvedClassReferenceCount = 0;
    let unresolvedClassReferenceCount = 0;

    let resolvedTagClassReferenceCount = 0;
    let unresolvedTagClassReferenceCount = 0;

    let resolvedEquipmentClassReferenceCount = 0;
    let unresolvedEquipmentClassReferenceCount = 0;
    const unresolvedEquipmentRequirements: CfihosUnresolvedEquipmentRequirement[] = [];

    let modelPartResolvedAsTagOnlyCount = 0;
    let modelPartResolvedAsEquipmentOnlyCount = 0;
    let modelPartResolvedInBothDomainsCount = 0;
    let modelPartUnresolvedClassCount = 0;

    let resolvedDocumentTypeReferenceCount = 0;
    let unresolvedDocumentTypeReferenceCount = 0;

    let resolvedSourceStandardReferenceCount = 0;
    let unresolvedSourceStandardReferenceCount = 0;
    let missingSourceStandardReferenceCount = 0;

    for (const requirement of requirements) {
      const tagClass = resolveEntity(requirement.classId, tagLookup);
      const equipmentClass = resolveEntity(
        requirement.classId,
        equipmentLookup,
      );
      const documentType = resolveEntity(
        requirement.documentTypeId,
        documentTypeLookup,
      );
      const sourceStandard = requirement.sourceStandardId
        ? resolveEntity(
            requirement.sourceStandardId,
            sourceStandardLookup,
          )
        : null;

      let classResolved = false;

      switch (requirement.assetType) {
        case "Tag":
          tagRequirementCount += 1;

          if (tagClass) {
            resolvedTagClassReferenceCount += 1;
            classResolved = true;
          } else {
            unresolvedTagClassReferenceCount += 1;
          }
          break;

        case "Equipment":
          equipmentRequirementCount += 1;

          if (equipmentClass) {
            resolvedEquipmentClassReferenceCount += 1;
            classResolved = true;
          } else {
            unresolvedEquipmentClassReferenceCount += 1;
            unresolvedEquipmentRequirements.push({
              requirementId: requirement.id,
              classId: requirement.classId,
              className: requirement.className,
              documentTypeId: requirement.documentTypeId,
              documentTypeName: requirement.documentTypeName,
              sourceStandardId: requirement.sourceStandardId,
              sourceStandardCode: requirement.sourceStandardCode,
            });
          }
          break;

        case "Model_Part":
          modelPartRequirementCount += 1;

          if (tagClass && equipmentClass) {
            modelPartResolvedInBothDomainsCount += 1;
            classResolved = true;
          } else if (tagClass) {
            modelPartResolvedAsTagOnlyCount += 1;
            classResolved = true;
          } else if (equipmentClass) {
            modelPartResolvedAsEquipmentOnlyCount += 1;
            classResolved = true;
          } else {
            modelPartUnresolvedClassCount += 1;
          }
          break;

        case "Plant":
          plantRequirementCount += 1;
          classResolved = true;
          break;

        case "Process_Unit":
          processUnitRequirementCount += 1;
          classResolved = true;
          break;

        case "Unknown":
          unknownAssetTypeRequirementCount += 1;

          if (requirement.assetTypeReference) {
            unknownAssetTypeValues.add(
              requirement.assetTypeReference,
            );
          }

          classResolved = Boolean(tagClass || equipmentClass);
          break;
      }

      if (classResolved) {
        resolvedClassReferenceCount += 1;
      } else {
        unresolvedClassReferenceCount += 1;
        unresolvedClassIds.add(requirement.classId);
      }

      if (documentType) {
        resolvedDocumentTypeReferenceCount += 1;
      } else {
        unresolvedDocumentTypeReferenceCount += 1;
        unresolvedDocumentTypeIds.add(requirement.documentTypeId);
      }

      if (!requirement.sourceStandardId) {
        missingSourceStandardReferenceCount += 1;
      } else if (sourceStandard) {
        resolvedSourceStandardReferenceCount += 1;
      } else {
        unresolvedSourceStandardReferenceCount += 1;
        unresolvedSourceStandardIds.add(requirement.sourceStandardId);
      }

      semanticKeys.add(
        buildSemanticRequirementKey(requirement),
      );

      resolvedRequirements.push({
        requirement,
        resolvedTagClassId: tagClass?.id ?? null,
        resolvedEquipmentClassId: equipmentClass?.id ?? null,
        resolvedDocumentTypeId: documentType?.id ?? null,
        resolvedSourceStandardId: sourceStandard?.id ?? null,
      });
    }

    const diagnostics: CfihosClassDocumentDiagnostics = {
      sourceRequirementCount: requirements.length,
      uniqueSemanticRequirementCount: semanticKeys.size,
      duplicateSemanticRequirementCount:
        requirements.length - semanticKeys.size,

      tagRequirementCount,
      equipmentRequirementCount,
      modelPartRequirementCount,
      plantRequirementCount,
      processUnitRequirementCount,
      unknownAssetTypeRequirementCount,
      unknownAssetTypeValues: Array.from(unknownAssetTypeValues).sort(),

      resolvedClassReferenceCount,
      unresolvedClassReferenceCount,

      resolvedTagClassReferenceCount,
      unresolvedTagClassReferenceCount,

      resolvedEquipmentClassReferenceCount,
      unresolvedEquipmentClassReferenceCount,
      unresolvedEquipmentRequirements: unresolvedEquipmentRequirements.sort(
        (a, b) =>
          a.className.localeCompare(b.className, undefined, {
            sensitivity: "base",
          }),
      ),

      modelPartResolvedAsTagOnlyCount,
      modelPartResolvedAsEquipmentOnlyCount,
      modelPartResolvedInBothDomainsCount,
      modelPartUnresolvedClassCount,

      resolvedDocumentTypeReferenceCount,
      unresolvedDocumentTypeReferenceCount,

      resolvedSourceStandardReferenceCount,
      unresolvedSourceStandardReferenceCount,
      missingSourceStandardReferenceCount,

      unresolvedClassIds: Array.from(unresolvedClassIds).sort(),
      unresolvedDocumentTypeIds: Array.from(
        unresolvedDocumentTypeIds,
      ).sort(),
      unresolvedSourceStandardIds: Array.from(
        unresolvedSourceStandardIds,
      ).sort(),
    };

    return {
      requirements,
      resolvedRequirements,
      diagnostics,
    };
  }

  private buildRequirements(
    rows: CfihosWorksheetRow[],
  ): CfihosClassDocumentRequirement[] {
    return rows
      .map((row): CfihosClassDocumentRequirement => {
        const assetTypeReference = normalizeOptionalString(
          row["asset type reference"],
        );

        return {
          id: normalizeRequiredString(
            row[
              "source standard document and data requirement CFIHOS unique code"
            ],
          ),

          classId: normalizeRequiredString(
            row["tag or equipment class CFIHOS unique code"],
          ),
          className: normalizeRequiredString(
            row["tag or equipment class name"],
          ),

          assetTypeReference,
          assetType: normalizeAssetType(assetTypeReference),

          sourceStandardId: normalizeOptionalString(
            row["source standard CFIHOS unique code"],
          ),
          sourceStandardCode: normalizeOptionalString(
            row["source standard code"],
          ),

          documentTypeId: normalizeRequiredString(
            row["document type CFIHOS unique code"],
          ),
          documentTypeName: normalizeRequiredString(
            row["document type name"],
          ),
        };
      })
      .filter(
        (requirement) =>
          requirement.id.length > 0 &&
          requirement.classId.length > 0 &&
          requirement.documentTypeId.length > 0,
      );
  }
}

type EntityLookup<T extends { id: string }> = {
  exact: Map<string, T>;
  canonical: Map<string, T[]>;
};

function buildEntityLookup<T extends { id: string }>(
  entities: T[],
): EntityLookup<T> {
  const exact = new Map<string, T>();
  const canonical = new Map<string, T[]>();

  for (const entity of entities) {
    exact.set(normalizeIdText(entity.id), entity);

    const key = canonicalizeCfihosId(entity.id);
    const candidates = canonical.get(key) ?? [];
    candidates.push(entity);
    canonical.set(key, candidates);
  }

  return {
    exact,
    canonical,
  };
}

function resolveEntity<T extends { id: string }>(
  rawId: string,
  lookup: EntityLookup<T>,
): T | null {
  const normalized = normalizeIdText(rawId);

  const exact = lookup.exact.get(normalized);
  if (exact) {
    return exact;
  }

  const candidates =
    lookup.canonical.get(canonicalizeCfihosId(rawId)) ?? [];

  return candidates.length === 1 ? candidates[0] : null;
}

function canonicalizeCfihosId(value: string): string {
  const normalized = normalizeIdText(value);
  const match = /^CFIHOS-(\d+)$/.exec(normalized);

  if (!match) {
    return normalized;
  }

  const digits = match[1];

  if (digits.length === 8) {
    return `CFIHOS-${digits}`;
  }

  if (digits.length > 8) {
    return `CFIHOS-${digits[0]}${digits.slice(-7)}`;
  }

  if (digits.length > 1) {
    return `CFIHOS-${digits[0]}${digits.slice(1).padStart(7, "0")}`;
  }

  return `CFIHOS-${digits.padEnd(8, "0")}`;
}

function normalizeIdText(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeAssetType(
  value: string | null,
): CfihosClassDocumentAssetType {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "tag":
      return "Tag";

    case "equipment":
      return "Equipment";

    case "model_part":
    case "model/part":
    case "model_or_part":
      return "Model_Part";

    case "plant":
      return "Plant";

    case "process_unit":
      return "Process_Unit";

    default:
      return "Unknown";
  }
}


function compareResolvedRequirements(
  a: CfihosResolvedClassDocumentRequirement,
  b: CfihosResolvedClassDocumentRequirement,
): number {
  const documentComparison =
    a.requirement.documentTypeName.localeCompare(
      b.requirement.documentTypeName,
      undefined,
      { numeric: true, sensitivity: "base" },
    );

  if (documentComparison !== 0) {
    return documentComparison;
  }

  const contextComparison =
    a.requirement.assetType.localeCompare(
      b.requirement.assetType,
      undefined,
      { sensitivity: "base" },
    );

  if (contextComparison !== 0) {
    return contextComparison;
  }

  return a.requirement.className.localeCompare(
    b.requirement.className,
    undefined,
    { numeric: true, sensitivity: "base" },
  );
}

function buildSemanticRequirementKey(
  requirement: CfihosClassDocumentRequirement,
): string {
  return [
    canonicalizeCfihosId(requirement.classId),
    requirement.assetType,
    canonicalizeCfihosId(requirement.documentTypeId),
    requirement.sourceStandardId
      ? canonicalizeCfihosId(requirement.sourceStandardId)
      : "",
  ].join("|");
}

export const cfihosClassDocumentRepository =
  new CfihosClassDocumentRepository();
