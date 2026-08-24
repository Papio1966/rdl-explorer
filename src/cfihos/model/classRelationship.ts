import type { CfihosEquipmentClass } from "./equipmentClass";
import type { CfihosTagClass } from "./tagClass";

export type CfihosTagEquipmentClassRelationship = {
  tagClassId: string;
  tagClassName: string;

  equipmentClassId: string;
  equipmentClassName: string;

  mappingReason: string | null;
};

export type CfihosResolvedTagEquipmentClassRelationship = {
  relationship: CfihosTagEquipmentClassRelationship;

  tagClass: CfihosTagClass;
  equipmentClass: CfihosEquipmentClass;
};

export type CfihosClassRelationshipDiagnostics = {
  sourceRelationshipCount: number;
  resolvedRelationshipCount: number;

  uniqueTagClassCount: number;
  uniqueEquipmentClassCount: number;

  resolvedTagReferenceCount: number;
  resolvedEquipmentReferenceCount: number;

  unresolvedTagReferenceCount: number;
  unresolvedEquipmentReferenceCount: number;

  sameCanonicalIdCount: number;
  differentCanonicalIdCount: number;
  mappingReasonCount: number;

  unresolvedTagIds: string[];
  unresolvedEquipmentIds: string[];
};
