import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compareCompositionCandidates,
  compositionDependencyKeys,
  createMultiRdlCompositionDraft,
  detectSameNameCollisions,
  exactEntityKey,
  promotionCandidateReport,
  sourceUpgradeImpact,
} from "../src/rdl/multiRdlComposition";

const cfihos = { sourceKey:"cfihos", releaseKey:"cfihos-2.0", packageKey:"cfihos-2.0-a", entityType:"tag_class", nativeIdentifier:"CF-CP", name:"Centrifugal Pump", definition:"Pump", properties:["design pressure","flow"], documents:["datasheet"], disciplines:["mechanical"], relationships:["parent:pump"] };
const ccus = { sourceKey:"ccus", releaseKey:"ccus-2.0", packageKey:"ccus-2.0-b", entityType:"tag_class", nativeIdentifier:"CC-CP", name:"Centrifugal Pump", definition:"CCUS pump", properties:["design pressure","co2 phase"], documents:["datasheet","materials report"], disciplines:["mechanical","materials"], relationships:["parent:rotating equipment"] };

const collisions = detectSameNameCollisions([cfihos, ccus]);
assert.equal(collisions.length, 1);
assert.equal(collisions[0].automaticEquivalence, false);
assert.equal(collisions[0].decisionRequired, true);
assert.equal(collisions[0].normalizedName, "centrifugal pump");

const diff = compareCompositionCandidates(cfihos, ccus);
assert.equal(diff.nameEqual, true);
assert.equal(diff.definitionEqual, false);
assert.deepEqual(diff.properties.common, ["design pressure"]);
assert.deepEqual(diff.properties.leftOnly, ["flow"]);
assert.deepEqual(diff.properties.rightOnly, ["co2 phase"]);
assert.deepEqual(diff.documents.rightOnly, ["materials report"]);
assert.deepEqual(diff.disciplines.rightOnly, ["materials"]);

const cfKey = exactEntityKey(cfihos);
const ccKey = exactEntityKey(ccus);
const composition = createMultiRdlCompositionDraft({
  targetLayer:"company",
  targetContextKey:"COMPANY-RDL-5",
  compositionKind:"multi_source_merge",
  targetEntityType:"tag_class",
  targetNativeIdentifier:"COMPANY-TC-00421",
  targetName:"Centrifugal Pump",
  contributors:[cfihos,ccus],
  componentDecisions:[
    { componentKind:"definition", componentKey:"definition", resolution:"target_override", resolvedValue:"Company centrifugal pump", rationale:"Company definition reconciles both source definitions." },
    { componentKind:"property", componentKey:"design pressure", resolution:"combine", selectedContributorKeys:[cfKey,ccKey], rationale:"Common concept retained with a company-governed requirement decision." },
    { componentKind:"property", componentKey:"co2 phase", resolution:"use_source", selectedContributorKeys:[ccKey], rationale:"CCUS-specific property is required for company scope." },
    { componentKind:"document_type", componentKey:"materials report", resolution:"use_source", selectedContributorKeys:[ccKey], rationale:"Retain the CCUS document requirement." },
  ],
  rationale:"Compose the two same-name source classes into one governed Company class without mutating either source.",
});
assert.equal(composition.boundary.sourceEntitiesImmutable, true);
assert.equal(composition.boundary.sameNameDoesNotImplyEquivalence, true);
assert.equal(composition.boundary.dataGateOwnsComposition, false);
assert.equal(composition.boundary.directDataGateToRdlDatabaseMutation, "prohibited");
assert.deepEqual(compositionDependencyKeys(composition), [ccKey,cfKey].sort());
assert.deepEqual(sourceUpgradeImpact(composition,[cfKey]), { impacted:true, affectedContributors:[cfKey], automaticMigration:false });
assert.deepEqual(sourceUpgradeImpact(composition,["other"]), { impacted:false, affectedContributors:[], automaticMigration:false });
assert.throws(() => createMultiRdlCompositionDraft({ ...composition, schemaVersion: undefined as never, boundary: undefined as never, contributors:[cfihos], componentDecisions:composition.componentDecisions } as never), /at least two exact source packages/);

const promotion = promotionCandidateReport([
  {extensionChangeId:3,sourceLayer:"project" as const,approved:true,alreadyPromoted:false},
  {extensionChangeId:2,sourceLayer:"asset" as const,approved:true,alreadyPromoted:true},
  {extensionChangeId:1,sourceLayer:"project" as const,approved:false,alreadyPromoted:false},
]);
assert.deepEqual(promotion.map((item)=>item.extensionChangeId),[3]);
assert.equal(promotion[0].automaticPromotion,false);

const migration = readFileSync("database/migrations/026_create_multi_rdl_composition_derivation.sql","utf8");
for (const phrase of [
  "rdl.entity_composition",
  "rdl.entity_composition_contributor",
  "rdl.entity_composition_component_decision",
  "rdl.entity_composition_dependency",
  "rdl.derived_compositions_impacted_by_release",
  "rdl.upward_promotion_candidate",
  "source_entity_id bigint NOT NULL REFERENCES rdl.rdl_entity",
]) assert.ok(migration.includes(phrase),`missing migration contract: ${phrase}`);
assert.doesNotMatch(migration,/DROP\s+TABLE|TRUNCATE\s+|DELETE\s+FROM\s+rdl\.|UPDATE\s+rdl\.rdl_entity/i);

const docs = readFileSync("docs/development/RDL_054_MULTI_RDL_COMPOSITION_DERIVATION.md","utf8");
for (const phrase of ["same name does not mean semantic equivalence","component-level","exact provenance","never automatically promotes","DataGate remains a consumer"]) assert.ok(docs.toLowerCase().includes(phrase.toLowerCase()),`missing architecture statement: ${phrase}`);

console.log("PASS - RDL-054 multi-RDL composition: same-name collisions remain candidates, deep differences are exposed, target-layer derivation retains exact multi-source provenance, source upgrades are impact-only, and promotion remains advisory/governed");
