import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

function text(path: string) {
  assert.ok(existsSync(path), `Missing expected RDL-047 file: ${path}`);
  return readFileSync(path, "utf8");
}

const policy = text("server/rdl/ProposalBundleGovernanceDecisionPolicy.ts");
assert.match(policy, /PROPOSAL_BUNDLE_GOVERNANCE_ACTIONS/);
assert.match(policy, /start_review/);
assert.match(policy, /accept/);
assert.match(policy, /reject/);
assert.match(policy, /withdraw/);
assert.match(policy, /link_publication/);
assert.match(policy, /Review rationale must be between 10 and 2000 characters/);
assert.match(policy, /expectedVersion/);
assert.match(policy, /incomplete candidate and must fail closed on accept/);
assert.match(policy, /unresolved required dependencies/);
assert.match(policy, /proposalBundleCanTransitionToAccepted/);

const bundleService = text("server/rdl/ExternalStandardsProposalBundleService.ts");
assert.match(bundleService, /ProposalBundleGovernanceDecisionPolicy/);
assert.match(bundleService, /validateProposalBundleDecisionCommand\(\{ action, rationale, expectedVersion/);
assert.match(bundleService, /PROPOSAL_BUNDLE_GOVERNANCE_ACTIONS/);
assert.match(bundleService, /repository\.review/);

const bundleRepository = text("server/rdl/ExternalStandardsProposalBundleRepository.ts");
assert.match(bundleRepository, /review_external_standards_proposal_bundle/);
assert.match(bundleRepository, /expectedVersion/);
assert.match(bundleRepository, /publicationResult/);
assert.match(bundleRepository, /actorKey/);

const readback = text("server/rdl/ExternalStandardsProposalBundleReadbackService.ts");
assert.match(readback, /acceptanceDoesNotPublish:\s*true/);
assert.match(readback, /publicationAuthority:\s*"RDL_EXPLORER_ONLY"/);
assert.match(readback, /canAccept/);
assert.match(readback, /incomplete_fail_closed/);
assert.match(readback, /Bundle is an incomplete candidate and must fail closed on accept/);

const api = text("api/proposals/bundle-review.ts");
assert.match(api, /bundle-review/);
assert.match(api, /review/);

const client = text("src/rdl/proposalBundleGovernanceDecisionService.ts");
assert.match(client, /submitProposalBundleDecision/);
assert.match(client, /\/api\/proposals\/bundle-review/);
assert.match(client, /expectedVersion/);
assert.match(client, /Review rationale must be between 10 and 2000 characters/);

const actions = text("src/rdl/ProposalBundleGovernanceActions.tsx");
assert.match(actions, /Proposal bundle governance actions/);
assert.match(actions, /Review version/);
assert.match(actions, /failClosedReason/);
assert.match(actions, /start_review/);
assert.match(actions, /accept/);
assert.match(actions, /link_publication/);

const db = text("database/sql/test_rdl_047_proposal_governance_decision_workflow.sql");
assert.match(db, /review_external_standards_proposal_bundle/);
assert.match(db, /expectedVersion/);
assert.match(db, /rationale/);
assert.match(db, /actor/);
assert.match(db, /link_publication/);

const doc = text("docs/development/RDL_047_PROPOSAL_GOVERNANCE_DECISION_WORKFLOW.md");
assert.match(doc, /Proposal Governance Decision Workflow/);
assert.match(doc, /fail closed/);
assert.match(doc, /optimistic/);
assert.match(doc, /DataGate/);

console.log("PASS RDL-047 proposal governance decision workflow contract: policy, API/service, readback, UX action surface, database and documentation boundaries are present");
