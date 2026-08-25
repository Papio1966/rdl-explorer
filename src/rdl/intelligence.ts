import type { RdlSearchRecord } from "./search";
export type CrossRdlMapping={mappingType:"equivalent"|"broader"|"narrower"|"related"|"possible_match"|"no_match";provenanceMethod:string;confidence:number;status:string;normalizedName:string;left:RdlSearchRecord;right:RdlSearchRecord};
export type CrossRdlIntelligenceProjection={generatedBy:string;method:string;warning:string;sourceSummary:Record<string,number>;byType:Record<string,Record<string,number>>;mappings:CrossRdlMapping[]};
let cache:Promise<CrossRdlIntelligenceProjection>|undefined;
export function loadCrossRdlIntelligence(){cache??=fetch("/rdl-cross-intelligence.json").then(r=>{if(!r.ok)throw new Error("Cross-RDL intelligence projection unavailable");return r.json()});return cache;}
export function mappingsForEntity(p:CrossRdlIntelligenceProjection,sourceKey:string,entityType:string,nativeIdentifier:string){return p.mappings.filter(m=>(m.left.sourceKey===sourceKey&&m.left.entityType===entityType&&m.left.nativeIdentifier===nativeIdentifier)||(m.right.sourceKey===sourceKey&&m.right.entityType===entityType&&m.right.nativeIdentifier===nativeIdentifier));}
