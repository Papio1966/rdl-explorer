export type CfihosUnitDimensionExpressionIssue = {
  expression: string;
  dimensionCodes: string[];
  dimensionNames: string[];
  componentIds: string[];
  resolvedComponentIds: string[];
  unresolvedComponentIds: string[];
  unitCount: number;
  sampleUnits: string[];
  classification:
    | "atomic-canonical"
    | "compound-resolved"
    | "compound-partial"
    | "atomic-unresolved";
};

export type CfihosUnitDimensionIdentifierReconciliationDiagnostics = {
  unitCount: number;
  rawExpressionCount: number;
  canonicalMasterDimensionCount: number;
  atomicExpressionCount: number;
  compoundExpressionCount: number;
  unitsUsingCompoundExpressionCount: number;
  distinctComponentIdCount: number;
  resolvedComponentIdCount: number;
  unresolvedComponentIdCount: number;
  fullyResolvedCompoundExpressionCount: number;
  partiallyResolvedCompoundExpressionCount: number;
  unresolvedAtomicExpressionCount: number;
  issues: CfihosUnitDimensionExpressionIssue[];
};
