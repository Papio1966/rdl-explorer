import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import type {
  CfihosJip33Requirement,
  CfihosJip33RequirementDiagnostics,
  CfihosJip33RequirementMapping,
  CfihosJip33RequirementSummary,
} from "../model/jip33Requirement";

const SHEET = "Jip33 info required spec";

type Jip33State = {
  requirements: CfihosJip33Requirement[];
  byTagClassId: Map<string, CfihosJip33Requirement[]>;
  byDocumentTypeId: Map<string, CfihosJip33Requirement[]>;
  bySourceStandardId: Map<string, CfihosJip33Requirement[]>;
  summary: CfihosJip33RequirementSummary;
};

function text(row: CfihosWorksheetRow, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result.length > 0 ? result : null;
}

function populated(row: CfihosWorksheetRow, key: string): boolean {
  return text(row, key) !== null;
}

function requiredText(
  row: CfihosWorksheetRow,
  key: string,
  rowNumber: number,
): string {
  const value = text(row, key);
  if (!value) {
    throw new Error(
      `JIP33 worksheet row ${rowNumber} is missing required column value "${key}".`,
    );
  }
  return value;
}

function uniqueNonNull(values: Array<string | null>): Set<string> {
  return new Set(values.filter((value): value is string => Boolean(value)));
}

