import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const app = read("src/App.tsx");
const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const browse = read("src/components/RdlReleaseAwareBrowse.tsx");
const regression = read("scripts/test-app-regression.ts");
const rdl033 = read("scripts/test-rdl-033-specialist-detail-retirement.ts");
const rdl035 = read("scripts/test-rdl-035-cfihos-browse-readiness.ts");

const retiredFiles = [
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

for (const path of retiredFiles) {
  must(!existsSync(path), `retired specialist browse artifact still exists: ${path}`);
}

for (const pageName of [
  "TagClassesPage",
  "EquipmentClassesPage",
  "DocumentTypesPage",
  "DataDictionaryPage",
  "SourceStandardsPage",
  "DisciplinesPage",
  "UnitsOfMeasurePage",
]) {
  must(!app.includes(pageName), `App.tsx still loads retired specialist browse component: ${pageName}`);
}

const sharedRoutes = [
  ['path="/classes/tag"', 'entityType="tag_class" title="Tag Classes" />'],
  ['path="/classes/equipment"', 'entityType="equipment_class" title="Equipment Classes" />'],
  ['path="/documents"', 'entityType="document_type" title="Document Types" />'],
  ['path="/disciplines"', 'entityType="discipline" title="Disciplines" />'],
  ['path="/dictionary"', 'entityType="property" title="Data Dictionary" />'],
  ['path="/standards"', 'entityType="source_standard" title="Source Standards" />'],
  ['path="/units"', 'entityType="unit_of_measure" title="Units of Measure" />'],
] as const;

for (const [routeToken, guardToken] of sharedRoutes) {
  const routeOffset = app.indexOf(routeToken);
  must(routeOffset >= 0, `primary browse route missing: ${routeToken}`);
  const routeLineEnd = app.indexOf("\n", routeOffset);
  const routeLine = app.slice(routeOffset, routeLineEnd < 0 ? undefined : routeLineEnd);
  must(routeLine.includes("<RdlScopedLegacyGuard"), `primary browse route no longer uses shared scope guard: ${routeToken}`);
  must(routeLine.includes(guardToken), `primary browse route does not directly select the shared browser contract: ${routeToken}`);
}

must(guard.includes("children?: ReactNode"), "scope guard children are still mandatory after specialist browse retirement");
for (const entityType of ["tag_class", "equipment_class", "document_type", "property", "source_standard", "discipline", "unit_of_measure"]) {
  must(guard.includes(`"${entityType}"`), `shared browse capability lost ${entityType}`);
}
must(guard.includes('if (scope === "all") {'), "All-RDL scope no longer fails closed on source-specific browse");
must(guard.includes("Select an RDL source"), "All-RDL fail-closed guidance is missing");
must(guard.includes('if (usesSharedBrowse && entityType)'), "shared release-aware browse branch was removed");
must(guard.includes('sourceKey={scope}') && guard.includes('releaseKey={releaseKey}') && guard.includes('entityType={entityType}'), "shared browse lost explicit source/release/type identity");
must(guard.includes('if (scope === "cfihos") return <>{children}</>;'), "specialized CFIHOS capabilities lost their intentional fallback boundary");

must(app.includes('<RdlScopedLegacyGuard title="Lifecycle Requirements" specialized><LifecycleRequirementsPage /></RdlScopedLegacyGuard>'), "Lifecycle Requirements specialist capability was altered");
must(app.includes('<RdlScopedLegacyGuard title="Data Model" specialized><DataModelPage /></RdlScopedLegacyGuard>'), "Data Model specialist capability was altered");

must(!browse.toLowerCase().includes("cfihos"), "generic release-aware browser became CFIHOS-specific during retirement");
must(browse.includes('relationship.relationshipType === "entity_parent"'), "authoritative hierarchy rule was lost");
must(browse.includes("item.sourceKey === sourceKey") && browse.includes("item.releaseKey === releaseKey") && browse.includes("item.entityType === entityType"), "release-aware browse isolation was weakened");

for (const repository of [
  "src/cfihos/repository/CfihosRepository.ts",
  "src/cfihos/repository/CfihosEquipmentRepository.ts",
  "src/cfihos/repository/CfihosDocumentRepository.ts",
  "src/cfihos/repository/CfihosPropertyRepository.ts",
  "src/cfihos/repository/CfihosSourceStandardRepository.ts",
  "src/cfihos/repository/CfihosUnitOfMeasureRepository.ts",
]) {
  must(existsSync(repository), `non-browse CFIHOS repository was incorrectly retired: ${repository}`);
}

must(!regression.includes('read("src/pages/TagClassesPage.tsx")'), "application regression still reads retired browse pages");
must(rdl033.includes("specialist browse artifact survived retirement"), "RDL-033 historical contract was not advanced to full browse retirement");
must(rdl035.includes("retired CFIHOS specialist browse page survived convergence"), "RDL-035 parity contract still depends on specialist browse implementations");

assert.equal(
  sha256("public/rdl-search-index.json"),
  "646c8e6a2ce2550832f971c943a69fc467b3ac55d8fc563748364f82d757dfcb",
  "search index changed during specialist browse retirement",
);
assert.equal(
  sha256("public/rdl-relationship-index.json"),
  "2159133bb2c02151cecbf4cf0fbba890463d4926feb7e9568379fb85e24d2927",
  "relationship index changed during specialist browse retirement",
);

console.log(`PASS RDL-035.4 specialist browse retirement: ${retiredFiles.length} obsolete browse artifacts removed; shared release-aware routes and non-browse CFIHOS repositories preserved`);
