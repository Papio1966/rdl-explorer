import fs from "node:fs";
import assert from "node:assert/strict";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

const model = read("src/rdl/mappingGovernanceDecisionModel.ts");
const governancePage = read("src/pages/RdlGovernancePage.tsx");
const doc = read("docs/development/RDL_050_MAPPING_GOVERNANCE_DECISION_WORKFLOW.md");

for (const decision of [
  "Confirm same concept / merge candidate",
  "Keep as separate concepts",
  "Reject match",
  "Retire / supersede one concept",
  "Request further analysis",
]) {
  assert.ok(model.includes(decision), `RDL-050 model missing decision option: ${decision}`);
  assert.ok(doc.includes(decision), `RDL-050 documentation missing decision option: ${decision}`);
}

for (const evidence of [
  "Concept / class name",
  "Description / definition",
  "Properties",
  "Relationships",
  "Documents",
  "Units and controlled values",
  "Source standard and envelope level",
]) {
  assert.ok(model.includes(evidence), `RDL-050 model missing evidence dimension: ${evidence}`);
  assert.ok(doc.includes(evidence.toLowerCase()) || doc.includes(evidence), `RDL-050 documentation missing evidence dimension: ${evidence}`);
}

for (const consequence of [
  "Proposed standards change",
  "Unchanged items",
  "Downstream consumer impact",
  "DataGate / project-validation impact",
  "Reversibility and follow-up checks",
]) {
  assert.ok(model.includes(consequence), `RDL-050 model missing consequence topic: ${consequence}`);
  assert.ok(doc.includes(consequence.toLowerCase()) || doc.includes(consequence), `RDL-050 documentation missing consequence topic: ${consequence}`);
}

for (const auditField of [
  "Decision type",
  "Rationale",
  "Evidence basis",
  "Reviewer role",
  "Timestamp",
  "Reversibility status",
  "Related publication or follow-up state",
]) {
  assert.ok(model.includes(auditField), `RDL-050 model missing audit/readback field: ${auditField}`);
}

for (const requiredPageText of [
  "Rdl050MappingGovernanceWorkflowGuide",
  "MAPPING_GOVERNANCE_DECISION_OPTIONS",
  "MAPPING_GOVERNANCE_EVIDENCE_DIMENSIONS",
  "MAPPING_GOVERNANCE_CONSEQUENCE_PREVIEW",
  "MAPPING_GOVERNANCE_AUDIT_READBACK_FIELDS",
  "RDL_EXPLORER_DATAGATE_MAPPING_BOUNDARY",
  "Evidence comparison panel",
  "Pre-confirmation consequence preview",
  "Audit / readback fields",
]) {
  assert.ok(governancePage.includes(requiredPageText), `RDL-050 governance page missing workflow integration: ${requiredPageText}`);
}

assert.ok(governancePage.includes("../rdl/mappingGovernanceDecisionModel"), "RDL-050 governance page must import the decision model.");
assert.ok(model.includes("RDL Explorer governs mapping decisions"), "RDL/DataGate governance boundary must be explicit in the model.");
assert.ok(doc.includes("does not introduce project CIS authoring"), "RDL-050 documentation must preserve the DataGate/CIS boundary.");

console.log("PASS - RDL-050 mapping governance decision workflow contract: guided decision options, evidence comparison, consequence preview, audit/readback and RDL/DataGate boundary are represented");