function counts(values: Array<string | null>) {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function firstNonNull<T>(values: Array<T | null>): T | null {
  return values.find((value): value is T => value !== null) ?? null;
}

function addToIndex(
  index: Map<string, Set<string>>,
  key: string,
  requirementId: string,
) {
  const existing = index.get(key) ?? new Set<string>();
  existing.add(requirementId);
  index.set(key, existing);
}

export class CfihosJip33RequirementRepository {
  private state: Jip33State | null = null;
  private loadingPromise: Promise<Jip33State> | null = null;

  async getRequirements(): Promise<CfihosJip33Requirement[]> {
    const state = await this.getState();
    return state.requirements;
  }

  async getRequirement(id: string): Promise<CfihosJip33Requirement | null> {
    const state = await this.getState();
    return state.requirements.find((item) => item.id === id) ?? null;
  }

  async getRequirementsForTagClass(
    tagClassId: string,
  ): Promise<CfihosJip33Requirement[]> {
    const state = await this.getState();
    return state.byTagClassId.get(tagClassId) ?? [];
  }

  async getRequirementsForDocumentType(
    documentTypeId: string,
  ): Promise<CfihosJip33Requirement[]> {
    const state = await this.getState();
    return state.byDocumentTypeId.get(documentTypeId) ?? [];
  }

  async getRequirementsForSourceStandard(
    sourceStandardId: string,
  ): Promise<CfihosJip33Requirement[]> {
    const state = await this.getState();
    return state.bySourceStandardId.get(sourceStandardId) ?? [];
  }

  async getSummary(): Promise<CfihosJip33RequirementSummary> {
    const state = await this.getState();
    return state.summary;
  }

  async getDiagnostics(): Promise<CfihosJip33RequirementDiagnostics> {
    const [rows, tagRows, sourceRows, disciplineRows, documentRows, classDocumentRows] =
      await Promise.all([
        getCfihosWorksheetRows(SHEET),
        getCfihosWorksheetRows("tag class"),
        getCfihosWorksheetRows("source standard"),
        getCfihosWorksheetRows("discipline"),
        getCfihosWorksheetRows("document type"),
        getCfihosWorksheetRows("document required per class"),
      ]);

    const tagIds = uniqueNonNull(tagRows.map((r) => text(r, "CFIHOS unique code")));
    const sourceIds = uniqueNonNull(sourceRows.map((r) => text(r, "CFIHOS unique code")));
    const disciplineIds = uniqueNonNull(
      disciplineRows.map((r) => text(r, "CFIHOS unique code")),
    );
    const documentIds = uniqueNonNull(
      documentRows.map((r) => text(r, "CFIHOS unique code")),
    );

    const requirementIds = rows.map((r) =>
      text(r, "Source standard document and data requirement CFIHOS unique code"),
    );
    const requirementIdCounts = new Map<string, number>();
    for (const id of requirementIds) {
      if (id) requirementIdCounts.set(id, (requirementIdCounts.get(id) ?? 0) + 1);
    }

    const tagRefs = rows.map((r) => text(r, "tag class CFIHOS unique code"));
    const sourceRefs = rows.map((r) => text(r, "source standard CFIHOS unique code"));
    const disciplineRefs = rows.map((r) => text(r, "discipline CFIHOS unique code"));
    const documentRefs = rows.map((r) => text(r, "document type CFIHOS unique code"));

    const unresolvedTagClassIds = [
      ...uniqueNonNull(tagRefs.filter((id) => id !== null && !tagIds.has(id))),
    ].sort();
    const unresolvedSourceStandardIds = [
      ...uniqueNonNull(sourceRefs.filter((id) => id !== null && !sourceIds.has(id))),
    ].sort();
    const unresolvedDisciplineIds = [
      ...uniqueNonNull(
        disciplineRefs.filter((id) => id !== null && !disciplineIds.has(id)),
      ),
    ].sort();
    const unresolvedDocumentTypeIds = [
      ...uniqueNonNull(documentRefs.filter((id) => id !== null && !documentIds.has(id))),
    ].sort();

    const jip33ClassDocument = new Set<string>();
    for (const row of rows) {
      const classId = text(row, "tag class CFIHOS unique code");
      const documentId = text(row, "document type CFIHOS unique code");
      if (classId && documentId) jip33ClassDocument.add(`${classId}|${documentId}`);
    }

    const requiredClassDocument = new Set<string>();
    for (const row of classDocumentRows) {
      const classId = text(row, "tag or equipment class CFIHOS unique code");
      const documentId = text(row, "document type CFIHOS unique code");
      if (classId && documentId) requiredClassDocument.add(`${classId}|${documentId}`);
    }

    let overlappingClassDocumentCombinationCount = 0;
    for (const key of jip33ClassDocument) {
      if (requiredClassDocument.has(key)) overlappingClassDocumentCombinationCount += 1;
    }

    const requirementTypes = rows.map((r) =>
      text(r, "document and data requirement type code"),
    );
    const requirementGroups = rows.map((r) =>
      text(r, "document and data requirement group code"),
    );

    return {
      sourceRowCount: rows.length,
      uniqueRequirementIdCount: requirementIdCounts.size,
      duplicateRequirementIdCount: [...requirementIdCounts.values()].filter(
        (count) => count > 1,
      ).length,
      tagClassCount: uniqueNonNull(tagRefs).size,
      sourceStandardCount: uniqueNonNull(sourceRefs).size,
      disciplineCount: uniqueNonNull(disciplineRefs).size,
      documentTypeCount: uniqueNonNull(documentRefs).size,
      requirementTypeCount: uniqueNonNull(requirementTypes).size,
      requirementGroupCount: uniqueNonNull(requirementGroups).size,
      resolvedTagClassReferenceCount: tagRefs.filter(
        (id) => id !== null && tagIds.has(id),
      ).length,
      unresolvedTagClassReferenceCount: tagRefs.filter(
        (id) => id !== null && !tagIds.has(id),
      ).length,
      resolvedSourceStandardReferenceCount: sourceRefs.filter(
        (id) => id !== null && sourceIds.has(id),
      ).length,
      unresolvedSourceStandardReferenceCount: sourceRefs.filter(
        (id) => id !== null && !sourceIds.has(id),
      ).length,
      resolvedDisciplineReferenceCount: disciplineRefs.filter(
        (id) => id !== null && disciplineIds.has(id),
      ).length,
      unresolvedDisciplineReferenceCount: disciplineRefs.filter(
        (id) => id !== null && !disciplineIds.has(id),
      ).length,
      resolvedDocumentTypeReferenceCount: documentRefs.filter(
        (id) => id !== null && documentIds.has(id),
      ).length,
      unresolvedDocumentTypeReferenceCount: documentRefs.filter(
        (id) => id !== null && !documentIds.has(id),
      ).length,
      classDocumentCombinationCount: jip33ClassDocument.size,
      overlappingClassDocumentCombinationCount,
      additionalClassDocumentCombinationCount:
        jip33ClassDocument.size - overlappingClassDocumentCombinationCount,
      proposalSubmissionCount: rows.filter((r) =>
        populated(r, "default submit at proposal indicator"),
      ).length,
      reviewSubmissionCount: rows.filter((r) =>
        populated(r, "default submit for review indicator"),
      ).length,
      deliverySubmissionCount: rows.filter((r) =>
        populated(r, "default submit at delivery indicator"),
      ).length,
      reviewTimingCount: rows.filter(
        (r) =>
          populated(r, "default issue for review number of weeks") ||
          populated(r, "default issue for review reference date"),
      ).length,
      approvalTimingCount: rows.filter(
        (r) =>
          populated(r, "default issue for approval number of weeks") ||
          populated(r, "default issue for approval reference date"),
      ).length,
      informationTimingCount: rows.filter(
        (r) =>
          populated(r, "default for information number of weeks") ||
          populated(r, "default for information reference date"),
      ).length,
      handoverStatusCount: rows.filter((r) =>
        populated(r, "default required handover status code"),
      ).length,
      translationIndicatorCount: rows.filter((r) =>
        populated(r, "default required translation indicator"),
      ).length,
      deliverableFormatCount: rows.filter((r) =>
        populated(r, "deliverable format code"),
      ).length,
      unresolvedTagClassIds,
      unresolvedSourceStandardIds,
      unresolvedDisciplineIds,
      unresolvedDocumentTypeIds,
      requirementTypes: counts(requirementTypes),
      requirementGroups: counts(requirementGroups),
    };
  }

  private async getState(): Promise<Jip33State> {
    if (this.state) return this.state;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.buildState();
    try {
      this.state = await this.loadingPromise;
      return this.state;
    } finally {
      this.loadingPromise = null;
    }
  }

  private async buildState(): Promise<Jip33State> {
    const rows = await getCfihosWorksheetRows(SHEET);

    const requirementRows = new Map<string, CfihosWorksheetRow[]>();
    const tagIndex = new Map<string, Set<string>>();
    const documentIndex = new Map<string, Set<string>>();
    const standardIndex = new Map<string, Set<string>>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const requirementId = requiredText(
        row,
        "Source standard document and data requirement CFIHOS unique code",
        rowNumber,
      );
      const tagClassId = requiredText(
        row,
        "tag class CFIHOS unique code",
        rowNumber,
      );
      const documentTypeId = requiredText(
        row,
        "document type CFIHOS unique code",
        rowNumber,
      );
      const sourceStandardId = requiredText(
        row,
        "source standard CFIHOS unique code",
        rowNumber,
      );

      const existing = requirementRows.get(requirementId) ?? [];
      existing.push(row);
      requirementRows.set(requirementId, existing);

      addToIndex(tagIndex, tagClassId, requirementId);
      addToIndex(documentIndex, documentTypeId, requirementId);
      addToIndex(standardIndex, sourceStandardId, requirementId);
    });

    const requirements = [...requirementRows.entries()]
      .map(([id, groupedRows]): CfihosJip33Requirement => {
        const mappings: CfihosJip33RequirementMapping[] = groupedRows.map(
          (row, index) => ({
            requirementId: id,
            tagClassId: requiredText(
              row,
              "tag class CFIHOS unique code",
              index + 2,
            ),
            tagClassName: requiredText(row, "tag class name", index + 2),
            sourceStandardId: requiredText(
              row,
              "source standard CFIHOS unique code",
              index + 2,
            ),
            sourceStandardCode: text(row, "source standard code"),
            disciplineId: text(row, "discipline CFIHOS unique code"),
            disciplineName: text(row, "discipline name"),
            documentTypeId: requiredText(
              row,
              "document type CFIHOS unique code",
              index + 2,
            ),
            documentTypeName: requiredText(row, "document type name", index + 2),
            submitAtProposal: text(row, "default submit at proposal indicator"),
            submitForReview: text(row, "default submit for review indicator"),
            submitAtDelivery: text(row, "default submit at delivery indicator"),
            issueForReviewNumberOfWeeks: text(
              row,
              "default issue for review number of weeks",
            ),
            issueForReviewReferenceDate: text(
              row,
              "default issue for review reference date",
            ),
            issueForApprovalNumberOfWeeks: text(
              row,
              "default issue for approval number of weeks",
            ),
            issueForApprovalReferenceDate: text(
              row,
              "default issue for approval reference date",
            ),
            forInformationNumberOfWeeks: text(
              row,
              "default for information number of weeks",
            ),
            forInformationReferenceDate: text(
              row,
              "default for information reference date",
            ),
            requiredHandoverStatusCode: text(
              row,
              "default required handover status code",
            ),
            requiredTranslationIndicator: text(
              row,
              "default required translation indicator",
            ),
            deliverableFormatCode: text(row, "deliverable format code"),
          }),
        );

        return {
          id,
          number: firstNonNull(
            groupedRows.map((row) =>
              text(row, "source standard document and data requirement number"),
            ),
          ),
          title: firstNonNull(
            groupedRows.map((row) =>
              text(row, "source standard document and data requirement title"),
            ),
          ),
          typicalDeliverable: firstNonNull(
            groupedRows.map((row) =>
              text(
                row,
                "source standard document and data requirement typical deliverable",
              ),
            ),
          ),
          description: firstNonNull(
            groupedRows.map((row) =>
              text(
                row,
                "source standard document and data requirement description",
              ),
            ),
          ),
          comment: firstNonNull(
            groupedRows.map((row) =>
              text(row, "source standard document and data requirement comment"),
            ),
          ),
          requirementTypeCode: firstNonNull(
            groupedRows.map((row) =>
              text(row, "document and data requirement type code"),
            ),
          ),
          requirementGroupCode: firstNonNull(
            groupedRows.map((row) =>
              text(row, "document and data requirement group code"),
            ),
          ),
          engineeringStandardSourceChapter: firstNonNull(
            groupedRows.map((row) =>
              text(row, "engineering standard source chapter"),
            ),
          ),
          mappings,
        };
      })
      .sort((a, b) =>
        (a.number ?? a.title ?? a.id).localeCompare(b.number ?? b.title ?? b.id),
      );

    const byId = new Map(requirements.map((item) => [item.id, item]));
    const resolveIndex = (index: Map<string, Set<string>>) =>
      new Map(
        [...index.entries()].map(([key, ids]) => [
          key,
          [...ids]
            .map((id) => byId.get(id))
            .filter((item): item is CfihosJip33Requirement => Boolean(item)),
        ]),
      );

    return {
      requirements,
      byTagClassId: resolveIndex(tagIndex),
      byDocumentTypeId: resolveIndex(documentIndex),
      bySourceStandardId: resolveIndex(standardIndex),
      summary: {
        requirementCount: requirements.length,
        mappingCount: rows.length,
        tagClassCount: tagIndex.size,
        sourceStandardCount: standardIndex.size,
        documentTypeCount: documentIndex.size,
        requirementGroupCount: new Set(
          requirements
            .map((item) => item.requirementGroupCode)
            .filter((value): value is string => Boolean(value)),
        ).size,
      },
    };
  }
}

export const cfihosJip33RequirementRepository =
  new CfihosJip33RequirementRepository();
