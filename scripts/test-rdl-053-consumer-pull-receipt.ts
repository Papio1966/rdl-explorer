import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDistributionPullReceipt,
  RDL_CONSUMER_PULL_RECEIPT_SCHEMA_VERSION,
} from "../src/rdl/distributionPullReceipt";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

const base = {
  consumerKey: "datagate-like-consumer",
  pulledAt: "2026-09-12T12:05:00.000Z",
  releaseIdentity: {
    releaseId: 53,
    releaseKey: "company-effective",
    releaseVersion: "3.5.0",
    publicationStatus: "active",
  },
  packageIdentity: {
    manifestChecksum: A,
    distributionChecksum: B,
    packageChecksum: C,
    etag: `sha256-${B}`,
  },
  verification: {
    contractCompatible: true,
    schemaCompatible: true,
    releaseIdentityVerified: true,
    integrityVerified: true,
    contentCurrent: true,
    issues: [] as string[],
  },
};

const verified = createDistributionPullReceipt(base);
assert.equal(verified.schemaVersion, RDL_CONSUMER_PULL_RECEIPT_SCHEMA_VERSION);
assert.equal(verified.schemaVersion, "rdl-consumer-pull-receipt/v1");
assert.equal(verified.receiptContractVersion, "v1");
assert.equal(verified.consumerContract.consumerContractId, "rdl-distribution-consumer");
assert.equal(verified.consumerContract.consumerContractVersion, "v1");
assert.equal(verified.consumerContract.manifestSchemaVersion, "rdl-distribution-manifest/v1");
assert.equal(verified.consumerContract.packageSchemaVersion, "rdl-distribution-package/v1");
assert.equal(verified.status, "verified");
assert.equal(verified.safeToUseForValidation, true);
assert.equal(verified.boundary.persistenceOwner, "consumer");
assert.equal(verified.boundary.consumerAccess, "read-only API/contract consumption");
assert.equal(verified.boundary.rdlWriteBackRequired, false);
assert.equal(verified.boundary.directDataGateToRdlDatabaseMutation, "prohibited");
assert.equal(verified.pulledAt, "2026-09-12T12:05:00.000Z");
assert.equal(verified.packageIdentity.distributionChecksum, B);

const same = createDistributionPullReceipt(base);
assert.equal(same.receiptKey, verified.receiptKey, "same consumer/release/package pull must be idempotently identifiable");

const laterPull = createDistributionPullReceipt({ ...base, pulledAt: "2026-09-12T12:06:00.000Z" });
assert.notEqual(laterPull.receiptKey, verified.receiptKey, "a distinct pull timestamp must produce a distinct receipt key");

const stale = createDistributionPullReceipt({
  ...base,
  verification: { ...base.verification, contentCurrent: false, issues: ["release superseded"] },
});
assert.equal(stale.status, "stale");
assert.equal(stale.safeToUseForValidation, false);

const incompatible = createDistributionPullReceipt({
  ...base,
  verification: { ...base.verification, schemaCompatible: false, issues: ["unsupported package schema"] },
});
assert.equal(incompatible.status, "incompatible");
assert.equal(incompatible.safeToUseForValidation, false);

const rejected = createDistributionPullReceipt({
  ...base,
  verification: { ...base.verification, integrityVerified: false, issues: ["distribution checksum mismatch"] },
});
assert.equal(rejected.status, "rejected");
assert.equal(rejected.safeToUseForValidation, false);

const normalizedIssues = createDistributionPullReceipt({
  ...base,
  verification: { ...base.verification, issues: [" z ", "a", "z", ""] },
});
assert.deepEqual(normalizedIssues.verification.issues, ["a", "z"]);

assert.throws(() => createDistributionPullReceipt({ ...base, consumerKey: " " }), /consumerKey is required/);
assert.throws(() => createDistributionPullReceipt({ ...base, pulledAt: "not-a-date" }), /valid ISO-8601 timestamp/);
assert.throws(() => createDistributionPullReceipt({ ...base, releaseIdentity: { ...base.releaseIdentity, releaseId: 0 } }), /positive safe integer/);
assert.throws(() => createDistributionPullReceipt({ ...base, packageIdentity: { ...base.packageIdentity, distributionChecksum: "bad" } }), /SHA-256/);

const source = readFileSync("src/rdl/distributionPullReceipt.ts", "utf8");
assert.match(source, /persistenceOwner:\s*"consumer"/);
assert.match(source, /consumerAccess:\s*"read-only API\/contract consumption"/);
assert.match(source, /rdlWriteBackRequired:\s*false/);
assert.match(source, /directDataGateToRdlDatabaseMutation:\s*"prohibited"/);
assert.doesNotMatch(source, /from\s+["']pg["']|INSERT\s+INTO|UPDATE\s+rdl\.|DELETE\s+FROM\s+rdl\./i);
assert.doesNotMatch(source, /fetch\s*\([^)]*\{[^}]*method\s*:\s*["']POST["']/is);

const architecture = readFileSync("docs/development/RDL_053_CONSUMER_RELEASE_PULL_RECEIPT_OPERATIONAL_READINESS.md", "utf8");
for (const phrase of [
  "consumer-owned persistence",
  "no RDL acknowledgement endpoint",
  "read-only API/contract consumption",
  "Direct DataGate-to-RDL database mutation remains prohibited",
  "rdl-consumer-pull-receipt/v1",
]) {
  assert.ok(architecture.includes(phrase), `RDL-053 architecture must preserve: ${phrase}`);
}

console.log("PASS - RDL-053 consumer pull receipt operational readiness: verified/stale/incompatible/rejected receipts are fail-closed, consumer-owned, idempotently identifiable and require no RDL write-back or DataGate database coupling");
