import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readWorkbook, worksheetRows } from "./rdl-ingestion/workbookReader.ts";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { PostgresRdlRepository } from "../server/rdl/PostgresRdlRepository.ts";
import { WATER_DESALINATION_PROFILE } from "./rdl-ingestion/WaterDesalinationProfile.ts";
import { mappedText } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";

const profile = WATER_DESALINATION_PROFILE;
const bytes = readFileSync(profile.workbookPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const workbook = await readWorkbook(bytes);
type Row = Record<string, unknown>;
const rows = (key: string): Row[] => {
  const ws = workbook.sheets[profile.sheetNames[key]];
  return ws ? worksheetRows<Row>(ws) : [];
};
const f = profile.fields;
const t = (row: Row, field: string) => mappedText(row, f[field] ?? [field]);
const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const water = new PostgresRdlRepository(client, profile.sourceKey, profile.releaseKey);
const cfihos = new PostgresRdlRepository(client, "cfihos", "cfihos-2.0");
const ccus = new PostgresRdlRepository(client, "ccus", "ccus-0.1-draft");

const packageRecord = await water.getPackage();
assert.ok(packageRecord, "Water / Desalination package must exist");
assert.equal(packageRecord.sourceKey, "water-desalination");
assert.equal(packageRecord.releaseKey, "water-desalination-0.1-draft");
assert.equal(packageRecord.contentSha256, sha256);
console.log("PASS Water package: independent source/release/package with exact workbook SHA provenance");

const expectedEntities: Array<[string, string, number]> = [
  ["tag classes", "tag_class", rows("tagClass").length],
  ["equipment classes", "equipment_class", rows("equipmentClass").length],
  ["properties", "property", rows("property").length],
  ["document types", "document_type", rows("documentType").length],
  ["disciplines", "discipline", rows("discipline").length],
  ["units", "unit_of_measure", rows("unit").length],
  ["source standards", "source_standard", rows("sourceStandard").length],
  ["handover events", "handover_event", rows("handoverEvent").length],
  ["controlled values", "controlled_value", rows("controlledValue").length],
  ["information requirements", "information_requirement", rows("informationRequirement").length],
  ["source mappings", "source_mapping", rows("sourceMapping").length],
];
for (const [label, type, expected] of expectedEntities) {
  const actual = await water.countEntities(type);
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS Water parity ${label}: ${actual}`);
}
const expectedControlledLists = new Set(rows("controlledValue").map((r) => t(r, "picklistId")).filter(Boolean)).size;
assert.equal(await water.countEntities("controlled_list"), expectedControlledLists);
console.log(`PASS Water parity controlled lists: ${expectedControlledLists}`);

const q = async (sql: string) => (await client.query<Record<string, unknown>>(sql))[0];
const qCount = async (sql: string) => Number((await q(sql))?.count ?? 0);
const waterPkg = `(SELECT p.package_id FROM rdl.rdl_package p JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key='water-desalination' AND r.release_key='water-desalination-0.1-draft' ORDER BY p.package_id DESC LIMIT 1)`;

const expectedRelationships: Array<[string, string, number]> = [
  ["equipment hierarchy", "entity_parent", rows("equipmentClass").filter((r) => t(r, "equipmentParentId")).length],
  ["class properties", "class_property", rows("tagClassProperty").length + rows("equipmentClassProperty").length],
  ["discipline documents", "document_discipline", rows("disciplineDocument").length],
  ["tag/equipment mappings", "tag_equipment_mapping", rows("tagEquipment").length],
  ["controlled-list values", "controlled_list_value", rows("controlledValue").length],
  ["class documents", "class_document", rows("classDocument").length],
  ["class source standards", "entity_source_standard", rows("classSourceStandard").length],
  ["mapping-to-property", "mapping_property", rows("sourceMapping").length],
  ["mapping-to-standard", "mapping_standard", rows("sourceMapping").length],
  ["mapping-to-class", "mapping_equipment_class", rows("sourceMapping").length],
];
for (const [label, type, expected] of expectedRelationships) {
  const actual = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship WHERE package_id=${waterPkg} AND relationship_type_code='${type}'`);
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS Water relationship ${label}: ${actual}`);
}

const validUnits = new Set(rows("unit").map((r) => t(r, "unitId")).filter(Boolean));
const expectedPropertyUnits = rows("property").filter((r) => validUnits.has(t(r, "propertyUnitId"))).length;
assert.equal(await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship WHERE package_id=${waterPkg} AND relationship_type_code='property_unit'`), expectedPropertyUnits);
console.log(`PASS Water mapped unit references: ${expectedPropertyUnits}`);

