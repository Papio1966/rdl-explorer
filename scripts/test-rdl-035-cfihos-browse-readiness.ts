import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const text = (value: unknown) => value == null ? "" : String(value).trim();
const truthy = (value: unknown) => ["yes", "y", "true", "1"].includes(text(value).toLowerCase());

function existenceReason(row: Record<string, unknown>): string {
  for (const [key, value] of Object.entries(row)) {
    const normalized = key.toLowerCase();
    if (normalized.includes("existence") && normalized.includes("reason") && text(value)) return text(value);
  }
  return "";
}

const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const browse = read("src/components/RdlReleaseAwareBrowse.tsx");
const browseCss = read("src/components/RdlReleaseAwareBrowse.css");
const searchSource = read("src/rdl/search.ts");
const generator = read("scripts/generate-rdl-search-index.ts");
const browserE2e = read("tests/e2e/rdl-unified-browse.spec.ts");

const search = JSON.parse(read("public/rdl-search-index.json")) as Array<{
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string;
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  badges?: string[];
  facets?: Record<string, { value: string; label?: string }>;
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
const snapshot = JSON.parse(read("public/cfihos-workbook.json")) as {
  sheets: Record<string, { rows: Array<Record<string, unknown>> }>;
};

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
must(!guard.includes('if (scope === "cfihos" || scope === "all") return <>{children}</>;'), "combined CFIHOS/all specialist browse branch survived cutover");
must(guard.includes('if (scope === "all") {'), "all-scope browse must be handled explicitly");
must(guard.includes("Select an RDL source"), "all-scope browse does not fail closed with a truthful source-selection message");
must(!guard.includes('if (scope === "all") return <>{children}</>;'), "all-scope browse silently exposes CFIHOS specialist content");
must(guard.includes('if (scope === "cfihos") return <>{children}</>;'), "non-shared CFIHOS specialist fallback must remain available for specialized capabilities");
const sharedBranchOffset = guard.indexOf('if (usesSharedBrowse && entityType)');
const cfihosFallbackOffset = guard.indexOf('if (scope === "cfihos") return <>{children}</>;');
must(sharedBranchOffset >= 0 && cfihosFallbackOffset > sharedBranchOffset, "CFIHOS shared browse branch does not take precedence over the specialist fallback");
must(!browse.toLowerCase().includes("cfihos"), "generic browse shell must remain source-neutral");

for (const field of ["aliases", "searchText", "secondaryLabel", "tertiaryLabel", "badges", "facets"]) {
  must(searchSource.includes(`${field}?:`), `normalized browse projection missing optional field: ${field}`);
}
for (const token of ["rdlSearchableValues", "recordMatchesRdlQuery", "record.aliases", "record.searchText", "record.facets"]) {
  must(searchSource.includes(token), `generic search contract missing metadata token: ${token}`);
}
for (const token of [
  "genericBrowseMetadata",
  "compactMetadata",
  "unit of measure dimension code CFIHOS unique code",
  "unit of measure synonym name",
  "document type short code",
  "property data type",
  "discipline code",
  'facets: dimensionValue ? { dimension:',
]) {
  must(generator.includes(token), `search-index generator missing normalized metadata projection token: ${token}`);
}
for (const token of [
  "useSearchParams",
  "buildFacetDefinitions",
  "recordMatchesRdlQuery",
  "Filter ${title} by ${facet.label}",
  "data-filtered-record-count",
  "secondaryLabel",
  "tertiaryLabel",
  "RecordBadges",
]) {
  must(browse.includes(token), `shared browser missing source-neutral metadata/facet token: ${token}`);
}
must(browseCss.includes(".rdl-release-browse-facets"), "generic facet styling missing");
must(browseCss.includes(".rdl-release-browse-search-result-meta"), "generic metadata-row styling missing");
must(browseCss.includes(".rdl-release-browse-badge"), "generic badge styling missing");
for (const token of ["Filter Units of Measure by Dimension", "runtimeRecord", "facets?.dimension", "secondaryLabel"]) {
  must(browserE2e.includes(token), `GitHub Chromium metadata/facet proof missing: ${token}`);
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
}
assert.equal(totalParents, 1678, "CFIHOS same-type hierarchy relationship total changed");

// RDL-035.4 retires the old CFIHOS browse implementations only after Chromium parity was proven.
for (const path of [
  "src/pages/TagClassesPage.tsx",
  "src/pages/EquipmentClassesPage.tsx",
  "src/pages/DocumentTypesPage.tsx",
  "src/pages/DataDictionaryPage.tsx",
  "src/pages/SourceStandardsPage.tsx",
  "src/pages/DisciplinesPage.tsx",
  "src/pages/UnitsOfMeasurePage.tsx",
]) {
  must(!existsSync(path), `retired CFIHOS specialist browse page survived convergence: ${path}`);
}

const byType = (entityType: string) => cfihos.filter((item) => item.entityType === entityType);
const tags = byType("tag_class");
const equipment = byType("equipment_class");
const documents = byType("document_type");
const properties = byType("property");
const disciplines = byType("discipline");
const units = byType("unit_of_measure");

must(tags.some((record) => record.secondaryLabel?.startsWith("Parent: ")), "Tag Class parent metadata projection missing");
must(tags.some((record) => record.badges?.includes("Abstract")), "Tag Class abstract badge projection missing");
must(equipment.some((record) => record.secondaryLabel?.startsWith("Parent: ")), "Equipment parent metadata projection missing");
must(equipment.some((record) => record.badges?.includes("Abstract")), "Equipment abstract badge projection missing");
must(documents.some((record) => record.secondaryLabel), "Document Type short-code projection missing");
must(documents.some((record) => record.tertiaryLabel), "Document Type classification projection missing");
must(properties.some((record) => record.secondaryLabel), "Property datatype projection missing");
must(properties.some((record) => record.tertiaryLabel), "Property picklist/dimension projection missing");
must(disciplines.some((record) => record.secondaryLabel), "Discipline code projection missing");
must(units.some((record) => record.secondaryLabel), "Unit symbol/UNECE projection missing");
must(units.some((record) => record.tertiaryLabel), "Unit dimension display projection missing");
must(units.some((record) => record.facets?.dimension?.value), "Unit dimension facet projection missing");

function indexed(entityType: string, nativeIdentifier: string) {
  return cfihos.find((record) => record.entityType === entityType && record.nativeIdentifier === nativeIdentifier);
}

function sourceAliasValue(row: Record<string, unknown>, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = text(row[candidate]);
    if (value) return value;
  }
  const keyByNormalized = new Map(Object.keys(row).map((key) => [key.trim().toLowerCase(), key]));
  for (const candidate of candidates) {
    const actual = keyByNormalized.get(candidate.trim().toLowerCase());
    if (!actual) continue;
    const value = text(row[actual]);
    if (value) return value;
  }
  return "";
}

