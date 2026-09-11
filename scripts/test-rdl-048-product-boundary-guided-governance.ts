import fs from "node:fs";
import assert from "node:assert/strict";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

const appShell = read("src/components/AppShell.tsx");
const app = read("src/App.tsx");
const boundaryPage = read("src/pages/RdlProductBoundaryPage.tsx");
const guidance = read("src/rdl/productBoundaryGuidance.ts");
const guideComponent = read("src/components/RouteWorkflowGuide.tsx");
const governancePage = read("src/pages/RdlGovernancePage.tsx");
const proposalLabels = read("src/rdl/proposalBundleGovernanceDecisionService.ts");
const doc = read("docs/development/RDL_048_PRODUCT_BOUNDARY_GUIDED_GOVERNANCE_UX.md");

assert.ok(appShell.includes("RDL / DataGate Boundary"), "Boundary page must be visible in navigation.");
assert.ok(!appShell.includes("CIS Builder"), "CIS Builder must not remain in primary navigation.");
assert.ok(!appShell.includes('label: "Contract"'), "Contract/CIS primary section must be removed.");
assert.ok(!appShell.includes('label: "Quality"'), "Project validation quality section must not remain primary in RDL Explorer.");
assert.ok(appShell.includes("<RouteWorkflowGuide />"), "Route-level workflow guide must be rendered before page content.");

assert.ok(app.includes('path="/boundary"'), "RDL / DataGate boundary route must be registered.");
assert.ok(app.includes('path="/cis" element={<RdlProductBoundaryPage />}'), "Legacy CIS route must redirect to boundary page.");
assert.ok(app.includes('path="/cis-preview" element={<RdlProductBoundaryPage />}'), "Legacy CIS preview route must redirect to boundary page.");

for (const required of [
  "Project CIS authoring, CIS preview, project tailoring, EPC validation, findings and resubmission workflows belong to DataGate.",
  "RDL Explorer owns",
  "DataGate owns",
  "Governance decision language",
]) {
  assert.ok(boundaryPage.includes(required), `Boundary page missing: ${required}`);
}

for (const required of [
  "Project CIS authoring, tailoring and validation belongs to DataGate",
  "Confirm same concept / merge candidate",
  "Keep as separate concepts",
  "Request further analysis",
  "Consequences to check before confirming",
]) {
  assert.ok(guidance.includes(required) || guideComponent.includes(required), `Guidance missing: ${required}`);
}

for (const required of [
  "How to use this screen",
  "Where this sits in the workflow",
  "Decision guidance",
  "Consequences to check before confirming",
]) {
  assert.ok(guideComponent.includes(required), `RouteWorkflowGuide missing: ${required}`);
}

for (const required of [
  "Confirm same concept",
  "Reject match",
  "Retire / supersede",
]) {
  assert.ok(governancePage.includes(required), `Mapping governance page missing clearer decision label: ${required}`);
}

for (const required of [
  "Accept candidate for governance processing",
  "Reject proposal bundle",
  "Link to publication evidence",
]) {
  assert.ok(proposalLabels.includes(required), `Proposal governance labels missing: ${required}`);
}

for (const required of [
  "CIS capability belongs to DataGate",
  "Operate and Govern screens require in-product helper guidance",
  "Preserve the RDL-047/RDL-046/RDL-045/RDL-044 contract stack",
]) {
  assert.ok(doc.includes(required), `RDL-048 documentation missing: ${required}`);
}

console.log("PASS RDL-048 product boundary and guided governance UX contract: CIS primary navigation removed, boundary page present, guided Operate/Govern help present and decision language clarified");
