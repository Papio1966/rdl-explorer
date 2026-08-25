import assert from "node:assert/strict";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";
import { CrossRdlGovernanceRepository } from "../server/rdl/CrossRdlGovernanceRepository.ts";
const url=process.env.RDL_DATABASE_URL;if(!url) throw new Error("RDL_DATABASE_URL is required");
const client=new PsqlJsonClient(url);const repo=new CrossRdlGovernanceRepository(client);
const queue=await repo.listReviewQueue("candidate",5);
assert.ok(queue.length>0,"review queue must expose candidate mappings");
assert.ok(queue.every(item=>item.status==="candidate"),"candidate queue must not contain approved/rejected/retired mappings");
console.log(`PASS RDL-011 review queue repository: ${queue.length} sampled candidates`);
