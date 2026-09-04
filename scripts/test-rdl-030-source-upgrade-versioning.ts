import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CCUS_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/CcusV2CfihosFormatProfile.ts";
import { WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE } from "./rdl-ingestion/WaterDesalinationV2CfihosFormatProfile.ts";

const read=(path:string)=>readFileSync(path,"utf8");
const must=(condition:boolean,message:string)=>assert.ok(condition,message);
const auditPath="data/rdl/audits/RDL-030_release_safety_audit.json";
const auditSha=createHash("sha256").update(readFileSync(auditPath)).digest("hex");
assert.equal(auditSha,"35c1cb97008075f8075f27ab3cc46bc438f5d35aa19775538ae0d08a29419bd1","RDL-030 identity audit fingerprint changed unexpectedly");

const audited=JSON.parse(read(auditPath));
for (const profile of [CCUS_V2_CFIHOS_FORMAT_PROFILE,WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE]) {
  const sourceBytes=readFileSync(profile.workbookPath);
  const sourceSha=createHash("sha256").update(sourceBytes).digest("hex");
  assert.ok(sourceBytes.length > 100_000,`${profile.sourceKey} v2 workbook is missing or unexpectedly small`);
  assert.equal(profile.releaseStatus,"candidate");
  assert.ok(profile.identityAudit,`${profile.sourceKey} v2 must carry governed identity-audit evidence`);
  assert.equal(profile.identityAudit?.auditPath,auditPath);
  const verificationKey=profile.sourceKey === "ccus" ? "CCUS" : "Water";
  assert.equal(audited.verification[verificationKey].sheet_count,23,`${profile.sourceKey} audit must verify 23 sheets`);
  const expectedSha=profile.sourceKey === "ccus" ? "605dad6f50f5806aebcc2e35aa484bdba8db5f0681ce09de4183cc3ed7f5b68b" : "7b5024e37f33b9fec56c0ba21160ed490ecd7028e6653ab0bee9c385c7a0ee37";
  assert.equal(sourceSha,expectedSha,`${profile.sourceKey} v2 workbook fingerprint does not match the release-safe source`);
}

const migration=read("database/migrations/020_create_source_release_versioning_guard.sql");
must(migration.includes("assert_release_package_fingerprint"),"immutable release fingerprint gate missing");
must(migration.includes("assert_source_release_identity"),"cross-release identifier gate missing");
must(migration.includes("compare_source_release_entities"),"source entity release comparison missing");
must(migration.includes("compare_source_release_relationships"),"source relationship release comparison missing");
must(migration.includes("changed canonical identity without a release identity audit"),"unaudited same-type identity reuse must fail closed");

const generator=read("scripts/rdl-ingestion/generateCfihosFormatSql.ts");
must(generator.includes("identityAuditSha256") && generator.includes("assert_source_release_identity"),"ingestion generator does not bind the audit to the package");
must(generator.includes("assert_release_package_fingerprint"),"ingestion does not enforce release-key fingerprint immutability");

const catalogue=read("src/rdl/catalog.ts");
must(catalogue.includes('defaultReleaseKey: "ccus-2.0-candidate"') && catalogue.includes('key: "ccus-0.1-draft"'),"CCUS historical and v2 releases not both catalogued");
must(catalogue.includes('defaultReleaseKey: "water-desalination-2.0-candidate"') && catalogue.includes('key: "water-desalination-0.1-draft"'),"Water historical and v2 releases not both catalogued");
must(catalogue.includes('status: "superseded"'),"historical release status missing");

const search=read("src/rdl/search.ts");
const searchPage=read("src/pages/RdlSearchPage.tsx");
const entityPage=read("src/pages/RdlEntityPage.tsx");
const entityDetail=read("src/rdl/entityDetail.ts");
const guard=read("src/components/RdlScopedLegacyGuard.tsx");
must(search.includes("record.releaseKey === getDefaultReleaseKey") && search.includes("record.releaseKey === releaseKey"),"search release isolation missing");
must(searchPage.includes('params.get("release")') && searchPage.includes("rdlEntityRoute(result.sourceKey, result.releaseKey"),"search does not preserve explicit release context");
const preservesExplicitDetailIdentity =
  entityPage.includes("loadRdlEntityDetail(sourceKey, releaseKey, entityType, nativeIdentifier)")
  || entityPage.includes("loadRdlEntityDetailRuntime({ sourceKey, releaseKey, entityType, nativeIdentifier })");
must(preservesExplicitDetailIdentity,"generic entity page does not pass explicit release identity to the detail projection");
must(
  entityDetail.includes("item.sourceKey === sourceKey")
    && entityDetail.includes("item.releaseKey === releaseKey")
    && entityDetail.includes("item.entityType === entityType")
    && entityDetail.includes("item.nativeIdentifier === nativeIdentifier"),
  "generic entity detail lookup can leak across releases or typed identities",
);
must(
  entityDetail.includes("item.sourceKey === record.sourceKey")
    && entityDetail.includes("item.releaseKey === record.releaseKey")
    && entityDetail.includes("item.packageKey === record.packageKey"),
  "generic entity detail relationships can leak across release packages",
);
must(entityDetail.includes("rdlEntityRoute(record.sourceKey, record.releaseKey"),"generic related-entity links do not preserve explicit release identity");
must(guard.includes("item.releaseKey === releaseKey"),"legacy scope guard can leak across releases");

const app=read("src/App.tsx");
must(app.includes('/rdl/:sourceKey/:releaseKey/:entityType/:nativeIdentifier'),"release-aware entity route missing");
must(app.includes('/rdls/:sourceKey/compare'),"source release comparison route missing");
const e2e=read("tests/e2e/explorer.spec.ts");
must(e2e.includes("RDL releases remain isolated and version selectable") && e2e.includes("WATERRDL-31000012"),"browser release-isolation E2E gate missing");

const indexGenerator=read("scripts/generate-rdl-search-index.ts");
must(indexGenerator.includes("CCUS_V2_CFIHOS_FORMAT_PROFILE") && indexGenerator.includes("WATER_DESALINATION_V2_CFIHOS_FORMAT_PROFILE"),"v2 releases missing from static search projection");
must(indexGenerator.includes("releaseKey") && indexGenerator.includes("releaseStatus"),"search projection is not release-aware");

const delta=JSON.parse(read("public/rdl-release-deltas.json"));
assert.equal(delta.continuity.CCUS.entities["equipment class"].added,16);
assert.equal(delta.continuity.CCUS.relationships["equipment -> property"].added,182);
assert.equal(delta.continuity.Water.entities.property.added,14);
assert.equal(delta.continuity.Water.relationships["tag -> property"].added,34);

console.log("PASS RDL-030 source upgrade, release identity, release-isolated browsing and real release-delta contract");
