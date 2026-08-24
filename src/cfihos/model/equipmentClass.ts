import type { CfihosUnitReference } from "./common";
import type {
  CfihosProperty,
  CfihosPropertyPicklistValue,
} from "./property";

export type CfihosEquipmentClass = {
  id: string;
  name: string;
  definition: string | null;

  parentName: string | null;
  parentId: string | null;

  abstract: boolean;
  sparePartInformationRequired: boolean;

  existenceReason: string | null;

  synonyms: string[];
};

export type CfihosEquipmentClassTreeNode =
  CfihosEquipmentClass & {
    children: CfihosEquipmentClassTreeNode[];
  };

export type CfihosEquipmentClassProperty = {
  equipmentClassId: string;
  equipmentClassName: string;

  propertyId: string;
  propertyName: string;

  relevantForEquipment: boolean;
  relevantForModelOrPart: boolean;

  siUnit: CfihosUnitReference;
  imperialUnit: CfihosUnitReference;
};

export type CfihosResolvedEquipmentClassProperty = {
  relationship: CfihosEquipmentClassProperty;
  property: CfihosProperty;
  picklistValues: CfihosPropertyPicklistValue[];
};

export type CfihosEquipmentPropertyAssignmentType =
  | "direct"
  | "inherited";

export type CfihosEffectiveEquipmentClassProperty =
  CfihosResolvedEquipmentClassProperty & {
    assignmentType: CfihosEquipmentPropertyAssignmentType;

    sourceEquipmentClassId: string;
    sourceEquipmentClassName: string;

    /**
     * 0 = assigned directly to the selected Equipment Class
     * 1 = inherited from parent
     * 2 = inherited from grandparent
     * etc.
     */
    inheritanceDepth: number;
  };