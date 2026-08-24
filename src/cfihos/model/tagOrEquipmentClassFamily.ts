export type CfihosTagOrEquipmentClassFamilySample = {
  masterId: string;
  masterName: string;
  tagClassId: string | null;
  tagClassName: string | null;
  equipmentClassId: string | null;
  equipmentClassName: string | null;
};

export type CfihosTagOrEquipmentClassFamilyDiagnostics = {
  masterFamilyObjectCount: number;
  masterFamilyCanonicalObjectCount: number;

  tagClassCount: number;
  equipmentClassCount: number;
  canonicalClassUnionCount: number;

  tagOnlyMasterObjectCount: number;
  equipmentOnlyMasterObjectCount: number;
  bothDomainsMasterObjectCount: number;
  neitherDomainMasterObjectCount: number;

  tagClassesCoveredByMasterCount: number;
  tagClassesMissingFromMasterCount: number;
  equipmentClassesCoveredByMasterCount: number;
  equipmentClassesMissingFromMasterCount: number;

  explicitRelationshipCount: number;
  sameMasterObjectRelationshipCount: number;
  differentMasterObjectRelationshipCount: number;
  relationshipEndpointOutsideMasterFamilyCount: number;

  masterCoverageOfCanonicalClassUnionPercent: number;

  tagOnlySamples: CfihosTagOrEquipmentClassFamilySample[];
  equipmentOnlySamples: CfihosTagOrEquipmentClassFamilySample[];
  bothDomainSamples: CfihosTagOrEquipmentClassFamilySample[];
  neitherDomainSamples: CfihosTagOrEquipmentClassFamilySample[];

  tagClassIdsMissingFromMaster: string[];
  equipmentClassIdsMissingFromMaster: string[];
};
