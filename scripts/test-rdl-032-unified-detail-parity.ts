import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type SearchRecord = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
};

type RelationshipRecord = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  attributes: Record<string, string>;
  sourceSheet: string;
};

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);
const relationships = JSON.parse(read("public/rdl-relationship-index.json")) as RelationshipRecord[];
const search = JSON.parse(read("public/rdl-search-index.json")) as SearchRecord[];

const entityKeys = new Set(search.map((item) => `${item.packageKey}|${item.entityType}|${item.nativeIdentifier}`));
for (const relationship of relationships) {
  must(Boolean(relationship.sourceKey && relationship.releaseKey && relationship.packageKey && relationship.sourceSheet), "relationship provenance is incomplete");
  must(entityKeys.has(`${relationship.packageKey}|${relationship.sourceEntityType}|${relationship.sourceNativeIdentifier}`), `RDL-032 relationship source is outside its exact release package: ${relationship.relationshipType} ${relationship.sourceNativeIdentifier}`);
  must(entityKeys.has(`${relationship.packageKey}|${relationship.targetEntityType}|${relationship.targetNativeIdentifier}`), `RDL-032 relationship target is outside its exact release package: ${relationship.relationshipType} ${relationship.targetNativeIdentifier}`);
}

for (const relationshipType of [
  "property_unit",
  "property_controlled_value",
  "controlled_value_source_standard",
  "mapping_property_standard",
  "document_discipline",
]) {
  must(relationships.some((item) => item.relationshipType === relationshipType), `${relationshipType} is missing from the static parity projection`);
}

const cfihos = relationships.filter((item) => item.releaseKey === "cfihos-2.0");
must(cfihos.some((item) => item.relationshipType === "property_unit" && item.sourceNativeIdentifier === "CFIHOS-40000509"), "known CFIHOS property lost Units of Measure parity");
must(cfihos.filter((item) => item.relationshipType === "property_controlled_value" && item.sourceNativeIdentifier === "CFIHOS-40000132").length > 10, "known CFIHOS property lost Allowed Values parity");
must(cfihos.some((item) => item.relationshipType === "document_discipline" && item.sourceNativeIdentifier === "CFIHOS-70000007"), "known CFIHOS document lost Discipline requirements parity");
must(cfihos.some((item) => item.relationshipType === "class_document" && item.targetNativeIdentifier === "CFIHOS-70000007"), "known CFIHOS document lost Required by Classes parity");
must(cfihos.filter((item) => item.relationshipType === "document_discipline" && item.targetNativeIdentifier === "CFIHOS-20000015").length > 10, "known CFIHOS Discipline lost Document Type parity");
must(cfihos.some((item) => item.relationshipType === "mapping_property_standard" && item.targetNativeIdentifier === "CFIHOS-90000061"), "known CFIHOS Source Standard lost property-mapping parity");
must(cfihos.some((item) => item.relationshipType === "controlled_value_source_standard" && item.targetNativeIdentifier === "CFIHOS-90000061"), "known CFIHOS Source Standard lost controlled-value provenance parity");

const waterCurrent = relationships.filter((item) => item.releaseKey === "water-desalination-2.0-candidate");
must(waterCurrent.some((item) => item.relationshipType === "property_unit"), "Water v2 has no release-aware property/unit projection");
must(waterCurrent.some((item) => item.relationshipType === "property_controlled_value"), "Water v2 has no release-aware allowed-value projection");

const service = read("src/rdl/entityDetail.ts");
must(service.includes('assignmentType: depth === 0 ? "direct" : "inherited"'), "effective property inheritance semantics are missing");
must(service.includes('item.releaseKey === record.releaseKey') && service.includes('item.packageKey === record.packageKey'), "entity-detail parity is not release/package isolated");
for (const field of ["usedByClasses", "requiredByClasses", "disciplines", "documentTypes", "unitsOfMeasure", "allowedValues", "propertyMappings", "controlledValues"]) {
  must(service.includes(field), `generic detail projection missing parity field: ${field}`);
}

const page = read("src/pages/RdlEntityPage.tsx");
for (const anchor of [
  "rdl-units-of-measure",
  "rdl-allowed-values",
  "rdl-used-by-classes",
  "rdl-required-by-classes",
  "rdl-disciplines",
  "rdl-document-types",
  "rdl-property-mappings",
  "rdl-picklist-values",
]) {
  must(page.includes(anchor), `generic parity anchor missing: ${anchor}`);
}
must(page.includes('"Related Equipment Classes"') && page.includes('"Related Tag Classes"'), "class-specific relationship labels are missing");

const component = read("src/components/RdlRelationshipSection.tsx");
must(component.includes("DISCLOSURE_THRESHOLD = 10") && component.includes("COLLAPSED_COUNT = 5"), "progressive disclosure parity changed");
must(component.includes('aria-controls={listId}') && component.includes('aria-expanded={expanded}'), "generic progressive disclosure does not expose accessible controls");
must(!component.includes(".slice(0, 3)"), "relationship metadata is still arbitrarily truncated to three fields");

const generator = read("scripts/generate-rdl-relationship-index.ts");
for (const relationshipType of ["property_unit", "property_controlled_value", "controlled_value_source_standard", "mapping_property_standard"]) {
  must(generator.includes(`"${relationshipType}"`), `generator does not materialize ${relationshipType}`);
}
must(generator.includes("Relationship endpoint is not present in the exact release package"), "exact endpoint integrity guard was removed");

const packageJson = read("package.json");
must(packageJson.includes('"test:rdl-032"'), "RDL-032 package test script missing");
const e2e = read("tests/e2e/rdl-entity-detail-parity.spec.ts");
must(e2e.includes("generic CFIHOS property detail reaches unit and controlled-value parity") && e2e.includes("AxeBuilder"), "RDL-032 Chromium parity/accessibility gate missing");

console.log(`PASS RDL-032 unified entity-detail parity foundation (${relationships.length} release-aware relationships)`);
