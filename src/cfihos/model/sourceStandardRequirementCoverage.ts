export type CfihosRequirementFamilyObject = {
  id: string;
  name: string;
  description: string | null;
};

export type CfihosSourceStandardRequirementCoverageDiagnostics = {
  masterRequirementObjectCount: number;
  classRequirementRowCount: number;
  uniqueClassRequirementIdCount: number;
  jip33RequirementCount: number;
  classAndJip33OverlapCount: number;
  referencedMasterRequirementCount: number;
  masterCoveragePercent: number;
  classOnlyRequirementCount: number;
  jip33OnlyRequirementCount: number;
  unreferencedMasterRequirementCount: number;
  referencesMissingFromMasterCount: number;
  unreferencedMasterRequirements: CfihosRequirementFamilyObject[];
  referencesMissingFromMaster: string[];
};
