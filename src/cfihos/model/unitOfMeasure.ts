export type CfihosUnitOfMeasure = {
  id: string;
  uneceCommonCode: string | null;
  name: string;
  symbol: string | null;

  dimensionId: string | null;
  dimensionCode: string | null;
  dimensionName: string | null;

  systemId: string | null;
  systemCode: string | null;
  systemName: string | null;

  synonyms: string[];
};

export type CfihosUnitOfMeasureDiagnostics = {
  sourceUnitCount: number;
  uniqueUnitIdCount: number;
  duplicateUnitIdCount: number;
  duplicateUnitNameCount: number;

  dimensionCount: number;
  measurementSystemCount: number;

  missingSymbolCount: number;
  missingUneceCodeCount: number;

  tagSiReferenceCount: number;
  tagImperialReferenceCount: number;
  equipmentSiReferenceCount: number;
  equipmentImperialReferenceCount: number;

  resolvedUnitReferenceCount: number;
  unresolvedUnitReferenceCount: number;
  unresolvedUnitIds: string[];

  propertyDimensionReferenceCount: number;
  resolvedPropertyDimensionReferenceCount: number;
  unresolvedPropertyDimensionReferenceCount: number;
  unresolvedDimensionIds: string[];
};
