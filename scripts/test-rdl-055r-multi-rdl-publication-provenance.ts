import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EffectiveStandardPublicationRepository } from "../server/rdl/EffectiveStandardPublicationRepository";
import { PublishedPackageDistributionRepository } from "../server/rdl/PublishedPackageDistributionRepository";

const migration = readFileSync("database/migrations/027_extend_multi_rdl_publication_provenance.sql","utf8");
assert.match(migration,/DROP CONSTRAINT IF EXISTS context_package_pin_context_id_layer_type_key/);
assert.match(migration,/uq_context_package_pin_context_layer_package/);
assert.match(migration,/BEFORE INSERT OR UPDATE OR DELETE ON rdl\.context_package_pin/);

const publicationSource = readFileSync("server/rdl/EffectiveStandardPublicationRepository.ts","utf8");
for (const token of [
  "rdl.entity_composition_contributor",
  "rdl.entity_composition_component_decision",
  'schemaVersion:"rdl-entity-derivation/v1"',
  "sameNameAutomaticEquivalence:false",
  "effectiveRelationships",
  "rdl.rdl_relationship rel",
]) assert.ok(publicationSource.includes(token),`publication repair missing token: ${token}`);

const distributionSource = readFileSync("server/rdl/PublishedPackageDistributionRepository.ts","utf8");
assert.match(distributionSource,/derivation\?:EffectiveStandardDerivation/);
assert.match(distributionSource,/packageBody\.effectiveRelationships/);
assert.match(distributionSource,/rdl-distribution-package\/v1/);
assert.match(distributionSource,/package:\$\{Number\(e\.package_id\)\}/);
assert.match(distributionSource,/Ambiguous multi-RDL/);

const compositionSource = readFileSync("database/migrations/026_create_multi_rdl_composition_derivation.sql","utf8");
assert.match(compositionSource,/source_package_id bigint NOT NULL REFERENCES rdl\.rdl_package/);
assert.match(compositionSource,/source_entity_id bigint NOT NULL REFERENCES rdl\.rdl_entity/);

const publicationQueries:string[]=[];
const publicationClient={
  async query(sql:string){
    publicationQueries.push(sql);
    if(sql.includes("FROM rdl.enterprise_context WHERE context_key")) return [{context_id:30,context_key:"PROJECT-055R",context_type:"project",name:"Project 055R",status:"draft"}];
    if(sql.includes("FROM rdl.context_lineage")) return [
      {depth:2,context_id:10,context_key:"COMPANY-055R",context_type:"company",name:"Company 055R",status:"draft"},
      {depth:1,context_id:20,context_key:"ASSET-055R",context_type:"asset",name:"Asset 055R",status:"draft"},
      {depth:0,context_id:30,context_key:"PROJECT-055R",context_type:"project",name:"Project 055R",status:"draft"},
    ];
    if(sql.includes("FROM rdl.context_package_pin pin")) return [
      {context_key:"COMPANY-055R",layer_type:"industry",package_id:101,package_key:"cfihos-pkg",precedence:1,context_package_pin_id:1},
      {context_key:"COMPANY-055R",layer_type:"industry",package_id:102,package_key:"ccus-pkg",precedence:2,context_package_pin_id:2},
    ];
    if(sql.includes("FROM rdl.context_extension_change ch") && sql.includes("LEFT JOIN rdl.rdl_entity")) return [
      {extension_change_id:900,context_id:10,context_key:"COMPANY-055R",context_type:"company",change_kind:"add",entity_type_code:"unit_of_measure",native_identifier:"RDL055-QUALIFICATION-COMPOSITE-001",base_entity_id:null,proposed_name:"percent",proposed_definition:"Governed Company composition",rationale:"Governed merge",status:"approved",inherited_name:null,inherited_definition:null},
    ];
    if(sql.includes("SELECT count(*)::integer AS count FROM rdl.context_extension_change")) return [{count:0}];
    if(sql.includes("FROM rdl.entity_composition c")) return [{composition_id:700,target_extension_change_id:900,composition_kind:"multi_source_merge",rationale:"Merge exact sources",created_by:"custodian",created_at:"2026-09-13T12:00:00Z"}];
    if(sql.includes("FROM rdl.entity_composition_contributor cc")) return [
      {composition_id:700,contribution_role:"primary",source_snapshot:{name:"percent"},source_id:1,source_key:"cfihos",release_id:11,release_key:"cfihos-2.0",package_id:101,package_key:"cfihos-pkg",entity_id:1001,entity_type_code:"unit_of_measure",native_identifier:"CFIHOS-60000001"},
      {composition_id:700,contribution_role:"contributor",source_snapshot:{name:"percent"},source_id:2,source_key:"ccus",release_id:12,release_key:"ccus-2.0",package_id:102,package_key:"ccus-pkg",entity_id:1002,entity_type_code:"unit_of_measure",native_identifier:"CFIHOS-60000001"},
    ];
    if(sql.includes("FROM rdl.entity_composition_component_decision")) return [
      {composition_id:700,component_kind:"property",component_key:"design pressure",resolution:"combine",selected_source_entity_id:null,resolved_payload:{sources:2},rationale:"Combine exact sources",decided_by:"custodian",decided_at:"2026-09-13T12:01:00Z"},
    ];
    if(sql.includes("FROM rdl.rdl_relationship rel")) return [
      {relationship_id:501,package_id:101,package_key:"cfihos-pkg",relationship_type_code:"class_property",relationship_status:"active",attributes:{mandatory:true},source_locator:{sheet:"A"},source_entity_type:"tag_class",source_native_identifier:"CFIHOS-60000001",target_entity_type:"property",target_native_identifier:"CF-PROP"},
      {relationship_id:502,package_id:102,package_key:"ccus-pkg",relationship_type_code:"class_property",relationship_status:"active",attributes:{mandatory:false},source_locator:{sheet:"B"},source_entity_type:"tag_class",source_native_identifier:"CFIHOS-60000001",target_entity_type:"property",target_native_identifier:"CC-PROP"},
    ];
    if(sql.includes("INSERT INTO rdl.effective_standard_release")) return [{effective_standard_release_id:155,published_at:"2026-09-13T12:05:00Z"}];
    throw new Error(`Unexpected publication query: ${sql}`);
  },
};

