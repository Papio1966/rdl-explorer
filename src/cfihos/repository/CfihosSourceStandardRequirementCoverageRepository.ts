import { cfihosClassDocumentRepository } from "./CfihosClassDocumentRepository";
import { cfihosJip33RequirementRepository } from "./CfihosJip33RequirementRepository";
import { cfihosRdlObjectRegistryRepository } from "./CfihosRdlObjectRegistryRepository";
import type {
  CfihosRequirementFamilyObject,
  CfihosSourceStandardRequirementCoverageDiagnostics,
} from "../model/sourceStandardRequirementCoverage";

const REQUIREMENT_DEFINITION_FILE = "source standard document and data requirement";

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

export class CfihosSourceStandardRequirementCoverageRepository {
  private diagnostics: CfihosSourceStandardRequirementCoverageDiagnostics | null = null;
  private loadingPromise: Promise<CfihosSourceStandardRequirementCoverageDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosSourceStandardRequirementCoverageDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.loadDiagnostics();

    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async loadDiagnostics(): Promise<CfihosSourceStandardRequirementCoverageDiagnostics> {
    const [masterObjects, classRequirements, jip33Requirements] = await Promise.all([
      cfihosRdlObjectRegistryRepository.getMasterObjects(),
      cfihosClassDocumentRepository.getRequirements(),
      cfihosJip33RequirementRepository.getRequirements(),
    ]);

    const masterRequirements: CfihosRequirementFamilyObject[] = masterObjects
      .filter(
        (item) =>
          item.definitionFile?.trim().toLowerCase() === REQUIREMENT_DEFINITION_FILE,
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      }));

    const masterIds = new Set(masterRequirements.map((item) => normalize(item.id)));
    const classIds = new Set(
      classRequirements.map((item) => normalize(item.id)).filter(Boolean),
    );
    const jip33Ids = new Set(
      jip33Requirements.map((item) => normalize(item.id)).filter(Boolean),
    );

    const referencedIds = new Set<string>([...classIds, ...jip33Ids]);
    const overlapIds = [...classIds].filter((id) => jip33Ids.has(id));
    const referencedMasterIds = [...referencedIds].filter((id) => masterIds.has(id));
    const missingFromMaster = [...referencedIds].filter((id) => !masterIds.has(id)).sort();
    const unreferencedMasterRequirements = masterRequirements
      .filter((item) => !referencedIds.has(normalize(item.id)))
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      masterRequirementObjectCount: masterRequirements.length,
      classRequirementRowCount: classRequirements.length,
      uniqueClassRequirementIdCount: classIds.size,
      jip33RequirementCount: jip33Ids.size,
      classAndJip33OverlapCount: overlapIds.length,
      referencedMasterRequirementCount: referencedMasterIds.length,
      masterCoveragePercent:
        masterRequirements.length === 0
          ? 0
          : Math.round((referencedMasterIds.length / masterRequirements.length) * 10000) / 100,
      classOnlyRequirementCount: [...classIds].filter((id) => !jip33Ids.has(id)).length,
      jip33OnlyRequirementCount: [...jip33Ids].filter((id) => !classIds.has(id)).length,
      unreferencedMasterRequirementCount: unreferencedMasterRequirements.length,
      referencesMissingFromMasterCount: missingFromMaster.length,
      unreferencedMasterRequirements,
      referencesMissingFromMaster: missingFromMaster,
    };
  }
}

export const cfihosSourceStandardRequirementCoverageRepository =
  new CfihosSourceStandardRequirementCoverageRepository();
