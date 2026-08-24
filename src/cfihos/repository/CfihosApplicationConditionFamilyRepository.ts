import {
  getCfihosSheetNames,
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosApplicationConditionFamilyDiagnostics,
  CfihosApplicationConditionRelationshipSample,
  CfihosApplicationConditionWorksheetUsage,
} from "../model/applicationConditionFamily";

const MASTER_SHEET = "RDL master object";

type MasterObject = { id: string; name: string };

export class CfihosApplicationConditionFamilyRepository {
  private diagnostics: CfihosApplicationConditionFamilyDiagnostics | null = null;
  private loadingPromise: Promise<CfihosApplicationConditionFamilyDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosApplicationConditionFamilyDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.buildDiagnostics();
    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildDiagnostics(): Promise<CfihosApplicationConditionFamilyDiagnostics> {
    const [sheetNames, masterRows] = await Promise.all([
      getCfihosSheetNames(),
      getCfihosWorksheetRows(MASTER_SHEET),
    ]);

    const applicationConditions = masterObjectsForFamily(masterRows, "application condition");
    const requirementConditions = masterObjectsForFamily(
      masterRows,
      "source standard document and data requirement condition",
    );
    const conditionGroups = masterObjectsForFamily(masterRows, "application condition group");
    const sourceRequirements = masterObjectsForFamily(
      masterRows,
      "source standard document and data requirement",
    );

    const appById = index(applicationConditions);
    const reqCondById = index(requirementConditions);
    const groupById = index(conditionGroups);
    const requirementById = index(sourceRequirements);

    const referencedAppIds = new Set<string>();
    const referencedReqCondIds = new Set<string>();
    const referencedGroupIds = new Set<string>();
    const requirementConditionPairs = new Set<string>();
    const conditionApplicationPairs = new Set<string>();
    const applicationGroupPairs = new Set<string>();
    const worksheetUsage: CfihosApplicationConditionWorksheetUsage[] = [];
    const relationshipSamples: CfihosApplicationConditionRelationshipSample[] = [];

    let applicationConditionOccurrences = 0;
    let requirementConditionOccurrences = 0;
    let conditionGroupOccurrences = 0;
    let rowsWithRequirementAndConditionCount = 0;
    let rowsWithConditionAndApplicationConditionCount = 0;
    let rowsWithApplicationConditionAndGroupCount = 0;
    let rowsWithAllConditionLayersCount = 0;

    const sheets = sheetNames.filter((name) => name !== MASTER_SHEET);
    const allRows = await Promise.all(
      sheets.map(async (sheetName) => ({
        sheetName,
        rows: await getCfihosWorksheetRows(sheetName),
      })),
    );

    for (const { sheetName, rows } of allRows) {
      let sheetAppOccurrences = 0;
      let sheetReqCondOccurrences = 0;
      let sheetGroupOccurrences = 0;
      let sheetRequirementOccurrences = 0;
      let sheetRowsReqCond = 0;
      let sheetRowsCondApp = 0;
      let sheetRowsAppGroup = 0;
      const sheetAppIds = new Set<string>();
      const sheetReqCondIds = new Set<string>();
      const sheetGroupIds = new Set<string>();
      const sheetRequirementIds = new Set<string>();

      for (const row of rows) {
        const ids = collectRowIds(row);
        const rowApps = ids.filter((id) => appById.has(id));
        const rowReqConds = ids.filter((id) => reqCondById.has(id));
        const rowGroups = ids.filter((id) => groupById.has(id));
        const rowRequirements = ids.filter((id) => requirementById.has(id));

        for (const id of rowApps) {
          applicationConditionOccurrences += 1;
          sheetAppOccurrences += 1;
          referencedAppIds.add(id);
          sheetAppIds.add(id);
        }
        for (const id of rowReqConds) {
          requirementConditionOccurrences += 1;
          sheetReqCondOccurrences += 1;
          referencedReqCondIds.add(id);
          sheetReqCondIds.add(id);
        }
        for (const id of rowGroups) {
          conditionGroupOccurrences += 1;
          sheetGroupOccurrences += 1;
          referencedGroupIds.add(id);
          sheetGroupIds.add(id);
        }
        for (const id of rowRequirements) {
          sheetRequirementOccurrences += 1;
          sheetRequirementIds.add(id);
        }

        if (rowRequirements.length > 0 && rowReqConds.length > 0) {
          rowsWithRequirementAndConditionCount += 1;
          sheetRowsReqCond += 1;
          for (const requirementId of rowRequirements) {
            for (const conditionId of rowReqConds) {
              requirementConditionPairs.add(`${requirementId}|${conditionId}`);
            }
          }
        }
        if (rowReqConds.length > 0 && rowApps.length > 0) {
          rowsWithConditionAndApplicationConditionCount += 1;
          sheetRowsCondApp += 1;
          for (const conditionId of rowReqConds) {
            for (const appId of rowApps) {
              conditionApplicationPairs.add(`${conditionId}|${appId}`);
            }
          }
        }
        if (rowApps.length > 0 && rowGroups.length > 0) {
          rowsWithApplicationConditionAndGroupCount += 1;
          sheetRowsAppGroup += 1;
          for (const appId of rowApps) {
            for (const groupId of rowGroups) {
              applicationGroupPairs.add(`${appId}|${groupId}`);
            }
          }
        }
        if (
          rowRequirements.length > 0 &&
          rowReqConds.length > 0 &&
          rowApps.length > 0 &&
          rowGroups.length > 0
        ) {
          rowsWithAllConditionLayersCount += 1;
        }

        if (
          relationshipSamples.length < 16 &&
          (rowReqConds.length > 0 || rowApps.length > 0 || rowGroups.length > 0)
        ) {
          relationshipSamples.push(
            buildSample(
              sheetName,
              rowRequirements[0] ?? null,
              rowReqConds[0] ?? null,
              rowApps[0] ?? null,
              rowGroups[0] ?? null,
              requirementById,
              reqCondById,
              appById,
              groupById,
            ),
          );
        }
      }

      if (
        sheetAppOccurrences > 0 ||
        sheetReqCondOccurrences > 0 ||
        sheetGroupOccurrences > 0
      ) {
        worksheetUsage.push({
          sheetName,
          applicationConditionOccurrences: sheetAppOccurrences,
          applicationConditionObjects: sheetAppIds.size,
          requirementConditionOccurrences: sheetReqCondOccurrences,
          requirementConditionObjects: sheetReqCondIds.size,
          conditionGroupOccurrences: sheetGroupOccurrences,
          conditionGroupObjects: sheetGroupIds.size,
          sourceRequirementOccurrences: sheetRequirementOccurrences,
          sourceRequirementObjects: sheetRequirementIds.size,
          rowsWithRequirementAndCondition: sheetRowsReqCond,
          rowsWithConditionAndApplicationCondition: sheetRowsCondApp,
          rowsWithApplicationConditionAndGroup: sheetRowsAppGroup,
        });
      }
    }

    worksheetUsage.sort((a, b) =>
      (b.applicationConditionOccurrences + b.requirementConditionOccurrences + b.conditionGroupOccurrences) -
        (a.applicationConditionOccurrences + a.requirementConditionOccurrences + a.conditionGroupOccurrences) ||
      a.sheetName.localeCompare(b.sheetName),
    );

    return {
      masterApplicationConditionCount: applicationConditions.length,
      masterRequirementConditionCount: requirementConditions.length,
      masterConditionGroupCount: conditionGroups.length,
      masterSourceRequirementCount: sourceRequirements.length,
      worksheetsScannedCount: sheetNames.length,
      applicationConditionOccurrences,
      referencedApplicationConditionCount: referencedAppIds.size,
      masterOnlyApplicationConditionCount: applicationConditions.length - referencedAppIds.size,
      requirementConditionOccurrences,
      referencedRequirementConditionCount: referencedReqCondIds.size,
      masterOnlyRequirementConditionCount: requirementConditions.length - referencedReqCondIds.size,
      conditionGroupOccurrences,
      referencedConditionGroupCount: referencedGroupIds.size,
      masterOnlyConditionGroupCount: conditionGroups.length - referencedGroupIds.size,
      rowsWithRequirementAndConditionCount,
      distinctRequirementConditionPairCount: requirementConditionPairs.size,
      rowsWithConditionAndApplicationConditionCount,
      distinctConditionApplicationPairCount: conditionApplicationPairs.size,
      rowsWithApplicationConditionAndGroupCount,
      distinctApplicationGroupPairCount: applicationGroupPairs.size,
      rowsWithAllConditionLayersCount,
      worksheetUsage,
      relationshipSamples,
    };
  }
}

