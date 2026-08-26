import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const app = read("src/App.tsx");
const shell = read("src/components/AppShell.tsx");
const assistantApi = read("api/assistant.ts");
const cisBuilder = read("src/pages/CisBuilderPage.tsx");
const assistant = read("src/pages/AssistantPage.tsx");
const about = read("src/pages/AboutPage.tsx");
const help = read("src/pages/HelpPage.tsx");
const tagClasses = read("src/pages/TagClassesPage.tsx");
const equipmentClasses = read("src/pages/EquipmentClassesPage.tsx");
const documentTypes = read("src/pages/DocumentTypesPage.tsx");
const dataDictionary = read("src/pages/DataDictionaryPage.tsx");
const sourceStandards = read("src/pages/SourceStandardsPage.tsx");
const disciplines = read("src/pages/DisciplinesPage.tsx");

const productBoundary = read("docs/PRODUCT_BOUNDARY.md");
const architecture = read("docs/ARCHITECTURE.md");
const roadmap = read("docs/ROADMAP.md");
const requirements = read("docs/REQUIREMENTS.md");
const indexHtml = read("index.html");
const packageJson = read("package.json");
const databaseReadme = read("database/README.md");
const databaseBootstrap = read("database/bootstrap.sql");
const databaseMigration = read("database/migrations/001_create_platform_schemas.sql");
const coreDomainMigration = read("database/migrations/002_create_core_rdl_domain_model.sql");
const coreDomainTest = read("database/sql/test_rdl_003_core_model.sql");
const coreDomainModel = read("src/rdl/model/core.ts");
const databaseHealth = read("scripts/db-health.sh");
const databaseMigrate = read("scripts/db-migrate.sh");
const rdlRepository = read("src/rdl/repository/RdlRepository.ts");
const databaseClient = read("server/db/DatabaseClient.ts");
const databaseConfig = read("server/db/config.ts");
const cfihosVocabularyMigration = read("database/migrations/003_extend_cfihos_ingestion_vocabulary.sql");
const cfihosIngestionGenerator = read("scripts/generate-cfihos-ingestion-sql.ts");
const cfihosParityTest = read("scripts/db-test-rdl-004-parity.ts");
const postgresReadRepository = read("server/rdl/PostgresRdlRepository.ts");
const psqlJsonClient = read("server/db/PsqlJsonClient.ts");
const rdlReadService = read("server/rdl/RdlReadService.ts");
const rdlReadRepository = read("server/rdl/RdlReadRepository.ts");
const rdl005ParityTest = read("scripts/db-test-rdl-005-read-parity.ts");
const rdlCutoverRepository = read("server/rdl/RdlCutoverRepository.ts");
const snapshotReadRepository = read("server/rdl/SnapshotRdlReadRepository.ts");
const dualReadRepository = read("server/rdl/DualReadRdlRepository.ts");
const repositorySelector = read("server/rdl/RdlRepositorySelector.ts");
const rdl006Test = read("scripts/db-test-rdl-006-dual-read.ts");
const envExample = read(".env.example");
const rdl007Profile = read("scripts/rdl-ingestion/CcusCfihosFormatProfile.ts");
const rdl007Generator = read("scripts/rdl-ingestion/generateCfihosFormatSql.ts");
const rdl007Test = read("scripts/db-test-rdl-007-multi-rdl.ts");
const rdl007Ingest = read("scripts/db-ingest-ccus.sh");
const rdl008Profile = read("scripts/rdl-ingestion/WaterDesalinationProfile.ts");
const rdl008Test = read("scripts/db-test-rdl-008-genericity.ts");
const rdl008Ingest = read("scripts/db-ingest-water-desalination.sh");
const rdlScopeContext = read("src/rdl/RdlScopeContext.tsx");
const globalSearch = read("src/components/GlobalRdlSearch.tsx");
const scopeSelector = read("src/components/RdlScopeSelector.tsx");
const rdlSearchPage = read("src/pages/RdlSearchPage.tsx");
const rdlEntityPage = read("src/pages/RdlEntityPage.tsx");
const rdlCataloguePage = read("src/pages/RdlCataloguePage.tsx");
const rdlSearchGenerator = read("scripts/generate-rdl-search-index.ts");
const rdlGlobalSearchRepository = read("server/rdl/RdlGlobalSearchRepository.ts");
const rdl009Test = read("scripts/db-test-rdl-009-search.ts");
const crossRdlMigration = read("database/migrations/004_create_cross_rdl_mapping.sql");
const crossRdlRepository = read("server/rdl/CrossRdlIntelligenceRepository.ts");
const crossRdlGenerator = read("scripts/generate-cross-rdl-intelligence.ts");
const crossRdlPage = read("src/pages/RdlIntelligencePage.tsx");
const rdl010Test = read("scripts/db-test-rdl-010-cross-intelligence.ts");
const governanceMigration = read("database/migrations/005_create_cross_rdl_mapping_governance.sql");
const governanceRepository = read("server/rdl/CrossRdlGovernanceRepository.ts");
const governancePage = read("src/pages/RdlGovernancePage.tsx");
const governanceGenerator = read("scripts/generate-rdl-governance.ts");
const rdl011Test = read("database/sql/test_rdl_011_governance.sql");
const governanceIdentity = read("server/auth/GovernanceIdentity.ts");
const governanceService = read("server/rdl/GovernanceService.ts");
const governanceSessionApi = read("api/governance/session.ts");
const governanceQueueApi = read("api/governance/queue.ts");
const governanceReviewApi = read("api/governance/review.ts");
const governanceBrowserService = read("src/rdl/governanceService.ts");
const rdl012Test = read("scripts/test-rdl-012-service-boundary.ts");
const pgJsonClient = read("server/db/PgJsonClient.ts");
const databaseRuntime = read("server/db/runtime.ts");
const governanceApiShared = read("api/governance/_shared.ts");
const healthApi = read("api/health.ts");
const readinessApi = read("api/readiness.ts");
const rdl013Test = read("scripts/test-rdl-013-runtime.ts");
const requestContextRuntime = read("server/runtime/RequestContext.ts");
const structuredLogger = read("server/runtime/StructuredLogger.ts");
const rateLimiterRuntime = read("server/runtime/RateLimiter.ts");
const runtimeEnvironment = read("server/runtime/environment.ts");
const shutdownRuntime = read("server/runtime/shutdown.ts");
const apiRuntime = read("api/_runtime.ts");
const productionDeployment = read("docs/PRODUCTION_DEPLOYMENT.md");
const rdl014Test = read("scripts/test-rdl-014-runtime-hardening.ts");
const buildMetadataRuntime = read("server/runtime/BuildMetadata.ts");
const runtimeMetrics = read("server/observability/RuntimeMetrics.ts");
const versionApi = read("api/version.ts");
const metricsApi = read("api/metrics.ts");
const deploymentManifest = read("deployment/runtime-manifest.json");
const deploymentRunbook = read("docs/DEPLOYMENT_RUNBOOK.md");
const deploymentPackager = read("scripts/package-deployment.sh");
const deploymentSmoke = read("scripts/smoke-deployment.ts");
const rdl015Test = read("scripts/test-rdl-015-deployment-observability.ts");
const enterpriseHierarchyMigration = read("database/migrations/007_create_enterprise_rdl_hierarchy.sql");
const enterpriseHierarchyRepository = read("server/rdl/EnterpriseRdlHierarchyRepository.ts");
const enterpriseHierarchyPage = read("src/pages/RdlHierarchyPage.tsx");
const rdl016Test = read("database/sql/test_rdl_016_enterprise_hierarchy.sql");

