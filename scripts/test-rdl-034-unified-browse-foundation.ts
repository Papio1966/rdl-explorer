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
must(guard.includes('entityType === "tag_class"'), "RDL-034.1 is not scoped to Tag Classes");
must(guard.includes('sourceKey={scope}') && guard.includes('releaseKey={releaseKey}') && guard.includes('entityType={entityType}'), "browse shell is not explicitly source/release/type scoped");
must(guard.includes('item.releaseKey === releaseKey'), "existing non-Tag generic fallback lost release isolation");
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
must(css.includes(".rdl-release-browse") && css.includes("grid-template-columns:340px"), "generic browse shell lost the established two-panel navigation pattern");
must(pkg.includes('"test:rdl-034"'), "RDL-034 package contract missing");
must(app.includes('path="/classes/tag"'), "Tag Classes browse route missing");

must(browse.includes('className="rdl-release-browse-tree-toggle rdl-release-browse-tree-toggle-static"'), "leaf hierarchy affordance is not rendered as inert content");
must(browse.includes('aria-hidden="true"'), "leaf hierarchy affordance is not hidden from assistive technology");
must(!browse.includes('aria-label={hasChildren ?'), "leaf hierarchy still creates an unnamed button branch");
must(css.includes(".rdl-release-browse-tree-toggle-static{cursor:default}"), "leaf hierarchy affordance styling is missing");
must(explorerE2e.includes('toHaveAttribute("data-source-key", "water-desalination")'), "scope-isolation E2E still depends on the retired generic-card banner");
must(explorerE2e.includes('toHaveAttribute("data-source-key", "ccus")'), "scope-isolation E2E does not verify CCUS shared-browse identity");

const releases = [
  ["water-desalination", "water-desalination-2.0-candidate"],
  ["ccus", "ccus-2.0-candidate"],
] as const;

const entityKeys = new Set(search.map((item) => `${item.packageKey}|${item.entityType}|${item.nativeIdentifier}`));
for (const [sourceKey, releaseKey] of releases) {
  const tagRecords = search.filter((item) => item.sourceKey === sourceKey && item.releaseKey === releaseKey && item.entityType === "tag_class");
  must(tagRecords.length > 0, `${releaseKey} has no Tag Classes to browse`);
  const packageKeys = new Set(tagRecords.map((item) => item.packageKey));
  const parentRows = relationships.filter((item) =>
    item.sourceKey === sourceKey &&
    item.releaseKey === releaseKey &&
    packageKeys.has(item.packageKey) &&
    item.relationshipType === "entity_parent" &&
    item.sourceEntityType === "tag_class" &&
    item.targetEntityType === "tag_class"
  );
  for (const row of parentRows) {
    must(entityKeys.has(`${row.packageKey}|tag_class|${row.sourceNativeIdentifier}`), `${releaseKey} hierarchy child is outside the release package: ${row.sourceNativeIdentifier}`);
    must(entityKeys.has(`${row.packageKey}|tag_class|${row.targetNativeIdentifier}`), `${releaseKey} hierarchy parent is outside the release package: ${row.targetNativeIdentifier}`);
  }
  console.log(`RDL-034 ${sourceKey}: ${tagRecords.length} Tag Classes; ${parentRows.length} authoritative parent relationships`);
}

console.log("PASS RDL-034.1 unified release-aware Tag Class browse foundation");
