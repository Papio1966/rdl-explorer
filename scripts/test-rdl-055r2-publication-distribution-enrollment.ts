import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("database/migrations/028_create_publication_distribution_enrollment.sql");
const sqlTest = read("database/sql/test_rdl_055r2_publication_distribution_enrollment.sql");
const distributionMigration = read("database/migrations/010_create_published_package_distribution.sql");
const notificationMigration = read("database/migrations/011_create_consumer_integration_notification.sql");
const distributionRepository = read("server/rdl/PublishedPackageDistributionRepository.ts");

assert.match(migration, /CREATE OR REPLACE FUNCTION rdl\.ensure_effective_standard_distribution/);
assert.match(migration, /ON CONFLICT \(effective_standard_release_id\) DO NOTHING/);
assert.match(migration, /CREATE TRIGGER trg_enroll_effective_standard_distribution/);
assert.match(migration, /AFTER INSERT ON rdl\.effective_standard_release/);
assert.match(migration, /INSERT INTO rdl\.effective_standard_distribution\(effective_standard_release_id\)[\s\S]*SELECT r\.effective_standard_release_id/);
assert.doesNotMatch(migration, /UPDATE\s+rdl\.effective_standard_distribution/i);
assert.doesNotMatch(migration, /DELETE\s+FROM\s+rdl\.effective_standard_distribution/i);
assert.match(sqlTest, /idempotent enrollment/);
assert.match(sqlTest, /transactional preservation probe/);
assert.match(sqlTest, /unknown release enrollment did not fail closed/);
assert.match(distributionMigration, /lifecycle_status text NOT NULL DEFAULT 'active'/);
assert.match(distributionMigration, /minimumConsumerVersion/);
assert.match(notificationMigration, /trg_notify_effective_standard_publication/);
assert.match(notificationMigration, /trg_notify_distribution_lifecycle_change/);
assert.match(distributionRepository, /rdl-distribution-package\/v1/);
assert.match(distributionRepository, /effectiveRelationships/);
assert.doesNotMatch(migration, /DataGate|datagate/i);

console.log("PASS RDL-055R2 durable publication-to-distribution enrollment static contract");
