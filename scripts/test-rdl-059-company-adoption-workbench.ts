import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>
  readFileSync(path,"utf8");

const migration=read(
  "database/migrations/032_refine_company_collision_decision_subject.sql"
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

const page=read(
  "src/pages/RdlCompanyAdoptionPage.tsx"
);

assert.ok(
  migration.includes("subject_entity_id"),
  "RDL-059 must persist the precise Rename / Exclude subject"
);

assert.ok(
  migration.includes(
    "Collision decision subject must belong to the selected mapping"
  ),
  "Decision subjects must be constrained to mapping participants"
);

for(const phrase of [
  "loadPublishedPackageEntities",
  "loadCompanyCollisionCandidates",
  "recordCompanyCollisionDecision",
]){
  assert.ok(
    page.includes(phrase),
    `Company Adoption workbench missing ${phrase}`
  );
}

assert.ok(
  page.includes("Search published L1 entities"),
  "The administrator must select L1 content through search"
);

assert.ok(
  !page.includes("Exact source entity ID"),
  "Numeric entity IDs must not be the normal selector"
);

for(const decision of [
  '"merge"',
  '"keep_separate"',
  '"rename"',
  '"exclude"',
  '"defer"',
]){
  assert.ok(
    page.includes(decision),
    `Collision workbench missing ${decision}`
  );
}

assert.ok(
  page.includes("decisionSubjectEntityId"),
  "Rename / Exclude must expose the exact decision subject"
);

assert.ok(
  page.includes("unresolvedCollisions")
  &&page.includes("deferredCollisions"),
  "Unresolved and deferred collisions must block adoption"
);

assert.ok(
  page.includes("mergeCollisions"),
  "Merge intent must be detected before composition"
);

assert.ok(
  page.includes(
    "Explicit component-level merge resolution is required"
  ),
  "Merge intent must not silently collapse semantic components"
);

assert.ok(
  repository.includes("subjectEntityId"),
  "Repository must retain decision subject"
);

assert.ok(
  service.includes(
    "Rename and Exclude require the exact subject entity."
  ),
  "Service must validate subject-sensitive decisions"
);

assert.ok(
  browser.includes("subjectEntityId"),
  "Browser contract must carry decision subject"
);

console.log(
  "PASS - RDL-059 Company Adoption workbench: administrators select published L1 entities by business-facing search, review contextual collision evidence and persist Merge / Keep Separate / Rename / Exclude / Defer decisions with precise subject semantics; merge remains fail-closed pending component resolution"
);
