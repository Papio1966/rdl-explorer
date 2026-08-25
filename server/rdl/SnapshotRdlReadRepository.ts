import type { RdlCutoverRepository, RdlPackageRecord, RdlReadEntity } from "./RdlCutoverRepository.ts";

type Row = Record<string, unknown>;
type Snapshot = {
  source: { url?: string; sha256?: string };
  sheets: Record<string, { rows: Row[] }>;
};

type EntitySpec = {
  sheet: string;
  idField: string;
  nameField: string;
  definitionField?: string;
  metadata: (row: Row) => Record<string, unknown>;
};

const text = (value: unknown) => (value == null ? "" : String(value).trim());
const yes = (value: unknown) => ["yes", "true", "1"].includes(text(value).toLowerCase());
const unique = <T>(items: T[], key: (value: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const specs: Record<string, EntitySpec> = {
  tag_class: {
    sheet: "tag class", idField: "CFIHOS unique code", nameField: "tag class name", definitionField: "tag class definition",
    metadata: (r) => ({ abstract: yes(r["abstract class indicator"]), parentName: text(r["parent tag class name"]), tagNumberFormat: text(r["tag number format"]), equipmentExpectedInstalled: text(r["equipment expected to be installed indicator"]), synonym: text(r["tag class synonym"]) }),
  },
  equipment_class: {
    sheet: "equipment class", idField: "equipment class CFIHOS unique code", nameField: "equipment class name", definitionField: "equipment class definition",
    metadata: (r) => ({ abstract: yes(r["abstract class indicator"]), parentName: text(r["parent equipment class name"]), sparePartInformationRequired: text(r["spare part information required indicator"]), synonym: text(r["equipment class synonym name"]) }),
  },
  property: {
    sheet: "property", idField: "CFIHOS unique code", nameField: "property name", definitionField: "property definition",
    metadata: (r) => ({ dataType: text(r["property data type"]), dataTypeLength: text(r["property data type length"]), dimensionId: text(r["unit of measure dimension code CFIHOS unique code"]), dimensionCode: text(r["unit of measure dimension code"]), controlledListId: text(r["property picklist name CFIHOS unique code"]), controlledListName: text(r["property picklist name"]), synonym: text(r["property synonym name"]) }),
  },
  document_type: {
    sheet: "document type", idField: "CFIHOS unique code", nameField: "document type name", definitionField: "document type description",
    metadata: (r) => ({ shortCode: text(r["document type short code"]), classification: text(r["document type classification"]), synonym: text(r["document type synonym name"]) }),
  },
  discipline: {
    sheet: "discipline", idField: "CFIHOS unique code", nameField: "discipline name", definitionField: "discipline description",
    metadata: (r) => ({ code: text(r["discipline code"]) }),
  },
  unit_of_measure: {
    sheet: "unit of measure", idField: "CFIHOS unique code", nameField: "unit of measure name",
    metadata: (r) => ({ uneceCode: text(r["UNECE code"]), symbol: text(r["unit of measure symbol"]), dimensionId: text(r["unit of measure dimension code CFIHOS unique code"]), dimensionCode: text(r["unit of measure dimension code"]), dimensionName: text(r["unit of measure dimension name"]), measurementSystemId: text(r["measurement system code CFIHOS unique code"]), measurementSystemCode: text(r["measurement system code"]), synonym: text(r["unit of measure synonym name"]) }),
  },
  source_standard: {
    sheet: "source standard", idField: "CFIHOS unique code", nameField: "source standard code", definitionField: "source standard description",
    metadata: (r) => ({ incomplete: text(r["source standard still to be completed indicator"]) }),
  },
  information_requirement: {
    sheet: "Jip33 info required spec", idField: "Source standard document and data requirement CFIHOS unique code", nameField: "source standard document and data requirement title", definitionField: "source standard document and data requirement description",
    metadata: (r) => ({ requirementNumber: text(r["source standard document and data requirement number"]), requirementType: text(r["document and data requirement type code"]), requirementGroup: text(r["document and data requirement group code"]), sourceChapter: text(r["engineering standard source chapter"]), typicalDeliverable: text(r["source standard document and data requirement typical deliverable"]), handoverStatus: text(r["default required handover status code"]) }),
  },
  source_mapping: {
    sheet: "tag equip class prop src std", idField: "CFIHOS unique code", nameField: "CFIHOS unique code",
    metadata: (r) => ({ classId: text(r["tag or equipment class CFIHOS unique code"]), className: text(r["tag or equipment class name"]), propertyId: text(r["property CFIHOS unique code"]), sourceStandardId: text(r["source standard code CFIHOS unique code"]), sourceSection: text(r["source standard section"]), propertyNameInSource: text(r["property name in source standard"]), sequence: text(r["property sequence number"]) }),
  },
};

export class SnapshotRdlReadRepository implements RdlCutoverRepository {
  constructor(private readonly snapshot: Snapshot) {}

  async getPackage(): Promise<RdlPackageRecord> {
    const sha = text(this.snapshot.source.sha256);
    return { sourceKey: "cfihos", releaseKey: "cfihos-2.0", versionLabel: "2.0", packageKey: `cfihos-2.0-${sha.slice(0, 12)}`, contentSha256: sha || null, sourceUri: text(this.snapshot.source.url) || null };
  }

  async countEntities(entityType: string): Promise<number> {
    return this.rows(specs[entityType]?.sheet).length;
  }

  async getEntity(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity | null> {
    const spec = specs[entityType];
    if (!spec) return null;
    const rows = this.rows(spec.sheet);
    const index = rows.findIndex((row) => text(row[spec.idField]) === nativeIdentifier);
    return index < 0 ? null : this.entity(entityType, spec, rows[index], index);
  }

  async getChildren(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity[]> {
    const spec = specs[entityType];
    if (!spec || !["tag_class", "equipment_class"].includes(entityType)) return [];
    const parent = await this.getEntity(entityType, nativeIdentifier);
    if (!parent) return [];
    const parentField = entityType === "tag_class" ? "parent tag class name" : "parent equipment class name";
    return this.rows(spec.sheet).map((row, i) => ({ row, i })).filter(({ row }) => text(row[parentField]) === parent.name).map(({ row, i }) => this.entity(entityType, spec, row, i)).sort(byId);
  }

  async getParent(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity | null> {
    const entity = await this.getEntity(entityType, nativeIdentifier);
    const spec = specs[entityType];
    if (!entity || !spec || !["tag_class", "equipment_class"].includes(entityType)) return null;
    const parentName = text(entity.metadata.parentName);
    if (!parentName) return null;
    const rows = this.rows(spec.sheet);
    const index = rows.findIndex((row) => text(row[spec.nameField]) === parentName);
    return index < 0 ? null : this.entity(entityType, spec, rows[index], index);
  }

  async getDirectProperties(entityType: "tag_class" | "equipment_class", nativeIdentifier: string) {
    const sheet = entityType === "tag_class" ? "tag class property" : "equipment class property";
    const classField = entityType === "tag_class" ? "tag class CFIHOS unique code" : "equipment class CFIHOS unique code";
    return this.relatedFromIds("property", this.rows(sheet).filter((r) => text(r[classField]) === nativeIdentifier).map((r) => text(r["property CFIHOS unique code"])));
  }

  async getDocumentsForClass(entityType: "tag_class" | "equipment_class", nativeIdentifier: string) {
    const wantedAsset = entityType === "tag_class" ? "tag" : "equipment";
    const ids = this.rows("document required per class").filter((r) => text(r["tag or equipment class CFIHOS unique code"]) === nativeIdentifier && text(r["asset type reference"]).toLowerCase() === wantedAsset).map((r) => text(r["document type CFIHOS unique code"]));
    return this.relatedFromIds("document_type", ids);
  }

  async getDocumentsForDiscipline(nativeIdentifier: string) {
    return this.relatedFromIds("document_type", this.rows("discipline document type").filter((r) => text(r["discipline CFIHOS unique code"]) === nativeIdentifier).map((r) => text(r["document type CFIHOS unique code"])));
  }

  async getControlledValuesForProperty(nativeIdentifier: string) {
    const property = await this.getEntity("property", nativeIdentifier);
    const listId = text(property?.metadata.controlledListId);
    if (!listId) return [];
    const rows = this.rows("property picklist values").filter((r) => text(r["property picklist CFIHOS unique code"]) === listId);
    return rows.map((r, i) => this.rawEntity("controlled_value", text(r["property picklist value CFIHOS unique code"]), text(r["property picklist value code"]) || text(r["property picklist value CFIHOS unique code"]), text(r["property picklist value description"]) || null, { controlledListId: listId, controlledListName: text(r["property picklist name"]), sourceStandardId: text(r["Source standard CFIHOS unique code"]), sourceStandardCode: text(r["source standard code"]) }, "property picklist values", this.rows("property picklist values").indexOf(r))).sort(byId);
  }

  async getJip33RequirementsForTagClass(nativeIdentifier: string) {
    return this.relatedFromIds("information_requirement", this.rows("Jip33 info required spec").filter((r) => text(r["tag class CFIHOS unique code"]) === nativeIdentifier).map((r) => text(r["Source standard document and data requirement CFIHOS unique code"])));
  }

  async getEquipmentMappingsForTagClass(nativeIdentifier: string) {
    return this.relatedFromIds("equipment_class", this.rows("tag equipment class relationshi").filter((r) => text(r["tag class CFIHOS unique code"]) === nativeIdentifier).map((r) => text(r["equipment class CFIHOS unique code"])));
  }

  async getUnitsForDimension(dimensionId: string) {
    const spec = specs.unit_of_measure;
    return this.rows(spec.sheet).map((row, i) => ({ row, i })).filter(({ row }) => text(row["unit of measure dimension code CFIHOS unique code"]) === dimensionId).map(({ row, i }) => this.entity("unit_of_measure", spec, row, i)).sort(byId);
  }

  async getSourceStandardsForEntity(entityType: string, nativeIdentifier: string) {
    if (entityType !== "tag_class" && entityType !== "equipment_class") return [];
    const ids = this.rows("tag or equip class src standard").filter((r) => text(r["tag or equipment class CFIHOS unique code"]) === nativeIdentifier).map((r) => text(r["source standard CFIHOS unique code"]));
    return this.relatedFromIds("source_standard", ids);
  }

  async getSourceMappingsForProperty(nativeIdentifier: string) {
    return this.relatedFromIds("source_mapping", this.rows("tag equip class prop src std").filter((r) => text(r["property CFIHOS unique code"]) === nativeIdentifier).map((r) => text(r["CFIHOS unique code"])));
  }

  private rows(sheet?: string) { return sheet ? this.snapshot.sheets[sheet]?.rows ?? [] : []; }
  private entity(type: string, spec: EntitySpec, row: Row, index: number) {
    const defaultName = type === "information_requirement" ? text(row["source standard document and data requirement number"]) : text(row[spec.idField]);
    return this.rawEntity(type, text(row[spec.idField]), text(row[spec.nameField]) || defaultName, spec.definitionField ? text(row[spec.definitionField]) || null : null, spec.metadata(row), spec.sheet, index);
  }
  private rawEntity(type: string, id: string, name: string, definition: string | null, metadata: Record<string, unknown>, sheet: string, index: number): RdlReadEntity {
    return { entityId: -(index + 1), packageKey: `cfihos-2.0-${text(this.snapshot.source.sha256).slice(0, 12)}`, entityType: type, nativeIdentifier: id, name, definition, lifecycleStatus: "active", metadata, sourceLocator: { sheet, row: index + 2 } };
  }
  private async relatedFromIds(type: string, ids: string[]) {
    const entities = await Promise.all(unique(ids, (id) => id).map((id) => this.getEntity(type, id)));
    return entities.filter((value): value is RdlReadEntity => Boolean(value)).sort(byId);
  }
}

const byId = (a: RdlReadEntity, b: RdlReadEntity) => a.nativeIdentifier.localeCompare(b.nativeIdentifier);
