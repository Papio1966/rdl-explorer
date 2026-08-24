import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import { cfihosRepository } from "./CfihosRepository";
import { cfihosEquipmentRepository } from "./CfihosEquipmentRepository";
import type {
  CfihosPropertyGrouping,
  CfihosClassPropertyGroupingView,
  CfihosPropertyGroupingDiagnostics,
  CfihosPropertyGroupingGroup,
  CfihosPropertyGroupingPurposeSummary,
} from "../model/propertyGrouping";

const SHEET_NAME = "property groupings";

export class CfihosPropertyGroupingRepository {
  private rows: CfihosPropertyGrouping[] | null = null;
  private loadingPromise: Promise<CfihosPropertyGrouping[]> | null = null;

  async getPropertyGroupings(): Promise<CfihosPropertyGrouping[]> {
    if (this.rows) {
      return this.rows;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.load();
    }

    this.rows = await this.loadingPromise;
    return this.rows;
  }

  async getGroupingsForClass(
    classId: string,
  ): Promise<CfihosClassPropertyGroupingView[]> {
    const groupings = await this.getPropertyGroupings();
    const rows = groupings.filter((row) => row.classId === classId);

    if (rows.length === 0) {
      return [];
    }

    const byPurpose = new Map<string, CfihosPropertyGrouping[]>();

    for (const row of rows) {
      const purposeCode = row.purposeCode ?? "Unspecified";
      const purposeKey = row.purposeId ?? purposeCode;
      const current = byPurpose.get(purposeKey);

      if (current) {
        current.push(row);
      } else {
        byPurpose.set(purposeKey, [row]);
      }
    }

    return [...byPurpose.entries()]
      .map(([purposeKey, purposeRows]) => {
        const first = purposeRows[0];
        const groupsByKey = new Map<string, CfihosPropertyGrouping[]>();

        for (const row of purposeRows) {
          const groupKey =
            row.propertyGroupId ??
            row.propertyGroupCode ??
            row.propertyGroupDescription ??
            "Ungrouped";
          const current = groupsByKey.get(groupKey);

          if (current) {
            current.push(row);
          } else {
            groupsByKey.set(groupKey, [row]);
          }
        }

        const groups: CfihosPropertyGroupingGroup[] = [
          ...groupsByKey.values(),
        ]
          .map((groupRows) => {
            const groupFirst = groupRows[0];
            const sourceStandards = new Map<
              string,
              { id: string; code: string | null }
            >();

            for (const row of groupRows) {
              if (row.sourceStandardId) {
                sourceStandards.set(row.sourceStandardId, {
                  id: row.sourceStandardId,
                  code: row.sourceStandardCode,
                });
              }
            }

            return {
              id: groupFirst.propertyGroupId,
              code: groupFirst.propertyGroupCode,
              description: groupFirst.propertyGroupDescription,
              sourceStandards: [...sourceStandards.values()].sort((a, b) =>
                (a.code ?? a.id).localeCompare(b.code ?? b.id),
              ),
              assignments: [...groupRows].sort(compareGroupingAssignments),
            };
          })
          .sort(comparePropertyGroups);

        return {
          classId,
          purposeId: first?.purposeId ?? null,
          purposeCode: first?.purposeCode ?? purposeKey,
          purposeDescription: first?.purposeDescription ?? null,
          groups,
          assignmentCount: purposeRows.length,
          propertyCount: uniqueNonNull(
            purposeRows.map((row) => row.propertyId),
          ).length,
        };
      })
      .sort((a, b) => a.purposeCode.localeCompare(b.purposeCode));
  }

