import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const url = process.env.RDL_DATABASE_URL;
if (!url) throw new Error("RDL_DATABASE_URL is required");
const workbook = JSON.parse(readFileSync(new URL("../public/cfihos-workbook.json", import.meta.url), "utf8"));
const rows = (name: string) => workbook.sheets[name]?.rows ?? [];
const q = (sql: string) => execFileSync("psql", [url, "-At", "-c", sql], { encoding: "utf8" }).trim();
const count = (sql: string) => Number(q(sql));
const pkg = "(SELECT package_id FROM rdl.rdl_package p JOIN rdl.rdl_release r USING(release_id) JOIN rdl.rdl_source s USING(source_id) WHERE s.source_key='cfihos' AND r.release_key='cfihos-2.0' ORDER BY p.package_id DESC LIMIT 1)";

const entityExpectations: Array<[string,string,number]> = [
  ["tag classes", "tag_class", rows("tag class").length],
  ["equipment classes", "equipment_class", rows("equipment class").length],
  ["properties", "property", rows("property").length],
  ["document types", "document_type", rows("document type").length],
  ["disciplines", "discipline", rows("discipline").length],
  ["units", "unit_of_measure", rows("unit of measure").length],
  ["source standards", "source_standard", rows("source standard").length],
  ["handover events", "handover_event", rows("handover event").length],
  ["controlled values", "controlled_value", rows("property picklist values").length],
  ["JIP33 information requirements", "information_requirement", new Set(rows("Jip33 info required spec").map((r: Record<string, unknown>) => String(r["Source standard document and data requirement CFIHOS unique code"] ?? "").trim()).filter(Boolean)).size],
  ["source property mappings", "source_mapping", rows("tag equip class prop src std").length],
];
for (const [label,type,expected] of entityExpectations) {
  const actual=count(`SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${pkg} AND entity_type_code='${type}'`);
  if(actual!==expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS parity ${label}: ${actual}`);
}
const relExpectations: Array<[string,string,number]> = [
  ["tag class properties", "class_property", rows("tag class property").length + rows("equipment class property").length],
  ["discipline documents", "document_discipline", rows("discipline document type").length],
  ["tag/equipment mappings", "tag_equipment_mapping", rows("tag equipment class relationshi").length],
  ["controlled-list values", "controlled_list_value", rows("property picklist values").length],
];
for (const [label,type,expected] of relExpectations) {
  const actual=count(`SELECT count(*) FROM rdl.rdl_relationship WHERE package_id=${pkg} AND relationship_type_code='${type}'`);
  if(actual!==expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  console.log(`PASS parity ${label}: ${actual}`);
}
const tag=count(`SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${pkg} AND entity_type_code='tag_class' AND native_identifier='CFIHOS-30000521'`);
const equipment=count(`SELECT count(*) FROM rdl.rdl_entity WHERE package_id=${pkg} AND entity_type_code='equipment_class' AND native_identifier='CFIHOS-30000521'`);
if(tag!==1 || equipment!==1) throw new Error("Typed identity parity failed for CFIHOS-30000521");
console.log("PASS typed identity: CFIHOS-30000521 exists independently as tag and equipment class");
const sourceSha=q(`SELECT content_sha256 FROM rdl.rdl_package WHERE package_id=${pkg}`);
if(sourceSha!==workbook.source.sha256) throw new Error(`Package SHA mismatch: ${sourceSha}`);
console.log("PASS provenance: package SHA matches reviewed snapshot");
const ingestion=count(`SELECT count(*) FROM ingestion.ingestion_run WHERE package_id=${pkg} AND adapter_key='cfihos-snapshot-v1' AND status='completed'`);
if(ingestion<1) throw new Error("No completed CFIHOS ingestion run recorded");
console.log("PASS ingestion audit: completed run recorded");
console.log("PASS RDL-004 CFIHOS PostgreSQL parity baseline");