const routes = [
  "/classes/tag",
  "/classes/equipment",
  "/documents",
  "/disciplines",
  "/lifecycle",
  "/dictionary",
  "/standards",
  "/units",
  "/model",
  "/validation",
  "/assistant",
  "/cis",
  "/about",
  "/help",
  "/rdls",
  "/search",
  "/intelligence",
  "/governance",
  "/hierarchy",
];

for (const route of routes) {
  assert.ok(app.includes(`path=\"${route}\"`) || app.includes(`to=\"${route}`), `Missing application route ${route}`);
}

for (const label of [
  "Tag Classes",
  "Equipment Classes",
  "Document Types",
  "Lifecycle Requirements",
  "AI Assistant",
  "CIS Builder",
  "Validation",
  "About RDL Explorer",
  "User Guide",
  "RDL Catalogue",
  "Cross-RDL Intelligence",
  "Mapping Governance",
  "Enterprise RDL Hierarchy",
]) {
  assert.ok(shell.includes(`label: \"${label}\"`), `Missing navigation item ${label}`);
}

assert.ok(app.includes("lazyNamed"), "Routes are no longer lazy loaded");
assert.ok(app.includes("<Suspense"), "Lazy routes must remain behind a Suspense boundary");
assert.ok(app.includes('role="status"'), "Route loading fallback must remain accessible");

assert.ok(cisBuilder.includes("localStorage"), "CIS Builder persistence contract is missing");
assert.ok(assistant.includes("ACTIVE CIS") || assistant.includes("Active CIS"), "Assistant active-CIS context indicator is missing");
assert.ok(assistant.includes("/api/assistant"), "Assistant no longer calls the server-side API endpoint");

assert.ok(assistantApi.includes("OPENAI_API_KEY"), "Assistant API key must remain server-side");
assert.ok(assistantApi.includes("OPENAI_MODEL"), "Assistant model configuration is missing");
assert.ok(assistantApi.includes("store: false"), "OpenAI request must continue to disable response storage");
assert.ok(assistantApi.includes("method") && assistantApi.includes("POST"), "Assistant endpoint must validate POST requests");


