import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import manifestHandler from "../api/distribution/manifest";
import packageHandler from "../api/distribution/package";
import { PublishedPackageDistributionRepository } from "../server/rdl/PublishedPackageDistributionRepository";
import { evaluateDistributionConsumerCompatibility } from "../src/rdl/distributionConsumerCompatibility";

const manifestSource = readFileSync("api/distribution/manifest.ts", "utf8");
const packageSource = readFileSync("api/distribution/package.ts", "utf8");
const repositorySource = readFileSync("server/rdl/PublishedPackageDistributionRepository.ts", "utf8");

assert.equal(typeof manifestHandler, "function");
assert.equal(typeof packageHandler, "function");
assert.doesNotMatch(manifestSource, /_shared\/request\.ts/);
assert.doesNotMatch(packageSource, /_shared\/request\.ts/);
assert.match(manifestSource, /from "\.\.\/_runtime\.ts"/);
assert.match(manifestSource, /from "\.\.\/governance\/_shared\.ts"/);
assert.match(packageSource, /from "\.\.\/_runtime\.ts"/);
assert.match(packageSource, /from "\.\.\/governance\/_shared\.ts"/);
assert.match(repositorySource, /const packageChecksum=createHash\("sha256"\)/);
assert.match(repositorySource, /const distributionSha256=packageChecksum/);

const derivation = {
  schemaVersion: "rdl-entity-derivation/v1",
  compositionId: 700,
  compositionKind: "multi_source_merge",
  boundary: { exactSourceIdentityRetained: true, sameNameAutomaticEquivalence: false },
  contributors: [
    { sourceKey: "cfihos", packageId: 101, entityId: 1001 },
    { sourceKey: "ccus", packageId: 102, entityId: 1002 },
  ],
};
const releaseRow = {
  effective_standard_release_id: 155,
  context_id: 30,
  context_key: "PROJECT-055R3",
  context_type: "project",
  context_name: "Project 055R3",
  release_key: "project-055r3",
  release_version: "1.0.0",
  composition_sha256: "a".repeat(64),
  published_by: "custodian",
  published_at: "2026-09-14T08:00:00Z",
  lifecycle_status: "active",
  superseded_by_release_id: null,
  compatibility: { contract: "rdl-distribution/v1", minimumConsumerVersion: "1.0" },
  deprecation_message: null,
  package_manifest: { packagePins: [], derivations: [derivation] },
  package_payload: {
    changes: [
      {
        extensionChangeId: 900,
        changeKind: "add",
        entityType: "unit_of_measure",
        nativeIdentifier: "RDL055R3-COMPOSITE-001",
        effectiveName: "percent",
        sourceLayer: "company",
        sourceContextKey: "COMPANY-055R3",
        derivation,
      },
    ],
    effectiveRelationships: [
      {
        relationshipId: 1,
        packageId: 101,
        packageKey: "cfihos-pkg",
        relationshipTypeCode: "class_property",
        relationshipStatus: "active",
        sourceEntityType: "tag_class",
        sourceNativeIdentifier: "TAG-1",
        targetEntityType: "property",
        targetNativeIdentifier: "PROP-1",
      },
    ],
  },
};
const client = {
  async query(sql: string) {
    if (sql.includes("FROM rdl.effective_standard_release r")) return [releaseRow];
    throw new Error(`Unexpected query: ${sql}`);
  },
};
const repository = new PublishedPackageDistributionRepository(client as never);
const pkg = await repository.consumerPackage(155) as Record<string, unknown>;
const packageChecksum = String(pkg.packageChecksum ?? "");
const distributionChecksum = String(pkg.distributionSha256 ?? "");
assert.match(packageChecksum, /^[0-9a-f]{64}$/);
assert.equal(distributionChecksum, packageChecksum, "v1 distribution checksum must preserve the existing immutable package-body hash");
const { packageChecksum: omittedPackageChecksum, distributionSha256: omittedDistributionChecksum, ...immutablePackageBody } = pkg;
void omittedPackageChecksum;
void omittedDistributionChecksum;
const recomputed = createHash("sha256").update(JSON.stringify(immutablePackageBody)).digest("hex");
assert.equal(packageChecksum, recomputed, "packageChecksum must be SHA-256 of the immutable consumer package body");
assert.equal(Array.isArray(pkg.effectiveRelationships), true);
assert.equal((pkg.effectiveRelationships as unknown[]).length, 1);
const effectiveEntities = pkg.effectiveEntities as Array<Record<string, unknown>>;
assert.equal(effectiveEntities.length, 1);
const publishedDerivation = effectiveEntities[0]?.derivation as Record<string, unknown>;
assert.equal((publishedDerivation.boundary as Record<string, unknown>).sameNameAutomaticEquivalence, false);
assert.equal((publishedDerivation.contributors as unknown[]).length, 2);

const result = evaluateDistributionConsumerCompatibility({
  contractId: "rdl-distribution-consumer",
  contractVersion: "v1",
  manifestSchemaVersion: "rdl-distribution-manifest/v1",
  packageSchemaVersion: "rdl-distribution-package/v1",
  releaseId: "155",
  releaseKey: "project-055r3",
  releaseVersion: "1.0.0",
  publicationStatus: "active",
  generatedAt: "2026-09-14T08:01:00.000Z",
  manifestChecksum: "a".repeat(64),
  packageChecksum,
  distributionChecksum,
  etag: `sha256-${distributionChecksum}`,
  consumerAccess: "read-only API/contract consumption",
  directDataGateToRdlDatabaseMutation: "prohibited",
});
assert.equal(result.compatible, true);
assert.equal(result.rejected, false);
assert.equal(result.preValidationGate, "pass");
assert.deepEqual(result.rejectionReasons, []);

console.log("PASS - RDL-055R3 public distribution contract repair: manifest/package handlers load, package checksum is a real immutable-body SHA-256, v1 distribution fingerprint remains stable, and RDL-052 compatibility passes");
