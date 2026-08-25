import assert from "node:assert/strict";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CrossRdlIntelligenceRepository } from "../server/rdl/CrossRdlIntelligenceRepository.ts";
const url=process.env.RDL_DATABASE_URL;if(!url) throw new Error("RDL_DATABASE_URL is required");
const client=new PsqlJsonClient(url); const repo=new CrossRdlIntelligenceRepository(client);
const rows=await client.query<any>(`SELECT count(*)::int AS n FROM rdl.cross_rdl_mapping`);
assert.ok(Number(rows[0]?.n)>0,"RDL-010 must seed cross-RDL candidate mappings");
const invalid=await client.query<any>(`
 SELECT count(*)::int AS n FROM rdl.cross_rdl_mapping m
 JOIN rdl.rdl_entity a ON a.entity_id=m.source_entity_id JOIN rdl.rdl_package pa ON pa.package_id=a.package_id JOIN rdl.rdl_release ra ON ra.release_id=pa.release_id
 JOIN rdl.rdl_entity b ON b.entity_id=m.target_entity_id JOIN rdl.rdl_package pb ON pb.package_id=b.package_id JOIN rdl.rdl_release rb ON rb.release_id=pb.release_id
 WHERE ra.source_id=rb.source_id OR (m.provenance_method='exact_name_rule' AND (m.mapping_type<>'possible_match' OR m.status<>'candidate' OR m.confidence>0.9))
`);
assert.equal(Number(invalid[0]?.n),0,"derived mappings must cross RDL sources and exact-name rules must remain candidate possible matches");
const matches=await repo.getMappingsForEntity("cfihos","unit_of_measure","CFIHOS-60001461");
assert.ok(matches.some(x=>x.targetKey==="water-desalination" || x.sourceKey==="water-desalination"),"metre should expose a cross-RDL Water candidate mapping");
const summary=await repo.summarize(); assert.ok(summary.length>=2,"summary must cover multiple source pairs");
console.log(`PASS governed cross-RDL mappings: ${rows[0].n}`);
console.log(`PASS provenance-safe candidate rule: metre mappings=${matches.length}`);
console.log("PASS RDL-010 cross-RDL intelligence repository");