assert.ok(shell.includes('brand-name">RDL<'), "Application shell must identify the product as RDL Explorer");
assert.ok(indexHtml.includes("<title>RDL Explorer</title>"), "Browser title must identify RDL Explorer");
assert.ok(packageJson.includes('"name": "rdl-explorer"'), "Package identity must be rdl-explorer");
assert.ok(productBoundary.includes("CFIHOS Explorer") && productBoundary.includes("RDL Explorer"), "Product boundary must document the separation from CFIHOS Explorer");
assert.ok(architecture.includes("PostgreSQL") && architecture.includes("DataGate"), "Architecture must document the PostgreSQL target and DataGate boundary");
assert.ok(roadmap.includes("RDL-002") && roadmap.includes("RDL-012"), "Roadmap must capture the staged RDL platform programme");
assert.ok(requirements.includes("RDL-MODEL-001") && requirements.includes("RDL-DG-001"), "Requirements must capture RDL identity and DataGate integration constraints");
assert.ok(packageJson.includes('"db:migrate"') && packageJson.includes('"db:health"'), "Package scripts must expose database migration and health commands");
assert.ok(databaseBootstrap.includes("metadata.schema_migrations"), "Database bootstrap must establish migration history");
for (const schema of ["rdl", "ingestion", "metadata"]) {
  assert.ok(databaseMigration.includes(`CREATE SCHEMA IF NOT EXISTS ${schema}`), `RDL-002 migration must create ${schema} schema`);
}
assert.ok(databaseHealth.includes("RDL_DATABASE_URL") && databaseHealth.includes("psql"), "Database health check must use configured PostgreSQL connectivity");
assert.ok(databaseMigrate.includes("schema_migrations") && databaseMigrate.includes("database/migrations"), "Migration runner must apply and record ordered migrations");
assert.ok(databaseReadme.includes("DBeaver") && databaseReadme.includes("CFIHOS snapshot"), "Database guide must document DBeaver local setup and transitional runtime boundary");
assert.ok(databaseMigrate.includes("-f -") && databaseMigrate.includes(`:'migration_name'`), "Migration runner must interpolate migration names through psql input rather than an unsafe -c path");
assert.ok(!databaseMigrate.includes(`-c "SELECT 1 FROM metadata.schema_migrations WHERE migration_name = :'migration_name';"`), "Migration runner must not use the broken psql -c variable-substitution form");
assert.ok(rdlRepository.includes("interface RdlRepository") && rdlRepository.includes('"postgresql"'), "Application must define a PostgreSQL-capable RDL repository boundary");
assert.ok(databaseClient.includes("interface DatabaseClient"), "Server layer must define a database client contract");
assert.ok(databaseConfig.includes("RDL_DATABASE_URL") && databaseConfig.includes("rdl_explorer"), "Database configuration must use the RDL-specific environment variable and database name");
assert.ok(requirements.includes("RDL-DB-001") && requirements.includes("RDL-DB-008"), "Requirements must capture PostgreSQL and DataGate database-boundary constraints");
assert.ok(packageJson.includes('"db:test:rdl-003"'), "Package scripts must expose the RDL-003 database verification command");
for (const tableName of ["rdl_source", "rdl_release", "rdl_package", "rdl_entity", "rdl_relationship", "ingestion_run"]) {
  assert.ok(coreDomainMigration.includes(tableName), `RDL-003 migration must define ${tableName}`);
}
assert.ok(coreDomainMigration.includes("UNIQUE (package_id, entity_type_code, native_identifier)"), "RDL-003 entity identity must include package, entity type and native identifier");
assert.ok(coreDomainMigration.includes("FOREIGN KEY (source_entity_id, package_id)") && coreDomainMigration.includes("FOREIGN KEY (target_entity_id, package_id)"), "RDL-003 relationships must stay within an explicit package boundary");
assert.ok(coreDomainMigration.includes("CREATE OR REPLACE VIEW rdl.entity_identity"), "RDL-003 must expose resolved source-aware entity identity");
assert.ok(coreDomainTest.includes("Same native identifier can coexist") && coreDomainTest.includes("ROLLBACK"), "RDL-003 database test must verify collision safety without persisting fixture data");
assert.ok(coreDomainModel.includes("RdlEntityIdentity") && coreDomainModel.includes("RdlRelationshipRecord"), "Application model must expose generic RDL entity and relationship vocabulary");
assert.ok(requirements.includes("RDL-CORE-001") && requirements.includes("RDL-CORE-010"), "Requirements must capture the RDL-003 core domain constraints");
assert.ok(packageJson.includes('"db:ingest:cfihos"') && packageJson.includes('"db:test:rdl-004"'), "Package scripts must expose RDL-004 ingestion and parity commands");
assert.ok(cfihosVocabularyMigration.includes("source_mapping") && cfihosVocabularyMigration.includes("information_requirement"), "RDL-004 vocabulary must preserve contextual mappings and information requirements");
assert.ok(cfihosIngestionGenerator.includes("cfihos-snapshot-v1") && cfihosIngestionGenerator.includes("content_sha256"), "CFIHOS adapter must be versioned and retain source hash provenance");
assert.ok(cfihosIngestionGenerator.includes('"tag_class"') && cfihosIngestionGenerator.includes('"equipment_class"'), "CFIHOS adapter must preserve typed Tag and Equipment identities");
assert.ok(cfihosIngestionGenerator.includes("ambiguous-tag-or-equipment"), "CFIHOS adapter must retain unresolved Tag/Equipment source ambiguity");
assert.ok(cfihosParityTest.includes("CFIHOS-30000521") && cfihosParityTest.includes("sourceSha"), "RDL-004 parity test must verify typed identity and package provenance");
assert.ok(requirements.includes("RDL-CFIHOS-001") && requirements.includes("RDL-CFIHOS-010"), "Requirements must capture the RDL-004 ingestion and parity constraints");
assert.ok(packageJson.includes('"db:test:rdl-005"'), "Package scripts must expose the RDL-005 read-parity command");
assert.ok(postgresReadRepository.includes("class PostgresRdlRepository") && postgresReadRepository.includes("getDirectProperties") && postgresReadRepository.includes("getUnitsForDimension"), "RDL-005 must provide representative PostgreSQL RDL reads");
assert.ok(psqlJsonClient.includes("class PsqlJsonClient") && psqlJsonClient.includes("--no-psqlrc"), "RDL-005 local database adapter must isolate psql configuration");
assert.ok(rdlReadRepository.includes("interface RdlReadRepository") && rdlReadService.includes("class RdlReadService"), "RDL-005 must keep database reads behind repository and server-side service boundaries");
assert.ok(rdl005ParityTest.includes("CFIHOS-30000521") && rdl005ParityTest.includes("contentSha256") && rdl005ParityTest.includes("unit-family/dimension reads"), "RDL-005 parity must verify typed identity, provenance and representative relationships");
assert.ok(requirements.includes("RDL-READ-001") && requirements.includes("RDL-READ-008"), "Requirements must capture the RDL-005 read-parity constraints");
assert.ok(packageJson.includes('"db:test:rdl-006"'), "Package scripts must expose the RDL-006 controlled-cutover test");
assert.ok(rdlCutoverRepository.includes('RdlReadMode = "snapshot" | "postgresql" | "dual"'), "RDL-006 must define the three controlled read modes");
assert.ok(snapshotReadRepository.includes("class SnapshotRdlReadRepository") && dualReadRepository.includes("class DualReadRdlRepository"), "RDL-006 must preserve snapshot reference reads and add a dual-read comparator");
assert.ok(repositorySelector.includes('value ?? "snapshot"') && repositorySelector.includes("Invalid RDL_READ_MODE"), "RDL-006 selector must default safely and reject invalid modes");
assert.ok(dualReadRepository.includes("RDL dual-read mismatch") && dualReadRepository.includes("return reference"), "RDL-006 dual reads must fail closed and retain snapshot authority");
assert.ok(rdl006Test.includes("CFIHOS-30000521") && rdl006Test.includes("getDirectProperties") && rdl006Test.includes("getUnitsForDimension"), "RDL-006 test must cover typed identity and representative relationship reads");
assert.ok(envExample.includes("RDL_READ_MODE=snapshot"), "RDL-006 environment example must keep snapshot as the safe default");
assert.ok(requirements.includes("RDL-CUT-001") && requirements.includes("RDL-CUT-009"), "Requirements must capture controlled cutover and regression-oracle constraints");
assert.ok(packageJson.includes('"db:ingest:ccus"') && packageJson.includes('"db:test:rdl-007"'), "Package scripts must expose RDL-007 CCUS ingestion and coexistence tests");
assert.ok(rdl007Profile.includes("ccus-cfihos-format-v1") && rdl007Profile.includes("CCUS_CFIHOS_FORMAT_PROFILE"), "RDL-007 must define a versioned CCUS mapping profile");
assert.ok(rdl007Generator.includes("RdlWorkbookMappingProfile") && rdl007Generator.includes("mappingProfile"), "RDL-007 ingestion must route source-specific headers through a generic mapping-profile generator");
assert.ok(rdl007Generator.includes("packageKey") && rdl007Generator.includes("content_sha256"), "RDL-007 ingestion must preserve package identity and source SHA provenance");
assert.ok(rdl007Test.includes("multi-RDL identity") && rdl007Test.includes("CFIHOS isolation") && rdl007Test.includes("idempotence"), "RDL-007 test must prove package coexistence, CFIHOS isolation and repeatable ingestion");
assert.ok(rdl007Ingest.includes("generate-ccus-ingestion-sql.ts"), "RDL-007 CCUS command must use the profile-driven SQL generator");
assert.ok(requirements.includes("RDL-MR-001") && requirements.includes("RDL-MR-008"), "Requirements must capture first multi-RDL ingestion constraints");
assert.ok(packageJson.includes('"db:ingest:water-desalination"') && packageJson.includes('"db:test:rdl-008"'), "Package scripts must expose RDL-008 Water ingestion and genericity tests");
assert.ok(rdl008Profile.includes("water-desalination-normalized-v1") && rdl008Profile.includes("WATER_DESALINATION_PROFILE"), "RDL-008 must define a versioned Water / Desalination mapping profile");
assert.ok(rdl007Generator.includes("stableDerivedId") && rdl007Generator.includes("parentIdField"), "RDL-008 must generalize ingestion for identifier gaps and code-based hierarchy without source-specific tables");
assert.ok(rdl008Test.includes("format genericity") && rdl008Test.includes("three-RDL coexistence") && rdl008Test.includes("prior baselines"), "RDL-008 test must prove format genericity, three-RDL coexistence and prior baseline protection");
assert.ok(rdl008Ingest.includes("generate-water-desalination-ingestion-sql.ts"), "RDL-008 Water command must use the generic mapping-profile SQL generator");
assert.ok(requirements.includes("RDL-GEN-001") && requirements.includes("RDL-GEN-009"), "Requirements must capture the RDL-008 genericity constraints");
assert.ok(packageJson.includes('"generate:rdl-search-index"') && packageJson.includes('"db:test:rdl-009"'), "RDL-009 scripts must expose deterministic search-index generation and PostgreSQL search validation");
assert.ok(rdlScopeContext.includes('"all"') && rdlScopeContext.includes('"water-desalination"') && rdlScopeContext.includes("localStorage"), "RDL-009 scope must persist All/CFIHOS/CCUS/Water selection");
assert.ok(globalSearch.includes('/search?') && scopeSelector.includes("Active RDL search scope"), "RDL-009 top bar must provide global search and an accessible source selector");
assert.ok(rdlSearchPage.includes("sourceKey") && rdlSearchPage.includes("packageKey") && rdlSearchPage.includes("entityType"), "RDL-009 search results must retain package-aware typed identity");
assert.ok(rdlEntityPage.includes("Provenance") && rdlEntityPage.includes("packageKey"), "RDL-009 generic entity route must surface provenance");
assert.ok(rdlCataloguePage.toLowerCase().includes("candidate") && rdlCataloguePage.toLowerCase().includes("reviewed"), "RDL catalogue must distinguish candidate extensions from reviewed CFIHOS");
assert.ok(rdlSearchGenerator.includes("CCUS_CFIHOS_FORMAT_PROFILE") && rdlSearchGenerator.includes("WATER_DESALINATION_PROFILE") && rdlSearchGenerator.includes("cfihos-workbook.json"), "RDL-009 browser search projection must be reproducible from all three governed sources");
assert.ok(rdlGlobalSearchRepository.includes("source_key") && rdlGlobalSearchRepository.includes("entity_type_code"), "RDL-009 PostgreSQL search contract must preserve source and typed identity");
assert.ok(rdl009Test.includes("CFIHOS-30000521") && rdl009Test.includes("water-desalination") && rdl009Test.includes("ccus"), "RDL-009 database test must prove typed and source-filtered multi-RDL search");
assert.ok(requirements.includes("RDL-UX-001") && requirements.includes("RDL-UX-010"), "Requirements must capture RDL-009 multi-RDL UX and search constraints");
assert.ok(packageJson.includes('"generate:rdl-intelligence"') && packageJson.includes('"db:seed:rdl-010"') && packageJson.includes('"db:test:rdl-010"'), "RDL-010 scripts must expose projection generation, mapping seed and repository validation");
assert.ok(crossRdlMigration.includes("cross_rdl_mapping") && crossRdlMigration.includes("possible_match") && crossRdlMigration.includes("ai_suggested"), "RDL-010 must separate governed cross-RDL mappings from source-authoritative relationships");
assert.ok(crossRdlRepository.includes("class CrossRdlIntelligenceRepository") && crossRdlRepository.includes("provenance_method") && crossRdlRepository.includes("confidence"), "RDL-010 repository must expose typed provenance-aware mappings");
assert.ok(crossRdlGenerator.includes("exact-name candidate mapping") && crossRdlGenerator.includes('mappingType:"possible_match"'), "RDL-010 deterministic browser projection must never promote exact names directly to equivalence");
assert.ok(crossRdlPage.includes("Governance boundary") && crossRdlPage.includes("Overlap and gap profile") && crossRdlPage.includes("Candidate mappings"), "RDL-010 UX must explain governance and expose comparison/overlap/gap candidates");
assert.ok(rdl010Test.includes("metre") && rdl010Test.includes("candidate possible matches") && rdl010Test.includes("cross RDL sources"), "RDL-010 database test must verify cross-source isolation and non-authoritative candidate semantics");
assert.ok(requirements.includes("RDL-XINT-001") && requirements.includes("RDL-XINT-010"), "Requirements must capture RDL-010 cross-RDL intelligence governance constraints");
assert.ok(packageJson.includes('"generate:rdl-governance"') && packageJson.includes('"db:test:rdl-011"'), "RDL-011 scripts must expose governance projection and database acceptance validation");
assert.ok(governanceMigration.includes("cross_rdl_mapping_review_event") && governanceMigration.includes("review_cross_rdl_mapping") && governanceMigration.includes("append-only"), "RDL-011 must provide governed transitions and append-only review history");
assert.ok(governanceMigration.includes("review_version") && governanceMigration.includes("expected_version") && governanceMigration.includes("superseded_by_mapping_id"), "RDL-011 must provide optimistic concurrency and supersession traceability");
assert.ok(governanceRepository.includes("class CrossRdlGovernanceRepository") && governanceRepository.includes("listReviewQueue") && governanceRepository.includes("getHistory") && governanceRepository.includes("review("), "RDL-011 repository must expose queue, history and governed review operations");
assert.ok(governancePage.includes("Authenticated governance service boundary") && governancePage.includes("Read-only mode") && governancePage.includes("disabled={!session"), "RDL-011 governance protections must remain fail-closed when RDL-012 has no authenticated reviewer session");
assert.ok(governanceGenerator.includes("read-only") && governanceGenerator.includes("reviewVersion"), "RDL-011 governance projection must describe the read-only browser boundary");
assert.ok(rdl011Test.includes("optimistic versioning") && rdl011Test.includes("append-only audit history") && rdl011Test.includes("candidate -> approved"), "RDL-011 database test must verify governed transitions, audit and concurrency");
assert.ok(requirements.includes("RDL-GOV-001") && requirements.includes("RDL-GOV-010"), "Requirements must capture RDL-011 mapping governance constraints");
assert.ok(packageJson.includes('"test:rdl-012"'), "RDL-012 must expose an authenticated governance service-boundary test");
assert.ok(governanceIdentity.includes("RDL_GOVERNANCE_AUTH_SECRET") && governanceIdentity.includes("timingSafeEqual") && governanceIdentity.includes("rdl-mapping-reviewer"), "RDL-012 identity boundary must verify signed reviewer assertions and reviewer role");
assert.ok(governanceService.includes("identity.reviewer") && !governanceService.includes("body.reviewer"), "RDL-012 governance service must derive reviewer identity from the authenticated server context");
assert.ok(governanceSessionApi.includes("authenticatedContext") && governanceQueueApi.includes("listQueue") && governanceReviewApi.includes("service.review"), "RDL-012 must expose authenticated session, live queue and review API boundaries");
assert.ok(governanceBrowserService.includes("/api/governance/session") && governanceBrowserService.includes("/api/governance/queue") && governanceBrowserService.includes("/api/governance/review"), "RDL-012 browser client must use the same-origin governance service boundary");
assert.ok(governancePage.includes("Authenticated governance service boundary") && governancePage.includes("live governed actions enabled") && governancePage.includes("Read-only mode"), "RDL-012 governance page must enable live actions only for an authenticated reviewer session");
assert.ok(rdl012Test.includes("signature is invalid") && rdl012Test.includes("not authorized") && rdl012Test.includes("stale or invalid"), "RDL-012 test must cover signature integrity, reviewer authorization and replay-window rejection");
assert.ok(requirements.includes("RDL-AUTH-001") && requirements.includes("RDL-AUTH-010"), "Requirements must capture RDL-012 authenticated governance service constraints");
assert.ok(packageJson.includes('"test:rdl-013"') && packageJson.includes('"db:test:rdl-013"'), "RDL-013 must expose runtime and database integration tests");
assert.ok(pgJsonClient.includes('from "pg"') && pgJsonClient.includes("class PgJsonClient") && pgJsonClient.includes("transaction"), "RDL-013 must use a managed Node PostgreSQL pool with an explicit transaction boundary");
assert.ok(databaseRuntime.includes("getRdlDatabaseClient") && databaseRuntime.includes("PgJsonClient.fromConfig"), "RDL-013 must expose a singleton production database runtime");
assert.ok(governanceApiShared.includes("getRdlDatabaseClient") && !governanceApiShared.includes("PsqlJsonClient"), "RDL-013 production governance API must not spawn psql");
assert.ok(healthApi.includes('check: "liveness"') && readinessApi.includes('check: "readiness"') && readinessApi.includes("database.health"), "RDL-013 must separate liveness from database-backed readiness");
assert.ok(envExample.includes("RDL_DATABASE_POOL_MAX") && envExample.includes("RDL_DATABASE_SSL_REJECT_UNAUTHORIZED"), "RDL-013 must document pool and TLS runtime configuration");
assert.ok(packageJson.includes('"test:rdl-015"') && packageJson.includes('"package:deployment"') && packageJson.includes('"smoke:deployment"'), "RDL-015 must expose deployment, smoke and contract commands");
assert.ok(buildMetadataRuntime.includes("RDL_RELEASE_ID") && buildMetadataRuntime.includes("RDL_COMMIT_SHA"), "RDL-015 must expose non-secret release metadata");
assert.ok(runtimeMetrics.includes("averageDurationMs") && runtimeMetrics.includes("statusCodes") && runtimeMetrics.includes("errors"), "RDL-015 metrics must retain request latency/error/status aggregates");
assert.ok(versionApi.includes("getBuildMetadata") && metricsApi.includes("getRuntimeMetrics"), "RDL-015 must expose version and metrics APIs");
assert.ok(deploymentManifest.includes('"liveness"') && deploymentManifest.includes('"readiness"') && deploymentManifest.includes('"metrics"'), "RDL-015 runtime manifest must declare operational endpoints");
assert.ok(deploymentPackager.includes("rdl-explorer-deployment.tgz") && deploymentSmoke.includes("/api/readiness"), "RDL-015 must package and smoke-test deployment artifacts");
assert.ok(deploymentRunbook.includes("Environment promotion model") && deploymentRunbook.includes("Rollback"), "RDL-015 must document promotion and rollback");
assert.ok(rdl015Test.includes("deployment automation and observability contract"), "RDL-015 must provide a deterministic deployment/observability contract test");
assert.ok(requirements.includes("RDL-DEPLOY-001") && requirements.includes("RDL-DEPLOY-010"), "Requirements must capture RDL-015 deployment and observability constraints");
assert.ok(packageJson.includes('"db:test:rdl-016"'), "RDL-016 must expose an enterprise hierarchy database acceptance test");
assert.ok(enterpriseHierarchyMigration.includes("enterprise_context") && enterpriseHierarchyMigration.includes("context_package_pin") && enterpriseHierarchyMigration.includes("effective_context_publication"), "RDL-016 must persist enterprise contexts, exact package pins and immutable effective publications");
assert.ok(enterpriseHierarchyMigration.includes("active contexts are immutable") && enterpriseHierarchyMigration.includes("context_lineage"), "RDL-016 must freeze active context pins and provide deterministic lineage");
assert.ok(enterpriseHierarchyRepository.includes("class EnterpriseRdlHierarchyRepository") && enterpriseHierarchyRepository.includes("getComposition"), "RDL-016 must provide a server-side effective-context composition repository");
assert.ok(enterpriseHierarchyPage.includes("Four-layer enterprise hierarchy") && enterpriseHierarchyPage.includes("does not auto-migrate") && enterpriseHierarchyPage.includes("Governance boundary"), "RDL-016 UX must explain enterprise layering, frozen projects and demonstration provenance honestly");
assert.ok(rdl016Test.includes("company -> asset -> project lineage") && rdl016Test.includes("active project package pin mutation was not blocked"), "RDL-016 database test must prove hierarchy and active-project pin immutability");
assert.ok(requirements.includes("RDL-HIER-001") && requirements.includes("RDL-HIER-010"), "Requirements must capture RDL-016 enterprise hierarchy and extension-governance constraints");
assert.ok(rdl013Test.includes("DatabaseRuntimeError") && rdl013Test.includes("poolStats"), "RDL-013 runtime test must cover structured errors and pool telemetry");
assert.ok(requirements.includes("RDL-RUNTIME-001") && requirements.includes("RDL-RUNTIME-010"), "Requirements must capture RDL-013 production runtime constraints");
assert.ok(packageJson.includes('"test:rdl-014"') && packageJson.includes('"validate:production-env"'), "RDL-014 must expose runtime-hardening and production-environment validation commands");
assert.ok(requestContextRuntime.includes("X-Request-ID") || apiRuntime.includes("X-Request-ID"), "RDL-014 must establish correlation IDs for hardened API requests");
assert.ok(structuredLogger.includes("JSON.stringify") && structuredLogger.includes("requestId") && structuredLogger.includes("durationMs"), "RDL-014 must emit structured correlation-aware operational logs");
assert.ok(rateLimiterRuntime.includes("FixedWindowRateLimiter") && governanceApiShared.includes("GovernanceRateLimitError") && governanceApiShared.includes("Retry-After"), "RDL-014 must apply defensive governance rate limiting");
assert.ok(runtimeEnvironment.includes("RDL_GOVERNANCE_AUTH_SECRET") && runtimeEnvironment.includes("RDL_DATABASE_URL") && readinessApi.includes("assertRuntimeEnvironment"), "RDL-014 production readiness must fail closed on unsafe runtime configuration");
assert.ok(shutdownRuntime.includes("closeRdlDatabaseClient") && shutdownRuntime.includes("SIGTERM"), "RDL-014 must provide graceful PostgreSQL pool shutdown for long-lived runtimes");
assert.ok(productionDeployment.includes("distributed rate limit") && productionDeployment.includes("X-Request-ID") && productionDeployment.includes("secret"), "RDL-014 deployment guide must document distributed controls, correlation and secret handling");
assert.ok(rdl014Test.includes("production deployment and runtime hardening contract") && rdl014Test.includes("FixedWindowRateLimiter"), "RDL-014 contract test must cover deployment/runtime hardening behavior");
assert.ok(requirements.includes("RDL-OPS-001") && requirements.includes("RDL-OPS-008"), "Requirements must capture RDL-014 operational hardening constraints");

