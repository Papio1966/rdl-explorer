import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { parseRdlReadMode, selectRdlRepository } from "../server/rdl/RdlRepositorySelector.ts";

const snapshot = JSON.parse(readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"));
const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const anchor = "CFIHOS-30000521";

assert.equal(parseRdlReadMode(undefined), "snapshot", "snapshot must remain the safe default");
assert.equal(parseRdlReadMode("postgresql"), "postgresql");
assert.equal(parseRdlReadMode("dual"), "dual");
assert.throws(() => parseRdlReadMode("unsafe"), /Invalid RDL_READ_MODE/);
console.log("PASS cutover modes: snapshot is default; postgresql and dual are explicit");

for (const mode of ["snapshot", "postgresql"] as const) {
  const selection = selectRdlRepository({ snapshot, client, mode });
  assert.equal(selection.mode, mode);
  const tag = await selection.repository.getEntity("tag_class", anchor);
  const equipment = await selection.repository.getEntity("equipment_class", anchor);
  assert.ok(tag && equipment, `${mode}: typed CFIHOS anchor must resolve in both domains`);
  assert.equal(tag.nativeIdentifier, anchor);
  assert.equal(equipment.nativeIdentifier, anchor);
  assert.equal((await selection.repository.getPackage())?.contentSha256, snapshot.source.sha256);
  console.log(`PASS ${mode} mode: package provenance and typed identity`);
}

const mismatches: string[] = [];
const dual = selectRdlRepository({
  snapshot,
  client,
  mode: "dual",
  diagnostics: { onMismatch: (mismatch) => mismatches.push(mismatch.operation) },
}).repository;

const packageRecord = await dual.getPackage();
assert.equal(packageRecord?.contentSha256, snapshot.source.sha256);
assert.equal(await dual.countEntities("tag_class"), snapshot.sheets["tag class"].rows.length);
const tag = await dual.getEntity("tag_class", anchor);
const equipment = await dual.getEntity("equipment_class", anchor);
assert.ok(tag && equipment);
assert.equal(tag.nativeIdentifier, equipment.nativeIdentifier);
console.log("PASS dual mode: package, counts and typed entity identity");

const tagRows = snapshot.sheets["tag class"].rows as Record<string, unknown>[];
const hierarchyAnchor = tagRows.find((row) => String(row["parent tag class name"] ?? "").trim());
assert.ok(hierarchyAnchor);
const hierarchyId = String(hierarchyAnchor["CFIHOS unique code"]).trim();
assert.ok(await dual.getParent("tag_class", hierarchyId));
console.log("PASS dual mode: hierarchy read comparison");

assert.ok((await dual.getDirectProperties("tag_class", anchor)).length > 0);
console.log("PASS dual mode: direct properties");

const classDocRows = snapshot.sheets["document required per class"].rows as Record<string, unknown>[];
const classDoc = classDocRows[0];
assert.ok(classDoc);
const classId = String(classDoc["tag or equipment class CFIHOS unique code"] ?? "").trim();
const classType = String(classDoc["asset type reference"] ?? "").trim().toLowerCase() === "tag" ? "tag_class" : "equipment_class";
assert.ok((await dual.getDocumentsForClass(classType, classId)).length > 0);
console.log("PASS dual mode: class/document relationships");

const discipline = (snapshot.sheets.discipline.rows as Record<string, unknown>[])[0];
assert.ok(discipline);
const disciplineId = String(discipline["CFIHOS unique code"] ?? "").trim();
await dual.getDocumentsForDiscipline(disciplineId);
console.log("PASS dual mode: discipline/document relationships");

const propertyRows = snapshot.sheets.property.rows as Record<string, unknown>[];
const propertyWithList = propertyRows.find((row) => String(row["property picklist name CFIHOS unique code"] ?? "").trim());
assert.ok(propertyWithList);
const propertyId = String(propertyWithList["CFIHOS unique code"] ?? "").trim();
assert.ok((await dual.getControlledValuesForProperty(propertyId)).length > 0);
console.log("PASS dual mode: controlled values");

await dual.getJip33RequirementsForTagClass(anchor);
await dual.getEquipmentMappingsForTagClass(anchor);
await dual.getSourceStandardsForEntity("tag_class", anchor);
console.log("PASS dual mode: JIP33, tag/equipment and source-standard relationships");

const unitRows = snapshot.sheets["unit of measure"].rows as Record<string, unknown>[];
const unit = unitRows.find((row) => String(row["unit of measure dimension code CFIHOS unique code"] ?? "").trim());
assert.ok(unit);
const dimensionId = String(unit["unit of measure dimension code CFIHOS unique code"] ?? "").trim();
assert.ok((await dual.getUnitsForDimension(dimensionId)).length > 0);
console.log("PASS dual mode: unit-family/dimension relationships");

const sourceMapping = (snapshot.sheets["tag equip class prop src std"].rows as Record<string, unknown>[])[0];
assert.ok(sourceMapping);
const mappedPropertyId = String(sourceMapping["property CFIHOS unique code"] ?? "").trim();
assert.ok((await dual.getSourceMappingsForProperty(mappedPropertyId)).length > 0);
console.log("PASS dual mode: first-class source/property mappings");

assert.deepEqual(mismatches, [], "dual mode must not record parity mismatches");
console.log("PASS RDL-006 controlled repository cutover and dual-read parity");