const publisher=new EffectiveStandardPublicationRepository(publicationClient as never);
const published=await publisher.publish("PROJECT-055R","project-055r","1.0.0","custodian");
const manifest=published.packageManifest as any;
const payload=published.packagePayload as any;
assert.equal(manifest.packagePins.length,2);
assert.deepEqual(manifest.packagePins.map((p:any)=>p.layerType),["industry","industry"]);
assert.equal(manifest.derivations.length,1);
assert.equal(manifest.derivations[0].contributors.length,2);
assert.equal(manifest.derivations[0].boundary.sameNameAutomaticEquivalence,false);
assert.equal(payload.provenance.derivations[0].contributors[0].sourceKey,"cfihos");
assert.equal(payload.provenance.derivations[0].contributors[1].sourceKey,"ccus");
assert.equal(payload.effectiveRelationships.length,2);
assert.equal(manifest.relationshipClosure.count,2);

const releaseRow={
  effective_standard_release_id:155,context_id:30,context_key:"PROJECT-055R",context_type:"project",context_name:"Project 055R",
  release_key:"project-055r",release_version:"1.0.0",composition_sha256:published.compositionSha256,published_by:"custodian",published_at:"2026-09-13T12:05:00Z",
  lifecycle_status:"active",superseded_by_release_id:null,compatibility:{contract:"rdl-distribution/v1",minimumConsumerVersion:"1.0"},deprecation_message:null,
  package_manifest:published.packageManifest,package_payload:published.packagePayload,
};
const distributionClient={
  async query(sql:string){
    if(sql.includes("FROM rdl.effective_standard_release r")) return [releaseRow];
    if(sql.includes("FROM rdl.rdl_entity WHERE package_id IN")) return [
      {entity_id:1001,package_id:101,entity_type_code:"unit_of_measure",native_identifier:"CFIHOS-60000001",name:"percent",definition:"CFIHOS",lifecycle_status:"active"},
      {entity_id:1002,package_id:102,entity_type_code:"unit_of_measure",native_identifier:"CFIHOS-60000001",name:"percent",definition:"CCUS",lifecycle_status:"active"},
    ];
    throw new Error(`Unexpected distribution query: ${sql}`);
  },
};
const distributor=new PublishedPackageDistributionRepository(distributionClient as never);
const publicManifest=await distributor.manifest(155) as any;
assert.equal(publicManifest.schemaVersion,"rdl-distribution-manifest/v1");
assert.equal(publicManifest.packageManifest.derivations[0].contributors.length,2);
const consumerPackage=await distributor.consumerPackage(155) as any;
assert.equal(consumerPackage.schemaVersion,"rdl-distribution-package/v1");
assert.equal(consumerPackage.effectiveRelationships.length,2);
const derived=consumerPackage.effectiveEntities.find((e:any)=>e.nativeIdentifier==="RDL055-QUALIFICATION-COMPOSITE-001");
assert.ok(derived,"derived Company entity must be distributed");
assert.equal(derived.derivation.contributors.length,2);
assert.deepEqual(new Set(derived.derivation.contributors.map((c:any)=>c.sourceKey)),new Set(["cfihos","ccus"]));
const sameNameSources=consumerPackage.effectiveEntities.filter((e:any)=>e.name==="percent" && e.changeKind==="inherited");
assert.equal(sameNameSources.length,2,"same-name/same-native-id/different-package inherited entities must remain distinct in this qualification fixture");

const legacyRow={...releaseRow,package_manifest:{...published.packageManifest,derivations:undefined,relationshipClosure:undefined},package_payload:{schemaVersion:"rdl-effective-standard-package/v1",changes:[],summary:{}}};
const legacyClient={
  async query(sql:string){
    if(sql.includes("FROM rdl.effective_standard_release r")) return [legacyRow];
    if(sql.includes("FROM rdl.rdl_entity WHERE package_id IN")) return [];
    throw new Error(`Unexpected legacy distribution query: ${sql}`);
  },
};
const legacyPackage=await new PublishedPackageDistributionRepository(legacyClient as never).consumerPackage(155) as any;
assert.equal(Object.prototype.hasOwnProperty.call(legacyPackage,"effectiveRelationships"),false,"legacy release package must not gain synthetic relationship bytes");

assert.ok(publicationQueries.some((sql)=>sql.includes("rdl.entity_composition_contributor")));
assert.ok(publicationQueries.some((sql)=>sql.includes("rdl.rdl_relationship rel")));
console.log("PASS - RDL-055R publication/distribution repair: multi-L1 pins, exact RDL-054 provenance, same-name distinctness, relationship closure and legacy package compatibility");
