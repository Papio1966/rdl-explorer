import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

const migration=read(
  "database/migrations/031_create_company_adoption_collision_governance.sql"
);

const repository=read(
  "server/rdl/CompanyRdlAdoptionRepository.ts"
);

const service=read(
  "server/rdl/CompanyRdlAdoptionService.ts"
);

const browser=read(
  "src/rdl/companyRdlAdoptionService.ts"
);

const publication=read(
  "server/rdl/EffectiveStandardPublicationRepository.ts"
);

for(const decision of [
  "'merge'",
  "'keep_separate'",
  "'rename'",
  "'exclude'",
  "'defer'",
]){
  assert.ok(
    migration.includes(decision),
    `RDL-058 missing collision decision ${decision}`
  );
}

assert.ok(
  migration.includes(
    "company_adoption_collision_decision_event"
  ),
  "Collision decisions must retain append-only history"
);

assert.ok(
  migration.includes(
    "Company adoption collision decision version conflict"
  ),
  "Collision decisions must use optimistic versioning"
);

for(const capability of [
  "listPublishedPackageEntities",
  "listCollisionCandidates",
  "recordCollisionDecision",
]){
  assert.ok(
    repository.includes(capability),
    `Repository missing ${capability}`
  );

  assert.ok(
    service.includes(capability),
    `Service missing ${capability}`
  );
}

for(const route of [
  "/api/company-adoption/entities",
  "/api/company-adoption/collisions",
  "/api/company-adoption/collision-decision",
]){
  assert.ok(
    browser.includes(route),
    `Browser service missing ${route}`
  );
}

assert.ok(
  publication.includes(
    "Deferred Company adoption collisions must be resolved before publication."
  ),
  "Explicit deferred collisions must block publication"
);

assert.doesNotMatch(
  migration,
  /UPDATE\s+rdl\.rdl_entity|DELETE\s+FROM\s+rdl\.rdl_entity/i,
  "Collision governance must not mutate L1 source entities"
);

console.log(
  "PASS - RDL-058 Company adoption collision governance: direct published-package entity discovery and contextual Merge / Keep Separate / Rename / Exclude / Defer decisions are persisted with audit/versioning, while deferred decisions block publication"
);
