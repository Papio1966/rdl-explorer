import type { CfihosUnitReference } from "./common";

export type CfihosProperty = {
  id: string;
  name: string;
  definition: string | null;

  dataType: string | null;
  dataTypeLength: string | null;

  unitOfMeasureDimensionId: string | null;
  unitOfMeasureDimensionCode: string | null;

  picklistId: string | null;
  picklistName: string | null;

  existenceReason: string | null;

  synonyms: string[];
};

export type CfihosTagClassProperty = {
  tagClassId: string;
  tagClassName: string;

  propertyId: string;
  propertyName: string;

  siUnit: CfihosUnitReference;
  imperialUnit: CfihosUnitReference;
};

export type CfihosPropertyPicklistValue = {
  picklistId: string;
  picklistName: string;

  id: string;
  code: string;
  description: string | null;

  sourceStandardId: string | null;
  sourceStandardCode: string | null;
};

export type CfihosResolvedTagClassProperty = {
  relationship: CfihosTagClassProperty;
  property: CfihosProperty;
  picklistValues: CfihosPropertyPicklistValue[];
};

export type CfihosPropertyAssignmentType = "direct" | "inherited";

export type CfihosEffectiveTagClassProperty = CfihosResolvedTagClassProperty & {
  assignmentType: CfihosPropertyAssignmentType;

  sourceTagClassId: string;
  sourceTagClassName: string;

  /**
   * 0 = assigned directly to the selected Tag Class
   * 1 = inherited from its parent
   * 2 = inherited from grandparent
   * etc.
   */
  inheritanceDepth: number;
};