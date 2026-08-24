import {
  getCfihosWorksheetRows,
  type CfihosWorksheetRow,
} from "../workbook";
import {
  normalizeOptionalString,
  normalizeRequiredString,
} from "../model/common";
import type {
  CfihosUnitDimensionExpressionIssue,
  CfihosUnitDimensionIdentifierReconciliationDiagnostics,
} from "../model/unitDimensionIdentifierReconciliation";

const MASTER_SHEET = "RDL master object";
const UNIT_SHEET = "unit of measure";
const DIMENSION_FAMILY = "unit of measure dimension";

type MasterObject = {
  id: string;
  name: string;
  family: string | null;
};

type UnitDimensionUse = {
  expression: string;
  dimensionCodeExpression: string | null;
  dimensionNameExpression: string | null;
  unitName: string;
};

export class CfihosUnitDimensionIdentifierReconciliationRepository {
  private diagnostics: CfihosUnitDimensionIdentifierReconciliationDiagnostics | null = null;

  async getDiagnostics(): Promise<CfihosUnitDimensionIdentifierReconciliationDiagnostics> {
    if (!this.diagnostics) {
      this.diagnostics = await this.loadDiagnostics();
    }
    return this.diagnostics;
  }

  private async loadDiagnostics(): Promise<CfihosUnitDimensionIdentifierReconciliationDiagnostics> {
    const [masterRows, unitRows] = await Promise.all([
      getCfihosWorksheetRows(MASTER_SHEET),
      getCfihosWorksheetRows(UNIT_SHEET),
    ]);

    const masterObjects: MasterObject[] = masterRows
      .map((row) => ({
        id: normalizeRequiredString(row["CFIHOS unique code"]),
        name: normalizeRequiredString(row["CFIHOS name"]),
        family: normalizeOptionalString(row["CFIHOS definition file"]),
      }))
      .filter((item) => item.id.length > 0);

    const canonicalDimensions = masterObjects.filter(
      (item) => key(item.family) === DIMENSION_FAMILY,
    );
    const canonicalById = new Map(
      canonicalDimensions.map((item) => [key(item.id), item]),
    );

    const uses: UnitDimensionUse[] = unitRows
      .map((row) => ({
        expression:
          first(row, [
            "unit of measure dimension code CFIHOS unique code",
            "unit of measure dimension CFIHOS unique code",
          ]) ?? "",
        dimensionCodeExpression: first(row, ["unit of measure dimension code"]),
        dimensionNameExpression: first(row, ["unit of measure dimension name"]),
        unitName:
          first(row, ["unit of measure name"]) ??
          first(row, ["CFIHOS unique code", "unit of measure CFIHOS unique code"]) ??
          "(unnamed unit)",
      }))
      .filter((item) => item.expression.length > 0);

    const byExpression = groupBy(uses, (item) => key(item.expression));

    const issues: CfihosUnitDimensionExpressionIssue[] = [...byExpression.values()]
      .map((rows) => {
        const firstUse = rows[0];
        const componentIds = splitExpression(firstUse.expression);
        const dimensionCodes = splitExpression(
          mostCommon(rows.map((item) => item.dimensionCodeExpression)) ?? "",
        );
        const dimensionNames = splitExpression(
          mostCommon(rows.map((item) => item.dimensionNameExpression)) ?? "",
        );
        const resolvedComponentIds = componentIds.filter((id) =>
          canonicalById.has(key(id)),
        );
        const unresolvedComponentIds = componentIds.filter(
          (id) => !canonicalById.has(key(id)),
        );

        let classification: CfihosUnitDimensionExpressionIssue["classification"];
        if (componentIds.length > 1) {
          classification =
            unresolvedComponentIds.length === 0
              ? "compound-resolved"
              : "compound-partial";
        } else {
          classification =
            unresolvedComponentIds.length === 0
              ? "atomic-canonical"
              : "atomic-unresolved";
        }

        return {
          expression: firstUse.expression,
          dimensionCodes,
          dimensionNames,
          componentIds,
          resolvedComponentIds,
          unresolvedComponentIds,
          unitCount: rows.length,
          sampleUnits: unique(rows.map((item) => item.unitName)).slice(0, 6),
          classification,
        };
      })
      .sort(
        (a, b) =>
          classificationOrder(a.classification) - classificationOrder(b.classification) ||
          b.unitCount - a.unitCount ||
          a.expression.localeCompare(b.expression),
      );

    const distinctComponentIds = unique(
      issues.flatMap((item) => item.componentIds).map((id) => key(id)),
    ).filter(Boolean);
    const resolvedComponentIds = distinctComponentIds.filter((id) =>
      canonicalById.has(id),
    );
    const unresolvedComponentIds = distinctComponentIds.filter(
      (id) => !canonicalById.has(id),
    );

    return {
      unitCount: unitRows.length,
      rawExpressionCount: byExpression.size,
      canonicalMasterDimensionCount: canonicalDimensions.length,
      atomicExpressionCount: issues.filter((item) => item.componentIds.length === 1).length,
      compoundExpressionCount: issues.filter((item) => item.componentIds.length > 1).length,
      unitsUsingCompoundExpressionCount: issues
        .filter((item) => item.componentIds.length > 1)
        .reduce((sum, item) => sum + item.unitCount, 0),
      distinctComponentIdCount: distinctComponentIds.length,
      resolvedComponentIdCount: resolvedComponentIds.length,
      unresolvedComponentIdCount: unresolvedComponentIds.length,
      fullyResolvedCompoundExpressionCount: issues.filter(
        (item) => item.classification === "compound-resolved",
      ).length,
      partiallyResolvedCompoundExpressionCount: issues.filter(
        (item) => item.classification === "compound-partial",
      ).length,
      unresolvedAtomicExpressionCount: issues.filter(
        (item) => item.classification === "atomic-unresolved",
      ).length,
      issues,
    };
  }
}

function first(row: CfihosWorksheetRow, names: string[]): string | null {
  for (const name of names) {
    const value = normalizeOptionalString(row[name]);
    if (value) return value;
  }
  return null;
}

function splitExpression(value: string): string[] {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function key(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function groupBy<T>(items: T[], selector: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = selector(item);
    const current = result.get(groupKey) ?? [];
    current.push(item);
    result.set(groupKey, current);
  }
  return result;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mostCommon(values: Array<string | null>): string | null {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of values) {
    if (!value) continue;
    const normalized = key(value);
    const current = counts.get(normalized) ?? { value, count: 0 };
    current.count += 1;
    counts.set(normalized, current);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  )[0]?.value ?? null;
}

function classificationOrder(
  value: CfihosUnitDimensionExpressionIssue["classification"],
): number {
  switch (value) {
    case "compound-partial":
      return 0;
    case "atomic-unresolved":
      return 1;
    case "compound-resolved":
      return 2;
    case "atomic-canonical":
      return 3;
  }
}

export const cfihosUnitDimensionIdentifierReconciliationRepository =
  new CfihosUnitDimensionIdentifierReconciliationRepository();
