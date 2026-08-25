import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const root=process.cwd();
const intelligence=JSON.parse(await readFile(path.join(root,"public/rdl-cross-intelligence.json"),"utf8"));
const items=intelligence.mappings.map((m:any,index:number)=>({
  queueKey:`candidate-${index+1}`,mappingType:m.mappingType,provenanceMethod:m.provenanceMethod,confidence:m.confidence,status:m.status,
  normalizedName:m.normalizedName,left:m.left,right:m.right,reviewVersion:0,reviewedBy:null,reviewedAt:null,reviewRationale:null
}));
const projection={generatedBy:"RDL-011 governed review projection",warning:"Pilot review queue is read-only. Approve/reject/supersede are server-governed database operations through the governance repository/service boundary.",summary:{candidate:items.filter((x:any)=>x.status==='candidate').length,approved:0,rejected:0,retired:0},items};
await writeFile(path.join(root,"public/rdl-governance.json"),JSON.stringify(projection));
console.log(`Generated RDL-011 governance projection: ${items.length} review items`);
