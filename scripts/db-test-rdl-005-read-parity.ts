import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { PostgresRdlRepository } from "../server/rdl/PostgresRdlRepository.ts";

const snapshot = JSON.parse(
  readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"),
) as {
  source: { sha256: string };
  sheets: Record<string, { rows: Record<string, unknown>[] }>;
};
const rows = (name: string) => snapshot.sheets[name]?.rows ?? [];
const text = (value: unknown) => (value == null ? "" : String(value).trim());
const byId = (sheet: string, field: string, id: string) =>
  rows(sheet).find((row) => text(row[field]) === id) ?? null;
const ids = (items: { nativeIdentifier: string }[]) => items.map((item) => item.nativeIdentifier).sort();
const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const repository = new PostgresRdlRepository(client);
const anchor = "CFIHOS-30000521";

const packageRecord = await repository.getPackage();
assert.ok(packageRecord, "CFIHOS PostgreSQL package must be readable");
assert.equal(packageRecord.sourceKey, "cfihos");
assert.equal(packageRecord.releaseKey, "cfihos-2.0");
assert.equal(packageRecord.contentSha256, snapshot.source.sha256);
console.log("PASS read parity: RDL package identity and source SHA");

for (const [entityType, sheet, field] of [
  ["tag_class", "tag class", "CFIHOS unique code"],
  ["equipment_class", "equipment class", "equipment class CFIHOS unique code"],
  ["property", "property", "CFIHOS unique code"],
  ["document_type", "document type", "CFIHOS unique code"],
  ["discipline", "discipline", "CFIHOS unique code"],
  ["unit_of_measure", "unit of measure", "CFIHOS unique code"],
  ["source_standard", "source standard", "CFIHOS unique code"],
] as const) {
  assert.equal(await repository.countEntities(entityType), rows(sheet).length, `${entityType} count parity`);
  const sample = rows(sheet)[0];
  assert.ok(sample, `${sheet} sample must exist`);
  const nativeId = text(sample[field]);
  assert.ok(await repository.getEntity(entityType, nativeId), `${entityType} ${nativeId} must resolve`);
}
console.log("PASS read parity: representative entity counts and lookups");

const tag = await repository.getEntity("tag_class", anchor);
const equipment = await repository.getEntity("equipment_class", anchor);
assert.ok(tag && equipment, "shared CFIHOS identifier must resolve in both typed domains");
assert.notEqual(tag.entityId, equipment.entityId, "typed identities must remain independent");
console.log(`PASS read parity: ${anchor} resolves independently as tag and equipment class`);

for (const [entityType, sheet, idField, nameField, parentNameField] of [
  ["tag_class", "tag class", "CFIHOS unique code", "tag class name", "parent tag class name"],
  ["equipment_class", "equipment class", "equipment class CFIHOS unique code", "equipment class name", "parent equipment class name"],
] as const) {
  const candidate = rows(sheet).find((row) => text(row[parentNameField]))!;
  assert.ok(candidate, `${sheet} must contain hierarchy rows`);
  const id = text(candidate[idField]);
  const parent = await repository.getParent(entityType, id);
  assert.ok(parent, `${entityType} ${id} must have PostgreSQL parent`);
  assert.equal(parent.name, text(candidate[parentNameField]));
  const children = await repository.getChildren(entityType, parent.nativeIdentifier);
  assert.ok(children.some((child) => child.nativeIdentifier === id));
  assert.equal((await repository.getEntity(entityType, id))?.name, text(candidate[nameField]));
}
console.log("PASS read parity: tag/equipment hierarchy semantics");

const tagPropertyExpected = rows("tag class property")
  .filter((row) => text(row["tag class CFIHOS unique code"]) === anchor)
  .map((row) => text(row["property CFIHOS unique code"]))
  .filter(Boolean);
tagPropertyExpected.splice(0, tagPropertyExpected.length, ...uniqueSorted(tagPropertyExpected));
assert.deepEqual(ids(await repository.getDirectProperties("tag_class", anchor)), tagPropertyExpected);
console.log(`PASS read parity: direct tag-class properties for ${anchor}`);

const documentRow = rows("document required per class")[0];
assert.ok(documentRow, "document required per class must contain a parity anchor");
const documentClassId = text(documentRow["tag or equipment class CFIHOS unique code"]);
const documentClassType = text(documentRow["asset type reference"]).toLowerCase() === "tag" ? "tag_class" : "equipment_class";
const expectedDocs = uniqueSorted(rows("document required per class")
  .filter((row) => text(row["tag or equipment class CFIHOS unique code"]) === documentClassId
    && (text(row["asset type reference"]).toLowerCase() === "tag" ? "tag_class" : "equipment_class") === documentClassType)
  .map((row) => text(row["document type CFIHOS unique code"])));
assert.deepEqual(ids(await repository.getDocumentsForClass(documentClassType, documentClassId)), expectedDocs);
console.log("PASS read parity: class/document relationships");

