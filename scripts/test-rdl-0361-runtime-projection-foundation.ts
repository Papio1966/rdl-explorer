import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const genericIngestion = read("scripts/rdl-ingestion/generateCfihosFormatSql.ts");
const cfihosIngestion = read("scripts/generate-cfihos-ingestion-sql.ts");
const projection = read("server/rdl/RdlRuntimeProjectionRepository.ts");
const legacyPostgres = read("server/rdl/PostgresRdlRepository.ts");
const parity = read("scripts/db-test-rdl-0361-runtime-projection-parity.ts");
const backfill = read("scripts/db-backfill-rdl-0361-runtime-projection.ts");

assert.match(genericIngestion, /persistedReleaseStatus/);
assert.match(genericIngestion, /releaseKey\.endsWith\("0\.1-draft"\)/);
assert.match(genericIngestion, /synonym:rowText/);
assert.match(genericIngestion, /dimensionReference:rowText/);
assert.match(genericIngestion, /measurementSystemName:rowText/);
assert.match(genericIngestion, /sourceStandardId:t\(r,"sourceStandardId"\)/);
assert.match(genericIngestion, /projectionName:t\(r,"sourceStandardName"\)/);

assert.match(cfihosIngestion, /const classTypes = assetType === "tag"/);
assert.match(cfihosIngestion, /relationshipId:first/);
assert.match(cfihosIngestion, /sourcePropertyName:/);
assert.match(cfihosIngestion, /sequence:first\(r,\["property picklist value sequence number"/);
assert.match(cfihosIngestion, /document and data requirement group code/);
assert.match(cfihosIngestion, /source standard document and data requirement typical deliverable/);
assert.match(cfihosIngestion, /handoverStatus: first\(r,\["default required handover status code"\]\)/);
assert.match(cfihosIngestion, /propertyNameInSource: text\(r\["property name in source standard"\]\)/);
assert.match(cfihosIngestion, /projectionRequirementGroup:first\(r,\["requirement group code","requirement group"\]\)/);
assert.match(cfihosIngestion, /projectionTypicalDeliverable:first\(r,\["typical deliverable"\]\)/);
assert.match(cfihosIngestion, /projectionRequiredHandoverStatus:first\(r,\["required handover status code"\]\)/);

assert.doesNotMatch(projection, /public\/rdl-search-index\.json|public\/rdl-relationship-index\.json/);
assert.doesNotMatch(projection, /from "\.\.\/\.\.\/src\//);
assert.match(projection, /property_controlled_value/);
assert.match(projection, /controlled_value_source_standard/);
assert.match(projection, /mapping_property_standard/);
assert.match(projection, /information_requirement_standard/);
assert.match(projection, /directRequirementTypes/);
assert.match(projection, /cfihosBrowserRequirementAttributes/);
assert.match(projection, /projectionRequirementGroup/);
assert.match(projection, /authoritative normalized/);
assert.match(projection, /selected_packages/);
assert.match(projection, /p\.package_status = 'validated'/);
assert.match(projection, /RELATIONSHIP_PAGE_SIZE = 1000/);
assert.match(projection, /OFFSET \${offset}/);

assert.match(legacyPostgres, /RDL-036\.1 compatibility boundary/);
assert.match(legacyPostgres, /const wantedAsset = entityType === "tag_class" \? "tag" : "equipment"/);
assert.match(legacyPostgres, /rel\.attributes->>\'assetType\'/);
assert.match(legacyPostgres, /legacySnapshotMetadata/);
assert.match(legacyPostgres, /case "tag_class"/);
assert.match(legacyPostgres, /case "controlled_value"/);
assert.match(legacyPostgres, /measurementSystemCode: text\("measurementSystemCode"\)/);
assert.match(legacyPostgres, /Jip33 info required spec/);
assert.match(legacyPostgres, /sourceSheet\?: string/);
assert.match(legacyPostgres, /rel\.source_locator->>\'sheet\'/);
assert.doesNotMatch(legacyPostgres.match(/function legacySnapshotMetadata[\s\S]*?function mapEntity/)?.[0] ?? "", /existenceReason|measurementSystemName/);

assert.match(backfill, /rdl0361_entity_identity_before/);
assert.match(backfill, /normalized_metadata=EXCLUDED\.normalized_metadata, source_locator=EXCLUDED\.source_locator/);
assert.match(backfill, /transaction rolled back/);
assert.doesNotMatch(backfill, /DELETE FROM rdl\.rdl_entity|DELETE FROM rdl\.rdl_relationship/);
assert.doesNotMatch(backfill, /assert_source_release_identity/);

assert.match(parity, /public\/rdl-search-index\.json/);
assert.match(parity, /public\/rdl-relationship-index\.json/);
assert.match(parity, /package projection/);
assert.match(parity, /semantic mismatch/);
assert.match(parity, /all five releases/);

assert.equal(sha256("public/rdl-search-index.json"), "646c8e6a2ce2550832f971c943a69fc467b3ac55d8fc563748364f82d757dfcb");
assert.equal(sha256("public/rdl-relationship-index.json"), "2159133bb2c02151cecbf4cf0fbba890463d4926feb7e9568379fb85e24d2927");

console.log("PASS RDL-036.1 deterministic foundation: normalized ingestion enrichments, safe historical-package backfill, legacy cutover compatibility and source-neutral runtime projection contract are present");
console.log("PASS RDL-036.1 browser oracle hashes remain unchanged");
console.log("PASS RDL-036.1 no browser/API runtime cutover introduced");