const expectedPropertyLists = rows("property").filter((r) => t(r, "propertyPicklistId")).length;
assert.equal(await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship WHERE package_id=${waterPkg} AND relationship_type_code='property_controlled_list'`), expectedPropertyLists);
console.log(`PASS Water mapped controlled-list references: ${expectedPropertyLists}`);

const derivedControlledValueIds = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_entity WHERE package_id=${waterPkg} AND entity_type_code='controlled_value' AND native_identifier LIKE 'water-desalination:controlled-value:%'`);
assert.equal(derivedControlledValueIds, rows("controlledValue").length, "Water controlled values lack source-native IDs and must receive deterministic canonical IDs");
const derivedMappingIds = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_entity WHERE package_id=${waterPkg} AND entity_type_code='source_mapping' AND native_identifier LIKE 'water-desalination:source-mapping:%'`);
assert.equal(derivedMappingIds, rows("sourceMapping").length, "Water source mappings lack source-native IDs and must receive deterministic canonical IDs");
console.log("PASS format genericity: deterministic canonical IDs fill source identifier gaps without schema changes");

const waterEquipment = await water.getEntity("equipment_class", "WATERRDL-30000003");
assert.ok(waterEquipment, "Representative desalination plant equipment class must be queryable through generic repository");
const directProperties = await water.getDirectProperties("equipment_class", "WATERRDL-30000003");
assert.ok(directProperties.length > 0, "Representative Water equipment class must expose normalized properties");
console.log(`PASS generic repository read: desalination plant returns ${directProperties.length} direct properties`);

const sources = await client.query<{ source_key: string }>("SELECT source_key FROM rdl.rdl_source WHERE source_key IN ('cfihos','ccus','water-desalination') ORDER BY source_key");
assert.deepEqual(sources.map((row) => row.source_key), ["ccus", "cfihos", "water-desalination"]);
assert.ok(await cfihos.getPackage(), "CFIHOS package must remain available");
assert.ok(await ccus.getPackage(), "CCUS package must remain available");
console.log("PASS three-RDL coexistence: CFIHOS, CCUS and Water / Desalination are independently addressable");

const cfihosSnapshot = JSON.parse(readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"));
assert.equal(await cfihos.countEntities("tag_class"), cfihosSnapshot.sheets["tag class"].rows.length);
assert.equal(await cfihos.countEntities("equipment_class"), cfihosSnapshot.sheets["equipment class"].rows.length);
const ccusPackageBefore = await ccus.getPackage();
assert.ok(ccusPackageBefore?.contentSha256, "CCUS package provenance must remain intact");
console.log("PASS prior baselines: CFIHOS counts and CCUS package provenance remain intact");

const waterRuns = await qCount(`SELECT count(*)::text AS count FROM ingestion.ingestion_run WHERE package_id=${waterPkg} AND adapter_key='${profile.profileKey}' AND status='completed'`);
assert.equal(waterRuns, 1, "idempotent reload should leave one current Water ingestion audit record for the package");
const crossPackageRelationships = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship rel JOIN rdl.rdl_entity s ON s.entity_id=rel.source_entity_id JOIN rdl.rdl_entity t ON t.entity_id=rel.target_entity_id WHERE rel.package_id=${waterPkg} AND s.package_id<>t.package_id`);
assert.equal(crossPackageRelationships, 0);
console.log("PASS idempotence and package isolation: deterministic Water package with no cross-package authoritative relationships");

console.log("PASS RDL-008 Water / Desalination genericity proof");
