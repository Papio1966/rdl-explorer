import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);

const app = read("src/App.tsx");
const redirect = read("src/components/RdlLegacyEntityRedirect.tsx");
const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const packageJson = read("package.json");
const regression = read("scripts/test-app-regression.ts");

const retiredBrowseFiles = [
  "src/pages/TagClassesPage.tsx",
  "src/pages/TagClassesPage.css",
  "src/pages/EquipmentClassesPage.tsx",
  "src/pages/EquipmentClassesPage.css",
  "src/pages/DocumentTypesPage.tsx",
  "src/pages/DocumentTypesPage.css",
  "src/pages/DataDictionaryPage.tsx",
  "src/pages/DataDictionaryPage.css",
  "src/pages/SourceStandardsPage.tsx",
  "src/pages/SourceStandardsPage.css",
  "src/pages/DisciplinesPage.tsx",
  "src/pages/DisciplinesPage.css",
  "src/pages/UnitsOfMeasurePage.tsx",
  "src/pages/UnitsOfMeasurePage.css",
] as const;

for (const path of retiredBrowseFiles) {
  must(!existsSync(path), `specialist browse artifact survived retirement: ${path}`);
}

for (const retiredPageName of [
  "TagClassesPage",
  "EquipmentClassesPage",
  "DocumentTypesPage",
  "DataDictionaryPage",
  "SourceStandardsPage",
  "DisciplinesPage",
  "UnitsOfMeasurePage",
]) {
  must(!app.includes(retiredPageName), `App.tsx still imports retired specialist browse component: ${retiredPageName}`);
}

const routeExpectations = [
  ["/classes/tag/:tagClassId", "tag_class", "tagClassId"],
  ["/classes/equipment/:equipmentClassId", "equipment_class", "equipmentClassId"],
  ["/documents/:documentTypeId", "document_type", "documentTypeId"],
  ["/disciplines/:disciplineId", "discipline", "disciplineId"],
  ["/dictionary/:propertyId", "property", "propertyId"],
  ["/standards/:sourceStandardId", "source_standard", "sourceStandardId"],
  ["/units/:unitId", "unit_of_measure", "unitId"],
] as const;

for (const [path, entityType, paramName] of routeExpectations) {
  must(app.includes(`path="${path}"`), `legacy detail route missing after browse retirement: ${path}`);
  must(
    app.includes(`<RdlLegacyEntityRedirect entityType="${entityType}" paramName="${paramName}" />`),
    `legacy detail route no longer uses canonical redirect: ${path}`,
  );
}

for (const browseRoute of [
  "/classes/tag",
  "/classes/equipment",
  "/documents",
  "/disciplines",
  "/dictionary",
  "/standards",
  "/units",
]) {
  must(app.includes(`path="${browseRoute}"`), `browse route removed during specialist retirement: ${browseRoute}`);
}

must(!guard.includes("useParams"), "legacy scope guard must not own route-parameter detail state");
must(!guard.includes("detailParam"), "legacy scope guard still exposes retired detailParam API");
must(guard.includes('if (scope === "all") {'), "legacy scope guard lost truthful All-RDL handling");
must(guard.includes("Select an RDL source"), "legacy scope guard lost fail-closed All-RDL message");
must(guard.includes("CFIHOS data is never used as a silent fallback"), "legacy scope guard lost fail-closed scope messaging");

must(redirect.includes('const CFIHOS_SOURCE_KEY = "cfihos"'), "legacy redirect lost explicit CFIHOS source pin");
must(redirect.includes('const CFIHOS_RELEASE_KEY = "cfihos-2.0"'), "legacy redirect lost explicit CFIHOS release pin");
must(redirect.includes("rdlEntityRoute("), "legacy redirect no longer targets canonical entity detail");
must(!redirect.includes("getDefaultReleaseKey"), "legacy redirect must not infer a mutable release default");

must(regression.includes("shared browse retirement"), "application regression contract was not updated for specialist browse retirement");
must(regression.includes("RdlRelationshipSection.tsx"), "application regression contract does not verify canonical progressive disclosure");
must(packageJson.includes('"test:rdl-033"'), "RDL-033 package test script missing");

console.log(`PASS RDL-033 specialist detail retirement remains complete after specialist browse retirement (${retiredBrowseFiles.length} obsolete browse artifacts absent)`);
