import assert from "node:assert/strict";
import type { RdlCutoverRepository, RdlPackageRecord, RdlReadEntity } from "./RdlCutoverRepository.ts";

export type DualReadMismatch = { operation: string; reference: unknown; candidate: unknown };
export type DualReadDiagnostics = { onMismatch?: (mismatch: DualReadMismatch) => void };

export class DualReadRdlRepository implements RdlCutoverRepository {
  constructor(
    private readonly reference: RdlCutoverRepository,
    private readonly candidate: RdlCutoverRepository,
    private readonly diagnostics: DualReadDiagnostics = {},
  ) {}

  getPackage() { return this.compare("getPackage", () => this.reference.getPackage(), () => this.candidate.getPackage(), normalizePackage); }
  countEntities(entityType: string) { return this.compare(`countEntities:${entityType}`, () => this.reference.countEntities(entityType), () => this.candidate.countEntities(entityType), (v) => v); }
  getEntity(entityType: string, nativeIdentifier: string) { return this.compare(`getEntity:${entityType}:${nativeIdentifier}`, () => this.reference.getEntity(entityType, nativeIdentifier), () => this.candidate.getEntity(entityType, nativeIdentifier), normalizeEntity); }
  getChildren(entityType: string, nativeIdentifier: string) { return this.compare(`getChildren:${entityType}:${nativeIdentifier}`, () => this.reference.getChildren(entityType, nativeIdentifier), () => this.candidate.getChildren(entityType, nativeIdentifier), normalizeEntities); }
  getParent(entityType: string, nativeIdentifier: string) { return this.compare(`getParent:${entityType}:${nativeIdentifier}`, () => this.reference.getParent(entityType, nativeIdentifier), () => this.candidate.getParent(entityType, nativeIdentifier), normalizeEntity); }
  getDirectProperties(entityType: "tag_class" | "equipment_class", nativeIdentifier: string) { return this.compare(`getDirectProperties:${entityType}:${nativeIdentifier}`, () => this.reference.getDirectProperties(entityType, nativeIdentifier), () => this.candidate.getDirectProperties(entityType, nativeIdentifier), normalizeEntities); }
  getDocumentsForClass(entityType: "tag_class" | "equipment_class", nativeIdentifier: string) { return this.compare(`getDocumentsForClass:${entityType}:${nativeIdentifier}`, () => this.reference.getDocumentsForClass(entityType, nativeIdentifier), () => this.candidate.getDocumentsForClass(entityType, nativeIdentifier), normalizeEntities); }
  getDocumentsForDiscipline(nativeIdentifier: string) { return this.compare(`getDocumentsForDiscipline:${nativeIdentifier}`, () => this.reference.getDocumentsForDiscipline(nativeIdentifier), () => this.candidate.getDocumentsForDiscipline(nativeIdentifier), normalizeEntities); }
  getControlledValuesForProperty(nativeIdentifier: string) { return this.compare(`getControlledValuesForProperty:${nativeIdentifier}`, () => this.reference.getControlledValuesForProperty(nativeIdentifier), () => this.candidate.getControlledValuesForProperty(nativeIdentifier), normalizeEntities); }
  getJip33RequirementsForTagClass(nativeIdentifier: string) { return this.compare(`getJip33RequirementsForTagClass:${nativeIdentifier}`, () => this.reference.getJip33RequirementsForTagClass(nativeIdentifier), () => this.candidate.getJip33RequirementsForTagClass(nativeIdentifier), normalizeEntities); }
  getEquipmentMappingsForTagClass(nativeIdentifier: string) { return this.compare(`getEquipmentMappingsForTagClass:${nativeIdentifier}`, () => this.reference.getEquipmentMappingsForTagClass(nativeIdentifier), () => this.candidate.getEquipmentMappingsForTagClass(nativeIdentifier), normalizeEntities); }
  getUnitsForDimension(dimensionId: string) { return this.compare(`getUnitsForDimension:${dimensionId}`, () => this.reference.getUnitsForDimension(dimensionId), () => this.candidate.getUnitsForDimension(dimensionId), normalizeEntities); }
  getSourceStandardsForEntity(entityType: string, nativeIdentifier: string) { return this.compare(`getSourceStandardsForEntity:${entityType}:${nativeIdentifier}`, () => this.reference.getSourceStandardsForEntity(entityType, nativeIdentifier), () => this.candidate.getSourceStandardsForEntity(entityType, nativeIdentifier), normalizeEntities); }
  getSourceMappingsForProperty(nativeIdentifier: string) { return this.compare(`getSourceMappingsForProperty:${nativeIdentifier}`, () => this.reference.getSourceMappingsForProperty(nativeIdentifier), () => this.candidate.getSourceMappingsForProperty(nativeIdentifier), normalizeEntities); }

  private async compare<T, N>(operation: string, referenceRead: () => Promise<T>, candidateRead: () => Promise<T>, normalize: (value: T) => N): Promise<T> {
    const [reference, candidate] = await Promise.all([referenceRead(), candidateRead()]);
    try {
      assert.deepEqual(normalize(candidate), normalize(reference));
    } catch {
      const mismatch = { operation, reference: normalize(reference), candidate: normalize(candidate) };
      this.diagnostics.onMismatch?.(mismatch);
      throw new Error(`RDL dual-read mismatch: ${operation}\nreference=${JSON.stringify(mismatch.reference)}\ncandidate=${JSON.stringify(mismatch.candidate)}`);
    }
    return reference;
  }
}

const normalizePackage = (value: RdlPackageRecord | null) => value && ({ sourceKey: value.sourceKey, releaseKey: value.releaseKey, versionLabel: value.versionLabel, packageKey: value.packageKey, contentSha256: value.contentSha256, sourceUri: value.sourceUri });
const normalizeEntity = (value: RdlReadEntity | null) => value && ({ packageKey: value.packageKey, entityType: value.entityType, nativeIdentifier: value.nativeIdentifier, name: value.name, definition: value.definition, lifecycleStatus: value.lifecycleStatus, metadata: value.metadata, sourceLocator: value.sourceLocator });
const normalizeEntities = (values: RdlReadEntity[]) => values.map(normalizeEntity).sort((a, b) => (a?.nativeIdentifier ?? "").localeCompare(b?.nativeIdentifier ?? ""));
