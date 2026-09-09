import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const migration = read("database/migrations/024_create_external_standards_proposal_contract.sql");
const sqlTest = read("database/sql/test_rdl_044_external_proposal_contract.sql");
const repository = read("server/rdl/ExternalStandardsProposalRepository.ts");
const service = read("server/rdl/ExternalStandardsProposalService.ts");
const sharedApi = read("api/proposals/_shared.ts");
const submitApi = read("api/proposals/submit.ts");
const reviewApi = read("api/proposals/review.ts");
const statusApi = read("api/proposals/status.ts");
const docs = read("docs/development/RDL_044_DATAGATE_EXTERNAL_PROPOSAL_CONTRACT.md");

assert.match(migration, /CREATE TABLE IF NOT EXISTS rdl\.external_standards_proposal/);
assert.match(migration, /UNIQUE \(consumer_key, request_key\)/);
assert.match(migration, /proposal_sha256/);
assert.match(migration, /source_level text NOT NULL CHECK/);
assert.match(migration, /target_level text NOT NULL CHECK/);
assert.match(migration, /parent_package_id bigint NOT NULL REFERENCES rdl\.rdl_package/);
assert.match(migration, /delta_payload jsonb NOT NULL/);
assert.match(migration, /source_evidence jsonb NOT NULL/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS rdl\.external_standards_proposal_event/);
assert.match(migration, /append-only/);
assert.match(migration, /submit_external_standards_proposal/);
assert.match(migration, /review_external_standards_proposal/);
assert.doesNotMatch(migration, /INSERT INTO rdl\.context_extension_change/i);
assert.doesNotMatch(migration, /INSERT INTO rdl\.effective_standard_release/i);

assert.match(sqlTest, /idempotency conflict was not rejected/);
assert.match(sqlTest, /external proposal intake must not silently create context extension changes/);
assert.match(sqlTest, /PASS RDL-044 external standards proposal database contract/);

assert.match(repository, /class ExternalStandardsProposalRepository/);
assert.match(repository, /submit_external_standards_proposal/);
assert.match(repository, /review_external_standards_proposal/);
assert.match(repository, /byRequest/);
assert.match(repository, /consumer_key =/);

assert.match(service, /createHash\("sha256"\)/);
assert.match(service, /stable\(value/);
assert.match(service, /parentPackageId/);
assert.match(service, /deltaPayload/);
assert.match(service, /sourceEvidence/);
assert.match(service, /identity\.reviewer/);

assert.match(sharedApi, /PACKAGE_CONSUMER_ROLE/);
assert.match(sharedApi, /EXTENSION_REVIEWER_ROLE/);
assert.match(submitApi, /rdl-external-standards-proposal\/v1/);
assert.match(reviewApi, /rdl-external-standards-proposal-review\/v1/);
assert.match(statusApi, /rdl-external-standards-proposal-status\/v1/);

assert.match(docs, /DataGate does not write RDL Explorer internal tables/);
assert.match(docs, /push notification, pull content/);
assert.match(docs, /idempotency/);
assert.match(docs, /L1\/L2\/L3\/L4 provenance/);

console.log("PASS RDL-044 external standards proposal contract: database, API, service and documentation boundaries are present");