assert.ok(shell.includes("pilot-badge"), "Pilot status badge is missing from the application shell");
assert.ok(shell.includes("CFIHOS 2.0 + 2 candidate extensions"), "Loaded multi-RDL provenance summary is missing from the shell");
assert.ok(shell.includes("GlobalRdlSearch") && shell.includes("RdlScopeSelector"), "RDL-009 global search and scope selector must be present in the application shell");
assert.ok(shell.includes("alessandro@papioconsulting.eu"), "Pilot feedback route is missing from the application shell");
assert.ok(about.includes("controlled evaluation") && about.includes("pilot"), "About page must explain pilot status");
assert.ok(help.includes("Global RDL search is enabled") && help.includes("RDL scope") && help.includes("source and release provenance"), "User Guide must explain the enabled multi-RDL global-search pilot behavior");
assert.ok(help.includes("Do not include confidential project information"), "Pilot feedback guidance must warn against confidential information");

for (const [name, source] of [["Tag Classes", tagClasses], ["Equipment Classes", equipmentClasses]] as const) {
  assert.ok(source.includes('aria-label="On this page"'), `${name} detail page must expose an On this page navigator`);
  assert.ok(source.includes("COLLAPSE_THRESHOLD = 10"), `${name} must retain the long-list collapse threshold`);
  assert.ok(source.includes("COLLAPSED_ITEM_COUNT = 5"), `${name} must retain the five-item collapsed preview`);
  assert.ok(source.includes("aria-expanded={expanded}"), `${name} expansion controls must expose their state accessibly`);
}

