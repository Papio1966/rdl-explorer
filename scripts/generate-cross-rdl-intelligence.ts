import fs from "node:fs";
import path from "node:path";

type RecordRow={sourceKey:string;sourceName:string;releaseKey:string;releaseStatus:string;versionLabel:string;packageKey:string;entityType:string;nativeIdentifier:string;name:string;definition?:string;sourceSheet:string};
type Mapping={mappingType:"possible_match";provenanceMethod:"exact_name_rule";confidence:number;status:"candidate";normalizedName:string;left:RecordRow;right:RecordRow};
const root=process.cwd();
const allIndex=JSON.parse(fs.readFileSync(path.join(root,"public/rdl-search-index.json"),"utf8")) as RecordRow[];
const defaults:Record<string,string>={cfihos:"cfihos-2.0",ccus:"ccus-2.0-candidate","water-desalination":"water-desalination-2.0-candidate"};
const index=allIndex.filter(row=>row.releaseKey===defaults[row.sourceKey]);
const groups=new Map<string,RecordRow[]>();
for(const row of index){const n=row.name.trim().toLowerCase();if(!n)continue;const k=`${row.entityType}|${n}`;const a=groups.get(k)??[];a.push(row);groups.set(k,a);}
const mappings:Mapping[]=[];
for(const [key,rows] of groups){const [,normalizedName]=key.split("|",2); for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++) if(rows[i].sourceKey!==rows[j].sourceKey){
 const pair=[rows[i],rows[j]].sort((a,b)=>`${a.sourceKey}:${a.nativeIdentifier}`.localeCompare(`${b.sourceKey}:${b.nativeIdentifier}`));
 mappings.push({mappingType:"possible_match",provenanceMethod:"exact_name_rule",confidence:0.85,status:"candidate",normalizedName,left:pair[0],right:pair[1]});
}}
mappings.sort((a,b)=>`${a.normalizedName}:${a.left.sourceKey}:${a.right.sourceKey}`.localeCompare(`${b.normalizedName}:${b.left.sourceKey}:${b.right.sourceKey}`));
const sourceSummary=Object.fromEntries(["cfihos","ccus","water-desalination"].map(source=>[source,index.filter(x=>x.sourceKey===source).length]));
const byType:Record<string,Record<string,number>>={}; for(const row of index){byType[row.sourceKey]??={};byType[row.sourceKey][row.entityType]=(byType[row.sourceKey][row.entityType]??0)+1;}
const payload={generatedBy:"RDL-010",method:"exact-name candidate mapping",warning:"Exact-name matches are derived candidate possible matches, not authoritative equivalence.",sourceSummary,byType,mappings};
fs.writeFileSync(path.join(root,"public/rdl-cross-intelligence.json"),JSON.stringify(payload,null,2)+"\n");
console.log(`Generated ${mappings.length} cross-RDL candidate mappings.`);