const disciplineRow = rows("discipline")[0];
assert.ok(disciplineRow);
const disciplineId = text(disciplineRow["CFIHOS unique code"]);
const disciplineDocsExpected = rows("discipline document type")
  .filter((row) => text(row["discipline CFIHOS unique code"]) === disciplineId)
  .map((row) => text(row["document type CFIHOS unique code"]))
  .filter(Boolean);
disciplineDocsExpected.splice(0, disciplineDocsExpected.length, ...uniqueSorted(disciplineDocsExpected));
assert.deepEqual(ids(await repository.getDocumentsForDiscipline(disciplineId)), disciplineDocsExpected);
console.log("PASS read parity: discipline/document relationships");

const propertyWithList = rows("property").find((row) => text(row["property picklist name CFIHOS unique code"]));
assert.ok(propertyWithList);
const propertyId = text(propertyWithList["CFIHOS unique code"]);
const listId = text(propertyWithList["property picklist name CFIHOS unique code"]);
const valueExpected = rows("property picklist values")
  .filter((row) => text(row["property picklist CFIHOS unique code"]) === listId)
  .map((row) => text(row["property picklist value CFIHOS unique code"]))
  .filter(Boolean);
valueExpected.splice(0, valueExpected.length, ...uniqueSorted(valueExpected));
assert.deepEqual(ids(await repository.getControlledValuesForProperty(propertyId)), valueExpected);
console.log("PASS read parity: property controlled values");

const jipExpected = rows("Jip33 info required spec")
  .filter((row) => text(row["tag class CFIHOS unique code"]) === anchor)
  .map((row) => text(row["Source standard document and data requirement CFIHOS unique code"]))
  .filter(Boolean);
jipExpected.splice(0, jipExpected.length, ...uniqueSorted(jipExpected));
assert.deepEqual(ids(await repository.getJip33RequirementsForTagClass(anchor)), jipExpected);
console.log("PASS read parity: JIP33 requirements");

const equipmentExpected = rows("tag equipment class relationshi")
  .filter((row) => text(row["tag class CFIHOS unique code"]) === anchor)
  .map((row) => text(row["equipment class CFIHOS unique code"]))
  .filter(Boolean);
equipmentExpected.splice(0, equipmentExpected.length, ...uniqueSorted(equipmentExpected));
assert.deepEqual(ids(await repository.getEquipmentMappingsForTagClass(anchor)), equipmentExpected);
console.log("PASS read parity: tag/equipment mappings");

const sourceStandardsExpected = rows("tag or equip class src standard")
  .filter((row) => text(row["tag or equipment class CFIHOS unique code"]) === anchor)
  .map((row) => text(row["source standard CFIHOS unique code"]))
  .filter(Boolean);
sourceStandardsExpected.splice(0, sourceStandardsExpected.length, ...uniqueSorted(sourceStandardsExpected));
assert.deepEqual(ids(await repository.getSourceStandardsForEntity("tag_class", anchor)), sourceStandardsExpected);
console.log("PASS read parity: class/source-standard provenance");

const unitRow = rows("unit of measure").find((row) => text(row["unit of measure dimension code CFIHOS unique code"]));
assert.ok(unitRow);
const dimensionId = text(unitRow["unit of measure dimension code CFIHOS unique code"]);
const unitExpected = uniqueSorted(rows("unit of measure")
  .filter((row) => text(row["unit of measure dimension code CFIHOS unique code"]) === dimensionId)
  .map((row) => text(row["CFIHOS unique code"])));
assert.deepEqual(ids(await repository.getUnitsForDimension(dimensionId)), unitExpected);
console.log("PASS read parity: unit-family/dimension reads");

const sourceMappingRow = rows("tag equip class prop src std")[0];
assert.ok(sourceMappingRow);
const mappedPropertyId = text(sourceMappingRow["property CFIHOS unique code"]);
const mappingExpected = rows("tag equip class prop src std")
  .filter((row) => text(row["property CFIHOS unique code"]) === mappedPropertyId)
  .map((row) => text(row["CFIHOS unique code"]))
  .filter(Boolean);
mappingExpected.splice(0, mappingExpected.length, ...uniqueSorted(mappingExpected));
assert.deepEqual(ids(await repository.getSourceMappingsForProperty(mappedPropertyId)), mappingExpected);
console.log("PASS read parity: first-class source/property mappings");

const propertySource = byId("property", "CFIHOS unique code", mappedPropertyId);
assert.ok(propertySource, "selected property must exist in source snapshot");
const propertyFromDb = await repository.getEntity("property", mappedPropertyId);
assert.equal(propertyFromDb?.name, text(propertySource["property name"]));
assert.equal(propertyFromDb?.sourceLocator.sheet, "property");
console.log("PASS read parity: entity values and source locator provenance");

console.log("PASS RDL-005 PostgreSQL repository read parity");