  async getDiagnostics(): Promise<CfihosPropertyGroupingDiagnostics> {
    const [groupings, tagClasses, equipmentClasses, properties, sourceRows] =
      await Promise.all([
        this.getPropertyGroupings(),
        cfihosRepository.getTagClasses(),
        cfihosEquipmentRepository.getEquipmentClasses(),
        cfihosRepository.getProperties(),
        getCfihosWorksheetRows("source standard"),
      ]);

    const tagIds = new Set(tagClasses.map((item) => item.id));
    const equipmentIds = new Set(equipmentClasses.map((item) => item.id));
    const propertyIds = new Set(properties.map((item) => item.id));
    const sourceStandardIds = new Set(
      sourceRows
        .map((row) => text(row["CFIHOS unique code"]))
        .filter((value): value is string => value !== null),
    );

    const classIds = uniqueNonNull(groupings.map((row) => row.classId));
    const referencedPropertyIds = uniqueNonNull(
      groupings.map((row) => row.propertyId),
    );
    const referencedSourceStandardIds = uniqueNonNull(
      groupings.map((row) => row.sourceStandardId),
    );

    let resolvedTagOnlyClassCount = 0;
    let resolvedEquipmentOnlyClassCount = 0;
    let resolvedInBothClassCount = 0;
    const unresolvedClassIds: string[] = [];

    for (const classId of classIds) {
      const inTag = tagIds.has(classId);
      const inEquipment = equipmentIds.has(classId);

      if (inTag && inEquipment) {
        resolvedInBothClassCount += 1;
      } else if (inTag) {
        resolvedTagOnlyClassCount += 1;
      } else if (inEquipment) {
        resolvedEquipmentOnlyClassCount += 1;
      } else {
        unresolvedClassIds.push(classId);
      }
    }

    const unresolvedPropertyIds = referencedPropertyIds.filter(
      (id) => !propertyIds.has(id),
    );
    const unresolvedSourceStandardIds = referencedSourceStandardIds.filter(
      (id) => !sourceStandardIds.has(id),
    );

    const semanticAssignments = new Set<string>();
    let duplicateAssignmentCount = 0;

    for (const row of groupings) {
      const key = [
        row.purposeId ?? row.purposeCode ?? "",
        row.propertyGroupId ?? row.propertyGroupCode ?? "",
        row.classId ?? "",
        row.propertyId ?? "",
      ].join("|");

      if (semanticAssignments.has(key)) {
        duplicateAssignmentCount += 1;
      } else {
        semanticAssignments.add(key);
      }
    }

    const purposes = buildPurposeSummaries(groupings);
    const sequencedRowCount = groupings.filter(
      (row) => row.sequenceNumber !== null,
    ).length;

    const rawRows = await getCfihosWorksheetRows(SHEET_NAME);
    const invalidSequenceCount = rawRows.filter((row) => {
      const raw = text(row["property sequence number"]);
      return raw !== null && parseSequence(raw) === null;
    }).length;

    return {
      sourceRowCount: groupings.length,
      uniqueAssignmentCount: semanticAssignments.size,
      duplicateAssignmentCount,
      purposeCount: purposes.length,
      propertyGroupCount: uniqueNonNull(
        groupings.map((row) => row.propertyGroupId ?? row.propertyGroupCode),
      ).length,
      classReferenceCount: classIds.length,
      propertyReferenceCount: referencedPropertyIds.length,
      resolvedTagOnlyClassCount,
      resolvedEquipmentOnlyClassCount,
      resolvedInBothClassCount,
      unresolvedClassCount: unresolvedClassIds.length,
      resolvedPropertyReferenceCount:
        referencedPropertyIds.length - unresolvedPropertyIds.length,
      unresolvedPropertyReferenceCount: unresolvedPropertyIds.length,
      sourceStandardReferenceCount: referencedSourceStandardIds.length,
      missingSourceStandardReferenceCount: groupings.filter(
        (row) => !row.sourceStandardId,
      ).length,
      resolvedSourceStandardReferenceCount:
        referencedSourceStandardIds.length - unresolvedSourceStandardIds.length,
      unresolvedSourceStandardReferenceCount:
        unresolvedSourceStandardIds.length,
      sequencedRowCount,
      unsequencedRowCount: groupings.length - sequencedRowCount,
      invalidSequenceCount,
      purposes,
      unresolvedClassIds: unresolvedClassIds.sort(),
      unresolvedPropertyIds: unresolvedPropertyIds.sort(),
      unresolvedSourceStandardIds: unresolvedSourceStandardIds.sort(),
    };
  }