assert.ok(documentTypes.includes('aria-label="On this page"'), "Document Types detail page must expose an On this page navigator");
assert.ok(documentTypes.includes("COLLAPSE_THRESHOLD = 10"), "Document Types must retain the long-list collapse threshold");
assert.ok(documentTypes.includes("COLLAPSED_ITEM_COUNT = 5"), "Document Types must retain the five-item collapsed preview");
assert.ok(documentTypes.includes("aria-expanded={expanded}"), "Document Types expansion controls must expose their state accessibly");
assert.ok(documentTypes.includes('id="document-required-by-classes"'), "Document Types must expose a stable Required by Classes anchor");

assert.ok(dataDictionary.includes('aria-label="On this page"'), "Data Dictionary property detail must expose an On this page navigator");
assert.ok(dataDictionary.includes("COLLAPSE_THRESHOLD = 10"), "Data Dictionary must retain the long-list collapse threshold");
assert.ok(dataDictionary.includes("COLLAPSED_ITEM_COUNT = 5"), "Data Dictionary must retain the five-item collapsed preview");
assert.ok(dataDictionary.includes("aria-expanded={expanded}"), "Data Dictionary expansion controls must expose their state accessibly");
assert.ok(dataDictionary.includes('id="dictionary-units"'), "Data Dictionary must expose a stable Units of Measure anchor");
assert.ok(dataDictionary.includes('id="dictionary-tag-classes"'), "Data Dictionary must expose a stable Used by Tag Classes anchor");
assert.ok(dataDictionary.includes('id="dictionary-picklist-values"'), "Data Dictionary must expose a stable Allowed Values anchor");


