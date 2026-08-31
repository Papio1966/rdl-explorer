import fs from "node:fs";

function read(path: string) { return fs.readFileSync(path, "utf8"); }
function must(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const shell = read("src/components/AppShell.tsx");
const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const app = read("src/App.tsx");
const css = read("src/index.css");
const e2e = read("tests/e2e/explorer.spec.ts");

const selector = read("src/components/RdlScopeSelector.tsx");
const pages = [
  "src/pages/RdlControlTowerPage.tsx",
  "src/pages/RdlWorkQueuePage.tsx",
  "src/pages/RdlDistributionPage.tsx",
  "src/pages/RdlConsumerIntegrationPage.tsx",
  "src/pages/RdlReleaseImpactPage.tsx",
  "src/pages/RdlMigrationPlanningPage.tsx",
].map(read).join("\n");

must(shell.includes("nav-heading-button") && shell.includes("aria-expanded={isOpen}"), "Sidebar accordion contract missing");
must(shell.includes('label: "Operate"') && shell.includes('label: "Govern"') && shell.includes('label: "Administration"'), "Coherent navigation groups missing");
must(shell.includes('scopeMode') && shell.includes('mode={scopeMode}'), "Page-type RDL scope/filter contract missing");
must(guard.includes("CFIHOS data is never used as a silent fallback"), "Fail-closed RDL scope guard missing");
must(guard.includes('item.sourceKey === scope'), "Selected RDL package filtering missing");
must(app.includes('entityType="tag_class"') && app.includes('entityType="equipment_class"') && app.includes('entityType="document_type"') && app.includes('entityType="property"'), "Legacy scope-sensitive routes are not guarded");
must(css.includes("Coherent enterprise page surface") && css.includes("rdl-publication-summary-grid") && css.includes("rdl-table-scroll"), "Enterprise page visual system missing");
must(css.includes("scrollbar-width: none") && css.includes(".navigation::-webkit-scrollbar"), "Sidebar hidden-scrollbar navigation contract missing");
must(shell.includes("scrollIntoView({ block: \"nearest\" })"), "Active navigation auto-scroll contract missing");
must(selector.includes("Enterprise workflow RDL view") && selector.includes("All RDLs") && selector.includes("disabled"), "Enterprise workflow all-RDL truthfulness contract missing");
must(!/RDL-0\d{2}\s*[·-]/.test(pages), "Development sprint labels remain visible on enterprise workflow pages");
must(e2e.includes("RDL scope switch never falls back to CFIHOS content") && e2e.includes("WATERRDL-31000001") && e2e.includes("CCUSRDL-31000001"), "Multi-RDL scope switching E2E gate missing");

console.log("PASS RDL-029 UI/UX stabilization and RDL scope integrity contract");
