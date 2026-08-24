import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosConditionModelSemanticAuditDiagnostics,
  CfihosConditionSemanticObject,
  CfihosConditionSemanticTerm,
} from "../model/conditionModelSemanticAudit";

const MASTER_SHEET = "RDL master object";
const APPLICATION_CONDITION_FAMILY = "application condition";
const REQUIREMENT_CONDITION_FAMILY =
  "source standard document and data requirement condition";
const CONDITION_GROUP_FAMILY = "application condition group";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "if", "in", "is", "it", "no", "not", "of", "on", "or", "the", "to",
  "with", "without", "when", "where", "which", "yes",
]);

export class CfihosConditionModelSemanticAuditRepository {
  private diagnostics: CfihosConditionModelSemanticAuditDiagnostics | null = null;
  private loadingPromise: Promise<CfihosConditionModelSemanticAuditDiagnostics> | null = null;

  async getDiagnostics(): Promise<CfihosConditionModelSemanticAuditDiagnostics> {
    if (this.diagnostics) return this.diagnostics;
    if (!this.loadingPromise) this.loadingPromise = this.buildDiagnostics();
    try {
      this.diagnostics = await this.loadingPromise;
      return this.diagnostics;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildDiagnostics(): Promise<CfihosConditionModelSemanticAuditDiagnostics> {
    const masterRows = await getCfihosWorksheetRows(MASTER_SHEET);
    const applicationConditions = masterObjectsForFamily(masterRows, APPLICATION_CONDITION_FAMILY);
    const requirementConditions = masterObjectsForFamily(masterRows, REQUIREMENT_CONDITION_FAMILY);
    const conditionGroups = masterObjectsForFamily(masterRows, CONDITION_GROUP_FAMILY);

    const applicationVocabulary = vocabulary(applicationConditions);
    const groupVocabulary = vocabulary(conditionGroups);

    return {
      applicationConditionCount: applicationConditions.length,
      requirementConditionCount: requirementConditions.length,
      conditionGroupCount: conditionGroups.length,
      totalConditionObjectCount:
        applicationConditions.length + requirementConditions.length + conditionGroups.length,

      applicationConditionsWithDescriptionCount: withDescriptions(applicationConditions),
      requirementConditionsWithDescriptionCount: withDescriptions(requirementConditions),
      conditionGroupsWithDescriptionCount: withDescriptions(conditionGroups),
      duplicateApplicationConditionNameCount: duplicateNameCount(applicationConditions),
      duplicateRequirementConditionNameCount: duplicateNameCount(requirementConditions),
      duplicateConditionGroupNameCount: duplicateNameCount(conditionGroups),

      requirementConditionsSharingApplicationVocabularyCount: countObjectsSharingVocabulary(
        requirementConditions,
        applicationVocabulary,
      ),
      applicationConditionsSharingGroupVocabularyCount: countObjectsSharingVocabulary(
        applicationConditions,
        groupVocabulary,
      ),

      applicationConditionTopTerms: topTerms(applicationConditions),
      requirementConditionTopTerms: topTerms(requirementConditions),
      conditionGroupTopTerms: topTerms(conditionGroups),

      applicationConditionSamples: representativeSamples(applicationConditions, 14),
      requirementConditionSamples: representativeSamples(requirementConditions, 14),
      conditionGroupSamples: representativeSamples(conditionGroups, 10),
    };
  }
}

function masterObjectsForFamily(
  rows: CfihosWorksheetRow[],
  family: string,
): CfihosConditionSemanticObject[] {
  return rows
    .filter((row) => normalize(row["CFIHOS definition file"]) === family)
    .map((row) => ({
      id: text(row["CFIHOS unique code"]),
      name: text(row["CFIHOS name"]) || text(row["CFIHOS unique code"]),
      description: text(row["CFIHOS description"]) || null,
    }))
    .filter((item) => item.id.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function representativeSamples(
  items: CfihosConditionSemanticObject[],
  limit: number,
): CfihosConditionSemanticObject[] {
  if (items.length <= limit) return items;
  const result: CfihosConditionSemanticObject[] = [];
  const used = new Set<number>();
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round((i * (items.length - 1)) / (limit - 1));
    if (!used.has(index)) {
      used.add(index);
      result.push(items[index]);
    }
  }
  return result;
}

function topTerms(items: CfihosConditionSemanticObject[]): CfihosConditionSemanticTerm[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const objectTerms = new Set(tokens(`${item.name} ${item.description ?? ""}`));
    for (const term of objectTerms) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 16);
}

function vocabulary(items: CfihosConditionSemanticObject[]): Set<string> {
  const result = new Set<string>();
  for (const item of items) {
    for (const term of tokens(`${item.name} ${item.description ?? ""}`)) result.add(term);
  }
  return result;
}

function countObjectsSharingVocabulary(
  items: CfihosConditionSemanticObject[],
  targetVocabulary: Set<string>,
): number {
  return items.filter((item) =>
    tokens(`${item.name} ${item.description ?? ""}`).some((term) => targetVocabulary.has(term)),
  ).length;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term) && !/^\d+$/.test(term));
}

function duplicateNameCount(items: CfihosConditionSemanticObject[]): number {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
}

function withDescriptions(items: CfihosConditionSemanticObject[]): number {
  return items.filter((item) => Boolean(item.description?.trim())).length;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
function normalize(value: unknown): string {
  return text(value).toLowerCase();
}

export const cfihosConditionModelSemanticAuditRepository =
  new CfihosConditionModelSemanticAuditRepository();