assert.ok(sourceStandards.includes('aria-label="On this page"'), "Source Standards detail page must expose an On this page navigator");
assert.ok(sourceStandards.includes("COLLAPSE_THRESHOLD = 10"), "Source Standards must retain the long-list collapse threshold");
assert.ok(sourceStandards.includes("COLLAPSED_ITEM_COUNT = 5"), "Source Standards must retain the five-item collapsed preview");
assert.ok(sourceStandards.includes("aria-expanded={expanded}"), "Source Standards expansion controls must expose their state accessibly");
assert.ok(sourceStandards.includes('id="source-standard-classes"'), "Source Standards must expose a stable Classes anchor");
assert.ok(sourceStandards.includes('id="source-standard-jip33"'), "Source Standards must expose a stable JIP33 anchor");
assert.ok(sourceStandards.includes('id="source-standard-properties"'), "Source Standards must expose a stable Property mappings anchor");
assert.ok(sourceStandards.includes('id="source-standard-picklist-values"'), "Source Standards must expose a stable Picklist values anchor");

assert.ok(disciplines.includes("COLLAPSE_THRESHOLD = 10"), "Disciplines must retain the long-list collapse threshold");
assert.ok(disciplines.includes("COLLAPSED_ITEM_COUNT = 5"), "Disciplines must retain the five-item collapsed preview");
assert.ok(disciplines.includes("aria-expanded={documentTypesExpanded}"), "Discipline expansion control must expose its state accessibly");
assert.ok(disciplines.includes('id="discipline-document-types-list"'), "Disciplines must expose a stable Document Types list target");

