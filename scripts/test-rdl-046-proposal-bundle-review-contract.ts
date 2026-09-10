import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string { return readFileSync(path, "utf8"); }

const readbackService = read("server/rdl/ExternalStandardsProposalBundleReadbackService.ts");
const queueApi = read("api/proposals/bundle-queue.ts");
const detailApi = read("api/proposals/bundle-detail.ts");
const clientService = read("src/rdl/proposalBundleReviewService.ts");
const page = read("src/pages/RdlProposalBundleReviewPage.tsx");
const dbTest = read("database/sql/test_rdl_046_proposal_bundle_review_readback.sql");
const doc = read("docs/development/RDL_046_PROPOSAL_BUNDLE_REVIEW_GOVERNANCE.md");

assert.match(readbackService, /ExternalStandardsProposalBundleReadbackService/);
assert.match(readbackService, /external_standards_proposal_bundle_queue/);
assert.match(readbackService, /external_standards_proposal_bundle_component/);
assert.match(readbackService, /external_standards_proposal_bundle_dependency/);
assert.match(readbackService, /external_standards_proposal_bundle_event/);
assert.match(readbackService, /acceptanceDoesNotPublish: true/);
assert.match(readbackService, /RDL_EXPLORER_ONLY/);
assert.match(readbackService, /PROHIBITED/);
assert.match(readbackService, /incomplete_fail_closed/);

assert.match(queueApi, /rdl-external-standards-proposal-bundle-queue\/v1/);
assert.match(queueApi, /authenticatedProposalReviewContext/);
assert.match(detailApi, /rdl-external-standards-proposal-bundle-detail\/v1/);
assert.match(detailApi, /proposalBundleId/);
assert.match(detailApi, /requestKey/);

assert.match(clientService, /proposalBundleCanBeAccepted/);
assert.match(clientService, /fetchProposalBundleQueue/);
assert.match(clientService, /fetchProposalBundleDetail/);
assert.match(page, /Proposal bundle review/);
assert.match(page, /acceptance does not publish/);
assert.match(page, /direct DataGate database mutation is prohibited/);

assert.match(dbTest, /incomplete bundle acceptance did not fail closed/);
assert.match(dbTest, /publication remains separate/);
assert.match(doc, /RDL-046/);
assert.match(doc, /DataGate implementation is out of scope/);
assert.match(doc, /RDL Explorer remains the governance and publication authority/);

console.log("PASS RDL-046 proposal bundle review/readback contract: API, service, UX surface, database and documentation boundaries are present");
