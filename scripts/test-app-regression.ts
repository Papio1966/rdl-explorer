import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const app = read("src/App.tsx");
const shell = read("src/components/AppShell.tsx");
const assistantApi = read("api/assistant.ts");
const cisBuilder = read("src/pages/CisBuilderPage.tsx");
const assistant = read("src/pages/AssistantPage.tsx");
const about = read("src/pages/AboutPage.tsx");
const help = read("src/pages/HelpPage.tsx");
const tagClasses = read("src/pages/TagClassesPage.tsx");
const equipmentClasses = read("src/pages/EquipmentClassesPage.tsx");
const documentTypes = read("src/pages/DocumentTypesPage.tsx");
const dataDictionary = read("src/pages/DataDictionaryPage.tsx");
const sourceStandards = read("src/pages/SourceStandardsPage.tsx");
const disciplines = read("src/pages/DisciplinesPage.tsx");

const productBoundary = read("docs/PRODUCT_BOUNDARY.md");
const architecture = read("docs/ARCHITECTURE.md");
const roadmap = read("docs/ROADMAP.md");
const requirements = read("docs/REQUIREMENTS.md");
const indexHtml = read("index.html");
const packageJson = read("package.json");

const routes = [
  "/classes/tag",
  "/classes/equipment",
  "/documents",
  "/disciplines",
  "/lifecycle",
  "/dictionary",
  "/standards",
  "/units",
  "/model",
  "/validation",
  "/assistant",
  "/cis",
  "/about",
  "/help",
];

for (const route of routes) {
  assert.ok(app.includes(`path=\"${route}\"`) || app.includes(`to=\"${route}`), `Missing application route ${route}`);
}

for (const label of [
  "Tag Classes",
  "Equipment Classes",
  "Document Types",
  "Lifecycle Requirements",
  "AI Assistant",
  "CIS Builder",
  "Validation",
  "About RDL Explorer",
  "User Guide",
]) {
  assert.ok(shell.includes(`label: \"${label}\"`), `Missing navigation item ${label}`);
}

assert.ok(app.includes("lazyNamed"), "Routes are no longer lazy loaded");
assert.ok(app.includes("<Suspense"), "Lazy routes must remain behind a Suspense boundary");
assert.ok(app.includes('role="status"'), "Route loading fallback must remain accessible");

assert.ok(cisBuilder.includes("localStorage"), "CIS Builder persistence contract is missing");
assert.ok(assistant.includes("ACTIVE CIS") || assistant.includes("Active CIS"), "Assistant active-CIS context indicator is missing");
assert.ok(assistant.includes("/api/assistant"), "Assistant no longer calls the server-side API endpoint");

assert.ok(assistantApi.includes("OPENAI_API_KEY"), "Assistant API key must remain server-side");
assert.ok(assistantApi.includes("OPENAI_MODEL"), "Assistant model configuration is missing");
assert.ok(assistantApi.includes("store: false"), "OpenAI request must continue to disable response storage");
assert.ok(assistantApi.includes("method") && assistantApi.includes("POST"), "Assistant endpoint must validate POST requests");


assert.ok(shell.includes('brand-name">RDL<'), "Application shell must identify the product as RDL Explorer");
assert.ok(indexHtml.includes("<title>RDL Explorer</title>"), "Browser title must identify RDL Explorer");
assert.ok(packageJson.includes('"name": "rdl-explorer"'), "Package identity must be rdl-explorer");
assert.ok(productBoundary.includes("CFIHOS Explorer") && productBoundary.includes("RDL Explorer"), "Product boundary must document the separation from CFIHOS Explorer");
assert.ok(architecture.includes("PostgreSQL") && architecture.includes("DataGate"), "Architecture must document the PostgreSQL target and DataGate boundary");
assert.ok(roadmap.includes("RDL-002") && roadmap.includes("RDL-008"), "Roadmap must capture the staged RDL platform programme");
assert.ok(requirements.includes("RDL-MODEL-001") && requirements.includes("RDL-DG-001"), "Requirements must capture RDL identity and DataGate integration constraints");

assert.ok(shell.includes("pilot-badge"), "Pilot status badge is missing from the application shell");
assert.ok(shell.includes("CFIHOS 2.0 reviewed snapshot"), "Pilot data-source provenance is missing from the shell");
assert.ok(shell.includes("Global search coming soon") && shell.includes("disabled"), "Unimplemented global search must remain visibly disabled during pilot");
assert.ok(shell.includes("alessandro@papioconsulting.eu"), "Pilot feedback route is missing from the application shell");
assert.ok(about.includes("controlled evaluation") && about.includes("pilot"), "About page must explain pilot status");
assert.ok(help.includes("not enabled in this pilot"), "User Guide must explain the global-search pilot limitation");
assert.ok(help.includes("Do not include confidential project information"), "Pilot feedback guidance must warn against confidential information");

