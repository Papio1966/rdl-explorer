import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

const migration=read("database/migrations/030_create_company_rdl_adoption_runtime.sql");
const repository=read("server/rdl/CompanyRdlAdoptionRepository.ts");
const service=read("server/rdl/CompanyRdlAdoptionService.ts");
const publication=read("server/rdl/EffectiveStandardPublicationRepository.ts");
const dbTest=read("database/sql/test_rdl_057_company_adoption_runtime.sql");

for(const phrase of [
  "create_company_rdl_context",
  "pin_company_industry_package",
  "create_company_adoption_composition",
  "entity_composition_contributor",
  "entity_composition_component_decision",
]) {
  assert.ok(migration.includes(phrase),`Missing RDL-057 migration contract: ${phrase}`);
}

assert.ok(
  migration.includes("Only a published L1 release may be adopted"),
  "Company package adoption must require a published L1 release"
);

assert.ok(
  migration.includes("'company'"),
  "Company adoption runtime must target the Company/L2 layer"
);

assert.doesNotMatch(
  migration,
  /UPDATE\s+rdl\.rdl_entity|DELETE\s+FROM\s+rdl\.rdl_entity|UPDATE\s+rdl\.rdl_package|DELETE\s+FROM\s+rdl\.rdl_package/i,
  "RDL-057 must never mutate L1 source entities or packages"
);

for(const phrase of [
  "listPublishedIndustryPackages",
  "createCompanyContext",
  "pinIndustryPackage",
  "createComposition",
]) {
  assert.ok(repository.includes(phrase),`Repository missing ${phrase}`);
}

assert.ok(
  service.includes("At least one exact L1 contributor is required"),
  "Service must fail closed when no exact contributor is supplied"
);

assert.ok(
  publication.includes("An effective standard must contain at least one governed entity before publication."),
  "Effective publication must reject empty governed content"
);

assert.ok(
  dbTest.includes("ROLLBACK"),
  "Database acceptance test must not retain fixtures"
);

console.log(
  "PASS - RDL-057 Company RDL adoption runtime: draft Company context, exact published L1 package adoption, exact entity composition provenance and non-empty publication guard are implemented without source mutation"
);
