import type { RdlPackageRecord, RdlReadEntity, RdlReadRepository } from "./RdlReadRepository.ts";

export interface RdlCutoverRepository extends RdlReadRepository {
  getDirectProperties(entityType: "tag_class" | "equipment_class", nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getDocumentsForClass(entityType: "tag_class" | "equipment_class", nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getDocumentsForDiscipline(nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getControlledValuesForProperty(nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getJip33RequirementsForTagClass(nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getEquipmentMappingsForTagClass(nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getUnitsForDimension(dimensionId: string): Promise<RdlReadEntity[]>;
  getSourceStandardsForEntity(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getSourceMappingsForProperty(nativeIdentifier: string): Promise<RdlReadEntity[]>;
}

export type RdlReadMode = "snapshot" | "postgresql" | "dual";

export type RdlCutoverSelection = {
  mode: RdlReadMode;
  repository: RdlCutoverRepository;
  referenceRepository?: RdlCutoverRepository;
  candidateRepository?: RdlCutoverRepository;
};

export type { RdlPackageRecord, RdlReadEntity };