function splitAliasValues(value: string): string[] {
  return [...new Set(value.split(/[;|\n]+/).map((item) => item.trim()).filter(Boolean))];
}

function assertAliasProjection(
  label: string,
  sheet: string,
  entityType: string,
  idField: string,
  aliasFields: string[],
) {
  const sourceRows = snapshot.sheets[sheet]?.rows ?? [];
  let sourceRowsWithAliases = 0;

  for (const row of sourceRows) {
    const nativeIdentifier = text(row[idField]);
    if (!nativeIdentifier) continue;
    const expectedAliases = splitAliasValues(sourceAliasValue(row, aliasFields));
    if (!expectedAliases.length) continue;
    sourceRowsWithAliases += 1;
    const record = indexed(entityType, nativeIdentifier);
    must(Boolean(record), `${label} alias source row is missing from the browse projection: ${nativeIdentifier}`);
    for (const expectedAlias of expectedAliases) {
      must(
        record!.aliases?.includes(expectedAlias) ?? false,
        `${label} alias not projected from authoritative source for ${nativeIdentifier}: ${expectedAlias}`,
      );
    }
  }

  const projectedRowsWithAliases = byType(entityType).filter((record) => record.aliases?.length).length;
  assert.equal(
    projectedRowsWithAliases,
    sourceRowsWithAliases,
    `${label} projected alias population does not match authoritative source population`,
  );
  console.log(`RDL-035.3 ${label} aliases: source rows=${sourceRowsWithAliases}; projected rows=${projectedRowsWithAliases}`);
}

assertAliasProjection("Tag Class", "tag class", "tag_class", "CFIHOS unique code", ["tag class synonym", "tag class synonym name"]);
assertAliasProjection("Equipment Class", "equipment class", "equipment_class", "equipment class CFIHOS unique code", ["equipment class synonym name", "equipment class synonym"]);
assertAliasProjection("Document Type", "document type", "document_type", "CFIHOS unique code", ["document type synonym name", "document type synonym"]);
assertAliasProjection("Property", "property", "property", "CFIHOS unique code", ["property synonym name", "property synonym"]);
assertAliasProjection("Unit of Measure", "unit of measure", "unit_of_measure", "CFIHOS unique code", ["unit of measure synonym name", "unit of measure synonym"]);

const tagSource = (snapshot.sheets["tag class"]?.rows ?? []).find((row) =>
  text(row["CFIHOS unique code"]) && text(row["parent tag class name"]) && (text(row["tag class synonym"]) || truthy(row["abstract class indicator"])),
);
must(Boolean(tagSource), "CFIHOS Tag Class source fidelity anchor missing");
const tagRecord = indexed("tag_class", text(tagSource!["CFIHOS unique code"]));
must(Boolean(tagRecord), "CFIHOS Tag Class browse projection anchor missing");
must(tagRecord!.searchText?.includes(text(tagSource!["parent tag class name"])) ?? false, "Tag Class parent name not searchable through generic projection");
if (text(tagSource!["tag class synonym"])) must(Boolean(tagRecord!.aliases?.length), "Tag Class source synonym not projected");
if (truthy(tagSource!["abstract class indicator"])) must(tagRecord!.badges?.includes("Abstract") ?? false, "Tag Class abstract source flag not projected");