for (const [name, source] of [["Tag Classes", tagClasses], ["Equipment Classes", equipmentClasses]] as const) {
  assert.ok(source.includes('aria-label="On this page"'), `${name} detail page must expose an On this page navigator`);
  assert.ok(source.includes("COLLAPSE_THRESHOLD = 10"), `${name} must retain the long-list collapse threshold`);
  assert.ok(source.includes("COLLAPSED_ITEM_COUNT = 5"), `${name} must retain the five-item collapsed preview`);
  assert.ok(source.includes("aria-expanded={expanded}"), `${name} expansion controls must expose their state accessibly`);
}

assert.ok(documentTypes.includes('aria-label="On this page"'), "Document Types detail page must expose an On this page navigator");
assert.ok(documentTypes.includes("COLLAPSE_THRESHOLD = 10"), "Document Types must retain the long-list collapse threshold");
assert.ok(documentTypes.includes("COLLAPSED_ITEM_COUNT = 5"), "Document Types must retain the five-item collapsed preview");
assert.ok(documentTypes.includes("aria-expanded={expanded}"), "Document Types expansion controls must expose their state accessibly");
assert.ok(documentTypes.includes('id="document-required-by-classes"'), "Document Types must expose a stable Required by Classes anchor");

assert.ok(dataDictionary.includes('aria-label="On this page"'), "Data Dictionary property detail must expose an On this page navigator");
assert.ok(dataDictionary.includes("COLLAPSE_THRESHOLD = 10"), "Data Dictionary must retain the long-list collapse threshold");
assert.ok(dataDictionary.includes("COLLAPSED_ITEM_COUNT = 5"), "Data Dictionary must retain the five-item collapsed preview");
assert.ok(dataDictionary.includes("aria-expanded={expanded}"), "Data Dictionary expansion controls must expose their state accessibly");
assert.ok(dataDictionary.includes('id="dictionary-units"'), "Data Dictionary must expose a stable Units of Measure anchor");
assert.ok(dataDictionary.includes('id="dictionary-tag-classes"'), "Data Dictionary must expose a stable Used by Tag Classes anchor");
assert.ok(dataDictionary.includes('id="dictionary-picklist-values"'), "Data Dictionary must expose a stable Allowed Values anchor");


assert.ok(sourceStandards.includes('aria-label="On this page"'), "Source Standards detail page must expose an On this page navigator");
assert.ok(sourceStandards.includes("COLLAPSE_THRESHOLD = 10"), "Source Standards must retain the long-list collapse threshold");
assert.ok(sourceStandards.includes("COLLAPSED_ITEM_COUNT = 5"), "Source Standards must retain the five-item collapsed preview");
assert.ok(sourceStandards.includes("aria-expanded={expanded}"), "Source Standards expansion controls must expose their state accessibly");
assert.ok(sourceStandards.includes('id="source-standard-classes"'), "Source Standards must expose a stable Classes anchor");
assert.ok(sourceStandards.includes('id="source-standard-jip33"'), "Source Standards must expose a stable JIP33 anchor");
assert.ok(sourceStandards.includes('id="source-standard-properties"'), "Source Standards must expose a stable Property mappings anchor");
assert.ok(sourceStandards.includes('id="source-standard-picklist-values"'), "Source Standards must expose a stable Picklist values anchor");

assert.ok(disciplines.includes("COLLAPSE_THRESHOLD = 10"), "Disciplines must retain the long-list collapse threshold");
assert.ok(disciplines.includes("COLLAPSED_ITEM_COUNT = 5"), "Disciplines must retain the five-item collapsed preview");
assert.ok(disciplines.includes("aria-expanded={documentTypesExpanded}"), "Discipline expansion control must expose its state accessibly");
assert.ok(disciplines.includes('id="discipline-document-types-list"'), "Disciplines must expose a stable Document Types list target");

console.log(`PASS routes: ${routes.length} critical application routes registered.`);
console.log("PASS navigation: critical Explorer capabilities remain discoverable.");
console.log("PASS performance contract: route-level lazy loading and accessible fallback are present.");
console.log("PASS CIS/Assistant contract: persistence, active CIS context and server-side AI boundary are present.");
console.log("PASS RDL-001 bootstrap: product identity, architecture, roadmap and requirements are present.");
console.log("PASS pilot readiness: status, provenance, honest search state and feedback route are present.");
console.log("PASS class detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS document detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS property detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS Source Standard detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS Discipline detail UX: long Document Type relationships use accessible progressive disclosure.");
console.log("\nApplication regression checks passed.");
