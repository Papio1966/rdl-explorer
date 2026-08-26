import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getBuildMetadata } from "../server/runtime/BuildMetadata.ts";
import { RuntimeMetrics } from "../server/observability/RuntimeMetrics.ts";
import { createRequestContext } from "../server/runtime/RequestContext.ts";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const metadata = getBuildMetadata({
  RDL_BUILD_VERSION: "1.2.3",
  RDL_RELEASE_ID: "release-42",
  RDL_COMMIT_SHA: "abc123",
  RDL_RUNTIME_ENV: "production",
  RDL_BUILD_TIMESTAMP: "2026-08-26T08:00:00Z",
} as NodeJS.ProcessEnv);
assert.equal(metadata.version, "1.2.3");
assert.equal(metadata.releaseId, "release-42");
assert.equal(metadata.commitSha, "abc123");
assert.equal(metadata.environment, "production");

const metrics = new RuntimeMetrics();
metrics.record(createRequestContext(undefined, "health", "GET", 1_000), 200, 1_025);
metrics.record(createRequestContext(undefined, "governance.review", "POST", 2_000), 409, 2_040);
const snapshot = metrics.snapshot(3_000);
assert.equal(snapshot.totals.requests, 2);
assert.equal(snapshot.totals.errors, 1);
assert.equal(snapshot.routes["GET health"]?.statusCodes["200"], 1);
assert.equal(snapshot.routes["POST governance.review"]?.errors, 1);

const manifest = JSON.parse(read("deployment/runtime-manifest.json")) as Record<string, unknown>;
assert.equal(manifest.service, "rdl-explorer");
assert.ok(read("api/version.ts").includes("getBuildMetadata"));
assert.ok(read("api/metrics.ts").includes("process-local"));
assert.ok(read("scripts/smoke-deployment.ts").includes("/api/readiness"));
assert.ok(read("scripts/package-deployment.sh").includes("rdl-explorer-deployment.tgz"));
assert.ok(read("docs/DEPLOYMENT_RUNBOOK.md").includes("Rollback"));
assert.ok(read(".github/workflows/build.yml").includes("test:rdl-015"));
assert.ok(read(".github/workflows/build.yml").includes("package:deployment"));

console.log("PASS RDL-015 deployment automation and observability contract");