for (const [sheet, entityType, idField] of [
  ["tag class", "tag_class", "CFIHOS unique code"],
  ["equipment class", "equipment_class", "equipment class CFIHOS unique code"],
  ["property", "property", "CFIHOS unique code"],
] as const) {
  const source = (snapshot.sheets[sheet]?.rows ?? []).find((row) => text(row[idField]) && existenceReason(row));
  if (!source) continue;
  const record = indexed(entityType, text(source[idField]));
  must(record?.searchText?.includes(existenceReason(source)) ?? false, `${entityType} existence reason is not searchable through generic projection`);
}

const documentSource = (snapshot.sheets["document type"]?.rows ?? []).find((row) =>
  text(row["CFIHOS unique code"]) && text(row["document type short code"]) && text(row["document type classification"]),
);
must(Boolean(documentSource), "CFIHOS Document Type source fidelity anchor missing");
const documentRecord = indexed("document_type", text(documentSource!["CFIHOS unique code"]));
assert.equal(documentRecord?.secondaryLabel, text(documentSource!["document type short code"]), "Document Type short code projection drifted from source");
assert.equal(documentRecord?.tertiaryLabel, text(documentSource!["document type classification"]), "Document Type classification projection drifted from source");

const propertySource = (snapshot.sheets.property?.rows ?? []).find((row) =>
  text(row["CFIHOS unique code"]) && text(row["property data type"]),
);
must(Boolean(propertySource), "CFIHOS Property source fidelity anchor missing");
const propertyRecord = indexed("property", text(propertySource!["CFIHOS unique code"]));
assert.equal(propertyRecord?.secondaryLabel, text(propertySource!["property data type"]), "Property datatype projection drifted from source");

const unitSource = (snapshot.sheets["unit of measure"]?.rows ?? []).find((row) =>
  text(row["CFIHOS unique code"]) &&
  text(row["unit of measure symbol"]) &&
  text(row["unit of measure dimension code CFIHOS unique code"]),
);
must(Boolean(unitSource), "CFIHOS Unit source fidelity anchor missing");
const unitRecord = indexed("unit_of_measure", text(unitSource!["CFIHOS unique code"]));
must(Boolean(unitRecord), "CFIHOS Unit browse projection anchor missing");
must(unitRecord!.secondaryLabel?.includes(text(unitSource!["unit of measure symbol"])) ?? false, "Unit symbol not projected to generic secondary metadata");
assert.equal(
  unitRecord!.facets?.dimension?.value,
  text(unitSource!["unit of measure dimension code CFIHOS unique code"]),
  "Unit dimension facet identity drifted from authoritative source",
);
const expectedDimensionLabel = text(unitSource!["unit of measure dimension name"]) || text(unitSource!["unit of measure dimension code"]);
if (expectedDimensionLabel) assert.equal(unitRecord!.facets?.dimension?.label, expectedDimensionLabel, "Unit dimension facet label drifted from source");

for (const [sourceKey, releaseKey, expectedCount] of [
  ["water-desalination", "water-desalination-2.0-candidate", 25],
  ["ccus", "ccus-2.0-candidate", 32],
] as const) {
  const sourceUnits = search.filter((record) => record.sourceKey === sourceKey && record.releaseKey === releaseKey && record.entityType === "unit_of_measure");
  assert.equal(sourceUnits.length, expectedCount, `${releaseKey} Unit count changed during metadata projection`);
  must(sourceUnits.some((record) => record.facets?.dimension?.value), `${releaseKey} does not expose a generic Unit dimension facet`);
  must(sourceUnits.some((record) => record.secondaryLabel || record.tertiaryLabel || record.searchText?.length), `${releaseKey} does not expose generic Unit browse metadata`);
  console.log(`RDL-035.3 ${sourceKey}: ${sourceUnits.length} Units; generic metadata and dimension facet projected`);
}

assert.equal(
  sha256("public/rdl-relationship-index.json"),
  "2159133bb2c02151cecbf4cf0fbba890463d4926feb7e9568379fb85e24d2927",
  "relationship index changed during browse-metadata projection",
);
assert.equal(
  sha256("public/rdl-search-index.json"),
  "646c8e6a2ce2550832f971c943a69fc467b3ac55d8fc563748364f82d757dfcb",
  "search index changed during CFIHOS browse convergence",
);

for (const token of [
  'source: "cfihos"',
  'releaseKey: "cfihos-2.0"',
  'CFIHOS metadata search',
  'CFIHOS ${browseType.title} shared browse has no serious or critical accessibility violations',
]) {
  must(browserE2e.includes(token), `GitHub Chromium CFIHOS convergence proof missing: ${token}`);
}

for (const entityType of primaryTypes) {
  const expected = expectations[entityType];
  console.log(`RDL-035.3 CFIHOS ${expected.label}: records=${expected.records}; parents=${expected.parents}; mode=${expected.parents ? "hierarchy" : "flat"}`);
}
console.log("PASS RDL-035.3 CFIHOS shared browse convergence: seven primary browse routes use the source-neutral release-aware browser with metadata parity and truthful all-scope handling");
