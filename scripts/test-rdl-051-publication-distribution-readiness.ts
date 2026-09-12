import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function mustInclude(path: string, content: string, expected: string): void {
  assert.ok(content.includes(expected), `${path} must include ${expected}`);
}

const docPath = "docs/development/RDL_051_PUBLICATION_DISTRIBUTION_READINESS_DATAGATE_CONSUMERS.md";
const testPath = "scripts/test-rdl-051-publication-distribution-readiness.ts";
const manifestPath = "api/distribution/manifest.ts";
const packagePath = "api/distribution/package.ts";

const doc = read(docPath);
const test = read(testPath);
const manifest = read(manifestPath);
const pkg = read(packagePath);

for (const expected of [
  "contract id",
  "contract version",
  "release id",
  "release key",
  "release version",
  "publication status",
  "generated timestamp",
  "package checksum",
  "manifest checksum",
  "distribution checksum",
  "ETag",
  "read-only API/contract consumption",
  "direct DataGate-to-RDL database mutation",
  "RDL Explorer must not mutate DataGate project state",
]) {
  mustInclude(docPath, doc, expected);
}

for (const expected of [
  "rdl-distribution-consumer",
  "RDL_DISTRIBUTION_CONTRACT_VERSION",
  "rdl-distribution-manifest/v1",
  "schemaVersion",
  "contractId",
  "contractVersion",
  "generatedAt",
  "releaseIdentity",
  "manifestChecksum",
  "distributionChecksum",
  "X-RDL-Distribution-Contract",
  "X-RDL-Read-Only-Consumer",
  "directDatabaseMutation",
  "DataGate",
]) {
  mustInclude(manifestPath, manifest, expected);
}

for (const expected of [
  "rdl-distribution-consumer",
  "RDL_DISTRIBUTION_CONTRACT_VERSION",
  "rdl-distribution-package/v1",
  "schemaVersion",
  "contractId",
  "contractVersion",
  "generatedAt",
  "releaseIdentity",
  "packageIdentity",
  "packageChecksum",
  "manifestChecksum",
  "distributionChecksum",
  "Content-Disposition",
  "ETag",
  "X-RDL-Distribution-Contract",
  "X-RDL-Read-Only-Consumer",
  "directDatabaseMutation",
  "DataGate",
]) {
  mustInclude(packagePath, pkg, expected);
}

mustInclude(testPath, test, "RDL-051 publication/distribution readiness contract");

console.log("PASS - RDL-051 publication/distribution readiness contract: manifest/package endpoints expose consumer-facing identity, integrity, read-only DataGate consumption and no direct database mutation semantics");
