import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);

const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const browse = read("src/components/RdlReleaseAwareBrowse.tsx");
const css = read("src/components/RdlReleaseAwareBrowse.css");
const pkg = read("package.json");
const app = read("src/App.tsx");
const explorerE2e = read("tests/e2e/explorer.spec.ts");
const unifiedBrowseE2e = read("tests/e2e/rdl-unified-browse.spec.ts");
const search = JSON.parse(read("public/rdl-search-index.json")) as Array<{
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
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

must(guard.includes('import { RdlReleaseAwareBrowse }'), "scope guard does not delegate to the release-aware browse shell");
must(guard.includes('entityType === "tag_class" || entityType === "equipment_class"'), "shared class browse is not enabled for both Tag and Equipment Classes");
must(guard.includes('if (usesSharedClassBrowse && entityType)'), "shared class browse branch is not reusable across class entity types");
must(guard.includes('sourceKey={scope}') && guard.includes('releaseKey={releaseKey}') && guard.includes('entityType={entityType}'), "browse shell is not explicitly source/release/type scoped");
must(guard.includes('item.releaseKey === releaseKey'), "existing non-class generic fallback lost release isolation");
must(guard.includes("CFIHOS data is never used as a silent fallback"), "existing fail-closed scope messaging was lost");

for (const token of [
  "loadRdlSearchIndex",
  "loadRdlRelationshipIndex",
  'relationship.relationshipType === "entity_parent"',
  "item.sourceKey === sourceKey",
  "item.releaseKey === releaseKey",
  "item.entityType === entityType",
  "rdlEntityRoute(",
  "record.releaseKey",
  "record.nativeIdentifier",
  'role="tree"',
  'role="treeitem"',
]) {
  must(browse.includes(token), `release-aware browse foundation missing contract token: ${token}`);
}

for (const forbiddenStatusBranch of ['=== "candidate"', '=== "reviewed"', '=== "draft"', 'includes("candidate")', 'includes("reviewed")']) {
  must(!browse.includes(forbiddenStatusBranch), `navigation paradigm incorrectly branches on release status: ${forbiddenStatusBranch}`);
}

must(!browse.includes("cfihosRepository"), "generic browse shell depends on the CFIHOS repository");
must(!browse.includes("CfihosTagClass"), "generic browse shell depends on CFIHOS Tag Class types");
must(!browse.includes("CfihosEquipmentClass"), "generic browse shell depends on CFIHOS Equipment Class types");
must(browse.includes('entityType === "equipment_class" ? Boxes : Tags'), "shared browse shell does not expose an Equipment Class-specific icon without changing navigation behavior");
must(browse.includes('? "Tag Class"') && browse.includes('? "Equipment Class"'), "shared browse shell lost correct class singular labels");
must(css.includes(".rdl-release-browse") && css.includes("grid-template-columns:340px"), "generic browse shell lost the established two-panel navigation pattern");
must(pkg.includes('"test:rdl-034"'), "RDL-034 package contract missing");
must(app.includes('path="/classes/tag"'), "Tag Classes browse route missing");
must(app.includes('path="/classes/equipment"'), "Equipment Classes browse route missing");

must(browse.includes('className="rdl-release-browse-tree-toggle rdl-release-browse-tree-toggle-static"'), "leaf hierarchy affordance is not rendered as inert content");
must(browse.includes('aria-hidden="true"'), "leaf hierarchy affordance is not hidden from assistive technology");
must(!browse.includes('aria-label={hasChildren ?'), "leaf hierarchy still creates an unnamed button branch");
must(css.includes(".rdl-release-browse-tree-toggle-static{cursor:default}"), "leaf hierarchy affordance styling is missing");
must(explorerE2e.includes('toHaveAttribute("data-source-key", "water-desalination")'), "scope-isolation E2E still depends on the retired generic-card banner");
must(explorerE2e.includes('toHaveAttribute("data-source-key", "ccus")'), "scope-isolation E2E does not verify CCUS shared-browse identity");
must(unifiedBrowseE2e.includes('entityType: "tag_class"') && unifiedBrowseE2e.includes('entityType: "equipment_class"'), "GitHub browser coverage does not exercise both shared class browse types");

const releases = [
  ["water-desalination", "water-desalination-2.0-candidate"],
  ["ccus", "ccus-2.0-candidate"],
] as const;

const expectations = {
  "water-desalination": {
    tag_class: { records: 31, parents: 30 },
    equipment_class: { records: 50, parents: 49 },
  },
  ccus: {
    tag_class: { records: 18, parents: 17 },
    equipment_class: { records: 61, parents: 60 },
  },
} as const;

const entityKeys = new Set(search.map((item) => `${item.packageKey}|${item.entityType}|${item.nativeIdentifier}`));
for (const [sourceKey, releaseKey] of releases) {
  for (const entityType of ["tag_class", "equipment_class"] as const) {
    const records = search.filter((item) => item.sourceKey === sourceKey && item.releaseKey === releaseKey && item.entityType === entityType);
    const expected = expectations[sourceKey][entityType];
    assert.equal(records.length, expected.records, `${releaseKey} ${entityType} record count changed unexpectedly`);
    const packageKeys = new Set(records.map((item) => item.packageKey));
    const parentRows = relationships.filter((item) =>
      item.sourceKey === sourceKey &&
      item.releaseKey === releaseKey &&
      packageKeys.has(item.packageKey) &&
      item.relationshipType === "entity_parent" &&
      item.sourceEntityType === entityType &&
      item.targetEntityType === entityType
    );
    assert.equal(parentRows.length, expected.parents, `${releaseKey} ${entityType} parent relationship count changed unexpectedly`);
    for (const row of parentRows) {
      must(entityKeys.has(`${row.packageKey}|${entityType}|${row.sourceNativeIdentifier}`), `${releaseKey} hierarchy child is outside the release package: ${row.sourceNativeIdentifier}`);
      must(entityKeys.has(`${row.packageKey}|${entityType}|${row.targetNativeIdentifier}`), `${releaseKey} hierarchy parent is outside the release package: ${row.targetNativeIdentifier}`);
    }
    const label = entityType === "tag_class" ? "Tag Classes" : "Equipment Classes";
    console.log(`RDL-034 ${sourceKey}: ${records.length} ${label}; ${parentRows.length} authoritative parent relationships`);
  }
}

console.log("PASS RDL-034.2 unified release-aware Tag and Equipment Class browse convergence");
