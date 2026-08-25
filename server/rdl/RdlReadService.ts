import type { RdlCutoverRepository } from "./RdlCutoverRepository.ts";

/** Server-side application boundary for controlled normalized RDL reads. */
export class RdlReadService {
  constructor(private readonly repository: RdlCutoverRepository) {}
  getPackage() { return this.repository.getPackage(); }
  getEntity(entityType: string, nativeIdentifier: string) { return this.repository.getEntity(entityType, nativeIdentifier); }
  getChildren(entityType: string, nativeIdentifier: string) { return this.repository.getChildren(entityType, nativeIdentifier); }
  getParent(entityType: string, nativeIdentifier: string) { return this.repository.getParent(entityType, nativeIdentifier); }
  getDirectProperties(entityType: "tag_class" | "equipment_class", nativeIdentifier: string) { return this.repository.getDirectProperties(entityType, nativeIdentifier); }
  getDocumentsForClass(entityType: "tag_class" | "equipment_class", nativeIdentifier: string) { return this.repository.getDocumentsForClass(entityType, nativeIdentifier); }
  getDocumentsForDiscipline(nativeIdentifier: string) { return this.repository.getDocumentsForDiscipline(nativeIdentifier); }
  getControlledValuesForProperty(nativeIdentifier: string) { return this.repository.getControlledValuesForProperty(nativeIdentifier); }
  getJip33RequirementsForTagClass(nativeIdentifier: string) { return this.repository.getJip33RequirementsForTagClass(nativeIdentifier); }
  getEquipmentMappingsForTagClass(nativeIdentifier: string) { return this.repository.getEquipmentMappingsForTagClass(nativeIdentifier); }
  getUnitsForDimension(dimensionId: string) { return this.repository.getUnitsForDimension(dimensionId); }
  getSourceStandardsForEntity(entityType: string, nativeIdentifier: string) { return this.repository.getSourceStandardsForEntity(entityType, nativeIdentifier); }
  getSourceMappingsForProperty(nativeIdentifier: string) { return this.repository.getSourceMappingsForProperty(nativeIdentifier); }
}