function buildSample(
  sheetName: string,
  requirementId: string | null,
  conditionId: string | null,
  appId: string | null,
  groupId: string | null,
  requirementById: Map<string, MasterObject>,
  conditionById: Map<string, MasterObject>,
  appById: Map<string, MasterObject>,
  groupById: Map<string, MasterObject>,
): CfihosApplicationConditionRelationshipSample {
  const requirement = requirementId ? requirementById.get(requirementId) : null;
  const condition = conditionId ? conditionById.get(conditionId) : null;
  const app = appId ? appById.get(appId) : null;
  const group = groupId ? groupById.get(groupId) : null;
  return {
    sheetName,
    sourceRequirementId: requirement?.id ?? null,
    sourceRequirementName: requirement?.name ?? null,
    requirementConditionId: condition?.id ?? null,
    requirementConditionName: condition?.name ?? null,
    applicationConditionId: app?.id ?? null,
    applicationConditionName: app?.name ?? null,
    conditionGroupId: group?.id ?? null,
    conditionGroupName: group?.name ?? null,
  };
}

function masterObjectsForFamily(rows: CfihosWorksheetRow[], family: string): MasterObject[] {
  return rows
    .filter((row) => normalize(row["CFIHOS definition file"]) === family)
    .map((row) => ({
      id: text(row["CFIHOS unique code"]),
      name: text(row["CFIHOS name"]) || text(row["CFIHOS unique code"]),
    }))
    .filter((item) => item.id.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function collectRowIds(row: CfihosWorksheetRow): string[] {
  const ids = new Set<string>();
  for (const value of Object.values(row)) {
    const raw = text(value);
    if (!raw) continue;
    const id = canonicalId(raw);
    if (/^CFIHOS-\d+$/i.test(raw)) ids.add(id);
  }
  return [...ids];
}

function index(items: MasterObject[]): Map<string, MasterObject> {
  return new Map(items.map((item) => [canonicalId(item.id), item]));
}
function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
function normalize(value: unknown): string {
  return text(value).toLowerCase();
}
function canonicalId(value: string): string {
  return value.trim().toUpperCase();
}

export const cfihosApplicationConditionFamilyRepository =
  new CfihosApplicationConditionFamilyRepository();