  private async load(): Promise<CfihosPropertyGrouping[]> {
    const rows = await getCfihosWorksheetRows(SHEET_NAME);
    return rows.map(parseRow);
  }
}

function parseRow(row: CfihosWorksheetRow): CfihosPropertyGrouping {
  return {
    allowedForPurposeId: text(
      row["property group allowed for purpose CFIHOS unique code"],
    ),
    purposeId: text(
      row["property grouping or decomposition purpose CFIHOS unique code"],
    ),
    purposeCode: text(row["property grouping purpose code"]),
    purposeDescription: text(row["property grouping purpose description"]),
    sourceStandardId: text(row["source standard CFIHOS unique code"]),
    sourceStandardCode: text(row["source standard code"]),
    propertyGroupId: text(row["property group CFIHOS unique code"]),
    propertyGroupCode: text(row["property group code"]),
    propertyGroupDescription: text(row["property group description"]),
    assignmentId: text(
      row["property to group assignment CFIHOS unique code"],
    ),
    classId: text(row["tag or equipment class CFIHOS unique code"]),
    className: text(row["tag or equipment class name"]),
    propertyId: text(row["property CFIHOS unique code"]),
    propertyName: text(row["property name"]),
    sequenceNumber: parseSequence(row["property sequence number"]),
  };
}

function buildPurposeSummaries(
  rows: CfihosPropertyGrouping[],
): CfihosPropertyGroupingPurposeSummary[] {
  const byPurpose = new Map<
    string,
    {
      purposeId: string | null;
      purposeCode: string;
      purposeDescription: string | null;
      rows: CfihosPropertyGrouping[];
    }
  >();

  for (const row of rows) {
    const purposeCode = row.purposeCode ?? "Unspecified";
    const key = row.purposeId ?? purposeCode;
    const current = byPurpose.get(key);

    if (current) {
      current.rows.push(row);
    } else {
      byPurpose.set(key, {
        purposeId: row.purposeId,
        purposeCode,
        purposeDescription: row.purposeDescription,
        rows: [row],
      });
    }
  }

  return [...byPurpose.values()]
    .map((item) => ({
      purposeId: item.purposeId,
      purposeCode: item.purposeCode,
      purposeDescription: item.purposeDescription,
      rowCount: item.rows.length,
      groupCount: uniqueNonNull(
        item.rows.map((row) => row.propertyGroupId ?? row.propertyGroupCode),
      ).length,
      classCount: uniqueNonNull(item.rows.map((row) => row.classId)).length,
      propertyCount: uniqueNonNull(item.rows.map((row) => row.propertyId)).length,
    }))
    .sort((a, b) => a.purposeCode.localeCompare(b.purposeCode));
}


function comparePropertyGroups(
  a: CfihosPropertyGroupingGroup,
  b: CfihosPropertyGroupingGroup,
): number {
  const aLabel = a.code ?? a.description ?? a.id ?? "";
  const bLabel = b.code ?? b.description ?? b.id ?? "";
  return aLabel.localeCompare(bLabel, undefined, { sensitivity: "base" });
}

function compareGroupingAssignments(
  a: CfihosPropertyGrouping,
  b: CfihosPropertyGrouping,
): number {
  if (a.sequenceNumber !== null && b.sequenceNumber !== null) {
    return a.sequenceNumber - b.sequenceNumber;
  }

  if (a.sequenceNumber !== null) {
    return -1;
  }

  if (b.sequenceNumber !== null) {
    return 1;
  }

  return (a.propertyName ?? a.propertyId ?? "").localeCompare(
    b.propertyName ?? b.propertyId ?? "",
    undefined,
    { sensitivity: "base" },
  );
}

function uniqueNonNull(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function parseSequence(value: unknown): number | null {
  const normalized = text(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export const cfihosPropertyGroupingRepository =
  new CfihosPropertyGroupingRepository();
