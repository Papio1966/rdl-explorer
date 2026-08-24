export type CfihosDimensionUsageSample = {
  id: string;
  name: string;
  description: string | null;
  propertyCount: number;
  unitCount: number;
};

export type CfihosUnitOfMeasureDimensionFamilyDiagnostics = {
  masterDimensionCount: number;
  uniqueMasterDimensionIdCount: number;
  duplicateMasterDimensionIdCount: number;
  propertyCount: number;
  propertiesWithDimensionCount: number;
  uniquePropertyDimensionCount: number;
  resolvedPropertyDimensionCount: number;
  unresolvedPropertyDimensionCount: number;
  unitCount: number;
  unitsWithDimensionCount: number;
  uniqueUnitDimensionCount: number;
  resolvedUnitDimensionCount: number;
  unresolvedUnitDimensionCount: number;
  referencedMasterDimensionCount: number;
  masterOnlyDimensionCount: number;
  propertyOnlyDimensionCount: number;
  unitOnlyDimensionCount: number;
  dimensionsUsedByBothCount: number;
  masterCoveragePercent: number;
  unresolvedPropertyDimensionIds: string[];
  unresolvedUnitDimensionIds: string[];
  masterOnlyDimensions: CfihosDimensionUsageSample[];
  representativeDimensions: CfihosDimensionUsageSample[];
};
