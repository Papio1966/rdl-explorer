import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type SearchRecord = { sourceKey:string; releaseKey:string; packageKey:string; entityType:string; nativeIdentifier:string; name:string };
type RelationshipRecord = { sourceKey:string; releaseKey:string; packageKey:string; relationshipType:string; sourceEntityType:string; sourceNativeIdentifier:string; targetEntityType:string; targetNativeIdentifier:string; sourceSheet:string };

const read = (path:string) => readFileSync(path,"utf8");
const must = (condition:boolean,message:string) => assert.ok(condition,message);
const relationships = JSON.parse(read("public/rdl-relationship-index.json")) as RelationshipRecord[];
const search = JSON.parse(read("public/rdl-search-index.json")) as SearchRecord[];

assert.ok(relationships.length > 100, "generic relationship index is unexpectedly small");
for (const source of ["cfihos","ccus","water-desalination"]) {
  assert.ok(relationships.some((item)=>item.sourceKey===source), `${source} is missing from generic relationship index`);
}
for (const release of ["ccus-0.1-draft","ccus-2.0-candidate","water-desalination-0.1-draft","water-desalination-2.0-candidate"]) {
  assert.ok(relationships.some((item)=>item.releaseKey===release), `${release} relationships are missing`);
}
for (const type of ["entity_parent","class_property","tag_equipment_mapping","class_document","entity_source_standard"]) {
  assert.ok(relationships.some((item)=>item.relationshipType===type), `${type} is missing from generic relationship projection`);
}

const entityKeys = new Set(search.map((item)=>`${item.packageKey}|${item.entityType}|${item.nativeIdentifier}`));
assert.ok(search.some((item)=>item.sourceKey==="cfihos" && item.entityType==="tag_class" && item.nativeIdentifier==="CFIHOS-30000880"), "known CFIHOS tag-only class regression anchor is missing");
assert.ok(!search.some((item)=>item.sourceKey==="cfihos" && item.entityType==="equipment_class" && item.nativeIdentifier==="CFIHOS-30000880"), "known CFIHOS tag-only class unexpectedly exists as equipment");
const ccusSourceStandard = search.find((item)=>item.releaseKey==="ccus-2.0-candidate" && item.entityType==="source_standard" && item.nativeIdentifier==="CCUSRDL-90000001");
assert.equal(ccusSourceStandard?.name, "ISO 27914:2026", "CCUS v2 source-standard human-readable name was lost during search projection");
const waterSourceStandard = search.find((item)=>item.releaseKey==="water-desalination-2.0-candidate" && item.entityType==="source_standard" && item.nativeIdentifier==="WATERRDL-90000001");
assert.equal(waterSourceStandard?.name, "ISO 24516-2:2019", "Water v2 source-standard human-readable name was lost during search projection");
assert.ok(!relationships.some((item)=>item.sourceKey==="cfihos" && item.sourceEntityType==="equipment_class" && item.sourceNativeIdentifier==="CFIHOS-30000880"), "CFIHOS document typing anomaly leaked a phantom equipment relationship");
for (const relationship of relationships) {
  must(Boolean(relationship.sourceKey && relationship.releaseKey && relationship.packageKey && relationship.sourceSheet), "relationship provenance is incomplete");
  must(entityKeys.has(`${relationship.packageKey}|${relationship.sourceEntityType}|${relationship.sourceNativeIdentifier}`), `relationship source is not present in the same release package: ${relationship.relationshipType} ${relationship.sourceNativeIdentifier}`);
  must(entityKeys.has(`${relationship.packageKey}|${relationship.targetEntityType}|${relationship.targetNativeIdentifier}`), `relationship target is not present in the same release package: ${relationship.relationshipType} ${relationship.targetNativeIdentifier}`);
}

for (const releaseKey of ["ccus-2.0-candidate","water-desalination-2.0-candidate"]) {
  const releaseRows = relationships.filter((item)=>item.releaseKey===releaseKey);
  assert.ok(releaseRows.some((item)=>item.relationshipType==="class_property"), `${releaseKey} has no class-property relationships`);
  assert.ok(releaseRows.some((item)=>item.relationshipType==="class_document"), `${releaseKey} has no class-document relationships`);
}

const service = read("src/rdl/entityDetail.ts");
must(service.includes('item.releaseKey === record.releaseKey') && service.includes('item.packageKey === record.packageKey'), "generic detail projection is not package/release isolated");
must(service.includes('rdlEntityRoute(record.sourceKey, record.releaseKey'), "related-entity links do not preserve explicit release identity");
must(service.includes('information_requirement_class') && service.includes('information_requirement_document'), "generic information-requirement projection missing");

const page = read("src/pages/RdlEntityPage.tsx");
for (const id of ["rdl-definition","rdl-classification","rdl-hierarchy","rdl-properties","rdl-related-classes","rdl-required-documents","rdl-information-requirements","rdl-source-standards","rdl-provenance"]) {
  must(page.includes(id), `generic rich detail anchor missing: ${id}`);
}
must(page.includes('aria-label="On this page"'), "generic entity detail contents navigation missing");
must(page.includes("Historical and successor packages cannot silently leak"), "release-isolation explanation missing");

const component = read("src/components/RdlRelationshipSection.tsx");
must(component.includes("DISCLOSURE_THRESHOLD = 10") && component.includes("COLLAPSED_COUNT = 5"), "progressive disclosure contract changed");
must(component.includes('aria-expanded={expanded}') && component.includes("Show less"), "accessible progressive disclosure controls missing");

const packageJson = read("package.json");
must(packageJson.includes('"generate:rdl-relationship-index"') && packageJson.includes('"test:rdl-031"'), "RDL-031 package scripts missing");

const e2e = read("tests/e2e/rdl-rich-navigation.spec.ts");
must(e2e.includes("generic rich RDL detail preserves explicit release context") && e2e.includes("AxeBuilder"), "RDL-031 browser and accessibility gates missing");

console.log(`PASS RDL-031 generic rich navigation contract (${relationships.length} release-aware relationships)`);
