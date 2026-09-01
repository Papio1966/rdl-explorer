import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);

const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const browse = read("src/components/RdlReleaseAwareBrowse.tsx");
const searchSource = read("src/rdl/search.ts");
const tagPage = read("src/pages/TagClassesPage.tsx");
const equipmentPage = read("src/pages/EquipmentClassesPage.tsx");
const documentPage = read("src/pages/DocumentTypesPage.tsx");
const propertyPage = read("src/pages/DataDictionaryPage.tsx");
const standardPage = read("src/pages/SourceStandardsPage.tsx");
const disciplinePage = read("src/pages/DisciplinesPage.tsx");
const unitPage = read("src/pages/UnitsOfMeasurePage.tsx");

const search = JSON.parse(read("public/rdl-search-index.json")) as Array<{
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
}>;
const relationships = JSON.parse(read("public/rdl-relationship-index.json")) as Array<{
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
}>;

const primaryTypes = [
  "tag_class",
  "equipment_class",
  "document_type",
  "property",
  "source_standard",
  "discipline",
  "unit_of_measure",
] as const;

for (const entityType of primaryTypes) {
  must(guard.includes(`"${entityType}"`), `shared browse boundary lost ${entityType}`);
}
must(guard.includes('scope === "cfihos" || scope === "all"'), "CFIHOS specialist browse boundary changed during readiness audit");
must(!browse.includes("cfihosRepository"), "generic browse shell must remain source-neutral");
must(browse.includes("record.nativeIdentifier, record.name, record.definition"), "generic browse search baseline changed unexpectedly");

for (const field of ["aliases", "searchText", "secondaryLabel", "tertiaryLabel", "facets"]) {
  must(!searchSource.includes(`${field}?:`), `RDL-035.1 baseline unexpectedly already exposes normalized ${field}`);
}

const expectations: Record<(typeof primaryTypes)[number], { records: number; parents: number; label: string }> = {
  tag_class: { records: 848, parents: 847, label: "Tag Classes" },
  equipment_class: { records: 832, parents: 831, label: "Equipment Classes" },
  document_type: { records: 329, parents: 0, label: "Document Types" },
  property: { records: 1388, parents: 0, label: "Properties" },
  source_standard: { records: 305, parents: 0, label: "Source Standards" },
  discipline: { records: 34, parents: 0, label: "Disciplines" },
  unit_of_measure: { records: 1472, parents: 0, label: "Units of Measure" },
};

const cfihos = search.filter((item) => item.sourceKey === "cfihos" && item.releaseKey === "cfihos-2.0");
const keys = new Set(cfihos.map((item) => `${item.packageKey}|${item.entityType}|${item.nativeIdentifier}`));
let totalParents = 0;
for (const entityType of primaryTypes) {
  const records = cfihos.filter((item) => item.entityType === entityType);
  const packageKeys = new Set(records.map((item) => item.packageKey));
  const parents = relationships.filter((item) =>
    item.sourceKey === "cfihos" &&
    item.releaseKey === "cfihos-2.0" &&
    packageKeys.has(item.packageKey) &&
    item.relationshipType === "entity_parent" &&
    item.sourceEntityType === entityType &&
    item.targetEntityType === entityType
  );
  assert.equal(records.length, expectations[entityType].records, `${entityType} indexed record count changed`);
  assert.equal(parents.length, expectations[entityType].parents, `${entityType} same-type parent count changed`);
  for (const row of parents) {
    must(keys.has(`${row.packageKey}|${entityType}|${row.sourceNativeIdentifier}`), `missing hierarchy child ${row.sourceNativeIdentifier}`);
    must(keys.has(`${row.packageKey}|${entityType}|${row.targetNativeIdentifier}`), `missing hierarchy parent ${row.targetNativeIdentifier}`);
  }
  totalParents += parents.length;
  console.log(`RDL-035.1 CFIHOS ${expectations[entityType].label}: records=${records.length}; parents=${parents.length}; mode=${parents.length ? "hierarchy" : "flat"}`);
}
assert.equal(totalParents, 1678, "CFIHOS same-type hierarchy relationship total changed");

// Specialist capability evidence that must be preserved before cutover.
for (const token of ["parentName", "...tagClass.synonyms", "node.abstract"]) must(tagPage.includes(token), `Tag Class specialist capability missing: ${token}`);
for (const token of ["parentName", "existenceReason", "...equipmentClass.synonyms", "node.abstract"]) must(equipmentPage.includes(token), `Equipment specialist capability missing: ${token}`);
for (const token of ["shortCode", "classification", "...documentType.synonyms"]) must(documentPage.includes(token), `Document Type specialist capability missing: ${token}`);
for (const token of ["dataType", "unitOfMeasureDimensionCode", "picklistName", "existenceReason", "...property.synonyms"]) must(propertyPage.includes(token), `Property specialist capability missing: ${token}`);
for (const token of ["standard.code", "standard.description"]) must(standardPage.includes(token), `Source Standard specialist capability missing: ${token}`);
for (const token of ["discipline.code", "discipline.name", "discipline.description"]) must(disciplinePage.includes(token), `Discipline specialist capability missing: ${token}`);
for (const token of ["uneceCommonCode", "unit.symbol", "dimensionFilter", "dimensionCode", "dimensionName", "systemCode", "systemName", "...unit.synonyms"]) must(unitPage.includes(token), `Unit specialist capability missing: ${token}`);

// Source Standards are already naturally represented: indexed name is code; definition is description.
const standardAnchor = cfihos.find((item) => item.entityType === "source_standard" && item.nativeIdentifier === "CFIHOS-90000001");
must(Boolean(standardAnchor?.name && standardAnchor?.definition), "Source Standard code/description projection anchor missing");

console.log("PASS RDL-035.1 CFIHOS shared browse readiness audit: structurally ready; 6/7 browse families require generic metadata parity before cutover");