console.log(`PASS routes: ${routes.length} critical application routes registered.`);
console.log("PASS navigation: critical Explorer capabilities remain discoverable.");
console.log("PASS performance contract: route-level lazy loading and accessible fallback are present.");
console.log("PASS CIS/Assistant contract: persistence, active CIS context and server-side AI boundary are present.");
console.log("PASS RDL-001 bootstrap: product identity, architecture, roadmap and requirements are present.");
console.log("PASS RDL-002 database foundation: schemas, migrations, configuration, health checks and repository boundaries are present.");
console.log("PASS RDL-005 read parity: server-side PostgreSQL repository, service boundary and deterministic parity gate are present.");
console.log("PASS RDL-006 controlled cutover: snapshot/postgresql/dual selection and fail-closed parity comparison are present.");
console.log("PASS RDL-007 multi-RDL foundation: CCUS mapping profile, provenance, coexistence and idempotence gates are present.");
console.log("PASS RDL-008 genericity proof: Water / Desalination mapping, deterministic identifier derivation and three-RDL coexistence gates are present.");
console.log("PASS RDL-009 multi-RDL UX: scope selection, package-aware global search, provenance routes and search repository gates are present.");
console.log("PASS pilot readiness: status, provenance, honest search state and feedback route are present.");
console.log("PASS class detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS document detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS property detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS Source Standard detail UX: anchored contents navigation and accessible progressive disclosure are present.");
console.log("PASS Discipline detail UX: long Document Type relationships use accessible progressive disclosure.");
console.log("\nApplication regression checks passed.");
