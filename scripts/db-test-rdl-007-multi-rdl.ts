import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { PostgresRdlRepository } from "../server/rdl/PostgresRdlRepository.ts";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusCfihosFormatProfile.ts";
import { mappedText } from "./rdl-ingestion/RdlWorkbookMappingProfile.ts";

const profile = CCUS_CFIHOS_FORMAT_PROFILE;
const bytes = readFileSync(profile.workbookPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const workbook = XLSX.read(bytes, { type: "buffer" });
type Row = Record<string, unknown>;
const rows = (key: string): Row[] => {
  const ws = workbook.Sheets[profile.sheetNames[key]];
  return ws ? XLSX.utils.sheet_to_json<Row>(ws, { defval: null, raw: false }) : [];
};
const f = profile.fields;
const t = (row: Row, field: string) => mappedText(row, f[field] ?? [field]);
const client = new PsqlJsonClient(getRdlDatabaseConfig().connectionString);
const ccus = new PostgresRdlRepository(client, profile.sourceKey, profile.releaseKey);
const cfihos = new PostgresRdlRepository(client, "cfihos", "cfihos-2.0");

const packageRecord = await ccus.getPackage();
assert.ok(packageRecord, "CCUS package must exist");
assert.equal(packageRecord.sourceKey, "ccus");
assert.equal(packageRecord.releaseKey, "ccus-0.1-draft");
assert.equal(packageRecord.contentSha256, sha256);
console.log("PASS CCUS package: independent source/release/package with workbook SHA provenance");

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
  const actual = await ccus.countEntities(type);
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS CCUS parity ${label}: ${actual}`);
}

const q = async (sql: string) => (await client.query<Record<string, unknown>>(sql))[0];
const qCount = async (sql: string) => Number((await q(sql))?.count ?? 0);
const ccusPkg = `(SELECT p.package_id FROM rdl.rdl_package p JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key='ccus' AND r.release_key='ccus-0.1-draft' ORDER BY p.package_id DESC LIMIT 1)`;
const cfihosPkg = `(SELECT p.package_id FROM rdl.rdl_package p JOIN rdl.rdl_release r ON r.release_id=p.release_id JOIN rdl.rdl_source s ON s.source_id=r.source_id WHERE s.source_key='cfihos' AND r.release_key='cfihos-2.0' ORDER BY p.package_id DESC LIMIT 1)`;

const tagIds = new Set(rows("tagClass").map(r => t(r, "tagClassId")).filter(Boolean));
const equipmentIds = new Set(rows("equipmentClass").map(r => t(r, "equipmentClassId")).filter(Boolean));
const classDocExpected = rows("classDocument").reduce((n, r) => n + Number(tagIds.has(t(r,"classId"))) + Number(equipmentIds.has(t(r,"classId"))), 0);
const classSourceExpected = rows("classSourceStandard").reduce((n, r) => n + Number(tagIds.has(t(r,"classId"))) + Number(equipmentIds.has(t(r,"classId"))), 0);
const sourceMappingClassExpected = rows("sourceMapping").reduce((n, r) => n + Number(tagIds.has(t(r,"classId"))) + Number(equipmentIds.has(t(r,"classId"))), 0);
const expectedRelationships: Array<[string, string, number]> = [
  ["class properties", "class_property", rows("tagClassProperty").length + rows("equipmentClassProperty").length],
  ["discipline documents", "document_discipline", rows("disciplineDocument").filter(r => new Set(rows("discipline").map(d => t(d,"disciplineCode").toLowerCase())).has(t(r,"disciplineRefCode").toLowerCase())).length],
  ["tag/equipment mappings", "tag_equipment_mapping", rows("tagEquipment").length],
  ["controlled-list values", "controlled_list_value", rows("controlledValue").length],
  ["class documents", "class_document", classDocExpected],
  ["class source standards", "entity_source_standard", classSourceExpected],
  ["mapping-to-property", "mapping_property", rows("sourceMapping").length],
  ["mapping-to-standard", "mapping_standard", rows("sourceMapping").length],
];
for (const [label, type, expected] of expectedRelationships) {
  const actual = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship WHERE package_id=${ccusPkg} AND relationship_type_code='${type}'`);
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS CCUS relationship ${label}: ${actual}`);
}
const mappingClassActual = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship WHERE package_id=${ccusPkg} AND relationship_type_code IN ('mapping_tag_class','mapping_equipment_class')`);
assert.equal(mappingClassActual, sourceMappingClassExpected);
console.log(`PASS CCUS relationship mapping-to-class: ${mappingClassActual}`);

const sharedDiscipline = rows("discipline").map(r=>t(r,"disciplineId")).find(id=>id.startsWith("CFIHOS-"));
assert.ok(sharedDiscipline, "CCUS workbook should retain at least one core CFIHOS discipline identifier");
const ccusShared = await ccus.getEntity("discipline", sharedDiscipline);
const cfihosShared = await cfihos.getEntity("discipline", sharedDiscipline);
assert.ok(ccusShared && cfihosShared, `Shared identifier ${sharedDiscipline} must exist independently in both packages`);
assert.notEqual(ccusShared.packageKey, cfihosShared.packageKey);
console.log(`PASS multi-RDL identity: ${sharedDiscipline} coexists independently in CFIHOS and CCUS packages`);

const cfihosSnapshot = JSON.parse(readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"));
assert.equal(await cfihos.countEntities("tag_class"), cfihosSnapshot.sheets["tag class"].rows.length);
assert.equal(await cfihos.countEntities("equipment_class"), cfihosSnapshot.sheets["equipment class"].rows.length);
assert.equal(await cfihos.countEntities("property"), cfihosSnapshot.sheets.property.rows.length);
console.log("PASS CFIHOS isolation: existing CFIHOS entity counts remain unchanged after CCUS ingestion");

const ccusRuns = await qCount(`SELECT count(*)::text AS count FROM ingestion.ingestion_run WHERE package_id=${ccusPkg} AND adapter_key='${profile.profileKey}' AND status='completed'`);
assert.equal(ccusRuns, 1, "idempotent reload should leave one current CCUS ingestion audit record for the package");
console.log("PASS idempotence: repeat CCUS load produces one deterministic package state and one current audit record");

const crossPackageRelationships = await qCount(`SELECT count(*)::text AS count FROM rdl.rdl_relationship rel JOIN rdl.rdl_entity s ON s.entity_id=rel.source_entity_id JOIN rdl.rdl_entity t ON t.entity_id=rel.target_entity_id WHERE rel.package_id=${ccusPkg} AND s.package_id<>t.package_id`);
assert.equal(crossPackageRelationships, 0);
console.log("PASS package isolation: no authoritative CCUS relationship crosses into the CFIHOS package");

console.log("PASS RDL-007 CCUS multi-RDL ingestion and coexistence");
