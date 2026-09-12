import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string): string {
  return fs.readFileSync(path, "utf8");
}

const backslashQuote = String.fromCharCode(92, 34);
const backslashSingleQuote = String.fromCharCode(92, 39);

assert.ok(fs.existsSync("docs/development/RDL_049_LINT_BASELINE_REDUCTION.md"), "Missing RDL-049 architecture document");
assert.ok(fs.existsSync("src/rdl/rdlScopeContextValue.ts"), "Missing separated RDL scope hook/context support module");
assert.ok(!read("src/rdl/RdlScopeContext.tsx").includes("export function useRdlScope"), "Provider module must not export the hook");
assert.ok(read("src/rdl/rdlScopeContextValue.ts").includes("export function useRdlScope"), "Hook must be exported from the support module");
assert.ok(read("src/rdl/RdlScopeContext.tsx").includes("[scope, releaseKey, setReleaseKey]"), "RDL scope provider dependencies must include setReleaseKey");
assert.ok(read("src/rdl/RdlScopeContext.tsx").includes("const setReleaseKey = useCallback("), "setReleaseKey must be memoized to keep the zero-warning hook dependency baseline stable");
assert.ok(read("src/rdl/RdlScopeContext.tsx").includes("}, [scope]);"), "setReleaseKey callback must depend on scope only");
assert.ok(read("src/rdl/rdlScopeContextValue.ts").includes('import type { RdlScopeKey } from "./catalog";'), "RDL scope support module must import RdlScopeKey from catalog");
assert.ok(!read("src/rdl/rdlScopeContextValue.ts").includes("rdlScopeData"), "RDL scope support module must not import a non-existent rdlScopeData module");
assert.ok(!read("src/components/RdlReleaseAwareBrowse.tsx").includes("searchParamKey"), "Release-aware browse must not keep an unused searchParamKey symbol");

const appRegression = read("scripts/test-app-regression.ts");
assert.ok(!appRegression.includes(`path=${backslashQuote}`), "Route assertions must not use useless escaped quotes");
assert.ok(!appRegression.includes(`label: ${backslashQuote}`), "Navigation assertions must not use useless escaped quotes");
assert.ok(appRegression.includes('path="${route}"') || appRegression.includes('to="${route}'), "Route assertions must remain present");
assert.ok(appRegression.includes('label: "${label}"'), "Navigation assertions must remain present");

const runtimeProjection = read("server/rdl/RdlRuntimeProjectionRepository.ts");
assert.ok(!runtimeProjection.includes('add("tag_class", classId) || add("equipment_class", classId)'), "Runtime projection must not rely on unused expression side effects");
assert.ok(runtimeProjection.includes("if (!addedTagClass)"), "Runtime projection must preserve fallback equipment-class indexing explicitly");

const snapshotRead = read("server/rdl/SnapshotRdlReadRepository.ts");
assert.ok(!snapshotRead.includes("rows.map((r, i)"), "Snapshot controlled values must not declare unused map index");

const appShell = read("src/components/AppShell.tsx");
assert.ok(!appShell.includes("next.has(label) ? next.delete(label) : next.add(label)"), "AppShell toggle must not use an unused conditional expression");
assert.ok(appShell.includes("if (next.has(label))"), "AppShell toggle should use explicit control flow");

const foundation = read("scripts/test-rdl-0361-runtime-projection-foundation.ts");
assert.ok(!foundation.includes(backslashSingleQuote), "RDL-0361 regex assertions must not use useless escaped single quotes");

assert.ok(!read("scripts/generate-validation-snapshot.ts").includes("function countDuplicates"), "Unused countDuplicates helper must be removed");
assert.ok(!read("scripts/db-test-rdl-007-multi-rdl.ts").includes("const cfihosPkg ="), "Unused cfihosPkg variable must be removed");
assert.ok(read("src/pages/LifecycleRequirementsPage.tsx").includes("if (!activePhase?.key) return;"), "Lifecycle phase reset should depend on activePhase key only");
assert.ok(read("src/components/RdlReleaseAwareBrowse.tsx").includes("[state, facetDefinitions, searchParams]"), "Release-aware browse memo must depend on searchParams directly");
assert.ok(read("src/pages/CisBuilderPage.tsx").includes("const createWorkingDocumentRef = useRef(createWorkingDocument)"), "CIS autosave must use a stable ref to avoid dependency loops");
assert.ok(read("src/pages/CisBuilderPage.tsx").includes("createWorkingDocumentRef.current(savedAt)"), "CIS autosave effect must read the working-document factory through the stable ref");
assert.ok(!read("api/distribution/package.ts").includes('`\\"sha256-'), "Distribution package ETag must not use useless escaped quotes");
assert.ok(!read("api/distribution/manifest.ts").includes('`\\"sha256-'), "Distribution manifest ETag must not use useless escaped quotes");

console.log("PASS - RDL-049 lint baseline reduction static contract");
