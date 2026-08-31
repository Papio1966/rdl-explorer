import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);

const app = read("src/App.tsx");
const redirect = read("src/components/RdlLegacyEntityRedirect.tsx");
const explorerE2e = read("tests/e2e/explorer.spec.ts");
const convergenceE2e = read("tests/e2e/rdl-legacy-route-convergence.spec.ts");
const packageJson = read("package.json");

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
  must(app.includes(`path="${path}"`), `legacy detail route missing: ${path}`);
  must(
    app.includes(`<RdlLegacyEntityRedirect entityType="${entityType}" paramName="${paramName}" />`),
    `legacy detail route does not converge through the canonical redirect: ${path}`,
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
  must(app.includes(`path="${browseRoute}"`), `browse route was removed during convergence: ${browseRoute}`);
}

must(!app.includes('detailParam="tagClassId"'), "Tag Class specialist detail route is still active");
must(!app.includes('detailParam="equipmentClassId"'), "Equipment Class specialist detail route is still active");
must(!app.includes('detailParam="documentTypeId"'), "Document Type specialist detail route is still active");
must(!app.includes('detailParam="disciplineId"'), "Discipline specialist detail route is still active");
must(!app.includes('detailParam="propertyId"'), "Property specialist detail route is still active");
must(!app.includes('detailParam="sourceStandardId"'), "Source Standard specialist detail route is still active");
must(!app.includes('detailParam="unitId"'), "Unit specialist detail route is still active");

must(redirect.includes('const CFIHOS_SOURCE_KEY = "cfihos"'), "legacy convergence does not explicitly pin CFIHOS source identity");
must(redirect.includes('const CFIHOS_RELEASE_KEY = "cfihos-2.0"'), "legacy convergence does not explicitly pin CFIHOS release identity");
must(redirect.includes("rdlEntityRoute("), "legacy convergence does not use the canonical route helper");
must(redirect.includes("location.search"), "legacy query-string context is not preserved");
must(redirect.includes("replace"), "legacy redirect should replace browser history rather than add an intermediate detail page");
must(!redirect.includes("getDefaultReleaseKey"), "legacy redirect must not infer the CFIHOS release from a mutable default");

must(explorerE2e.includes("legacy CFIHOS Tag Class detail route converges to generic detail"), "Explorer regression suite does not validate Tag Class convergence");
must(explorerE2e.includes("#rdl-properties"), "Explorer regression suite still expects specialist Tag Class anchors");
must(explorerE2e.includes("#rdl-units-of-measure"), "Explorer regression suite still expects specialist Property anchors");
must(explorerE2e.includes("#rdl-property-mappings"), "Explorer regression suite still expects specialist Source Standard anchors");
must(!explorerE2e.includes("#tag-properties"), "Explorer E2E still depends on the specialist Tag Class detail anchor");
must(!explorerE2e.includes("#dictionary-units"), "Explorer E2E still depends on the specialist Property detail anchor");
must(!explorerE2e.includes("#source-standard-properties"), "Explorer E2E still depends on the specialist Source Standard detail anchor");

for (const route of [
  "/classes/tag/CFIHOS-30000521",
  "/classes/equipment/CFIHOS-30000395",
  "/documents/CFIHOS-70000007",
  "/disciplines/CFIHOS-20000015",
  "/dictionary/CFIHOS-40000509",
  "/standards/CFIHOS-90000061",
  "/units/CFIHOS-60000001",
]) {
  must(convergenceE2e.includes(route), `Chromium convergence coverage missing legacy route: ${route}`);
}

must(convergenceE2e.includes("from=legacy&view=compact"), "Chromium convergence coverage does not prove query-string preservation");
must(packageJson.includes('"test:rdl-032"'), "RDL-032 package test script missing");
must(packageJson.includes("test-rdl-032-legacy-route-convergence.ts"), "RDL-032 aggregate contract does not include route convergence");

console.log("PASS RDL-032.3 legacy CFIHOS detail routes converge to canonical release-aware entity detail");
