import type { RdlSearchRecord } from "./search";
export type ReviewQueueItem={queueKey:string;mappingType:string;provenanceMethod:string;confidence:number;status:string;normalizedName:string;left:RdlSearchRecord;right:RdlSearchRecord;reviewVersion:number;reviewedBy:string|null;reviewedAt:string|null;reviewRationale:string|null};
export type GovernanceProjection={generatedBy:string;warning:string;summary:Record<string,number>;items:ReviewQueueItem[]};
let cache:Promise<GovernanceProjection>|undefined;
export function loadGovernanceProjection(){cache??=fetch("/rdl-governance.json").then(r=>{if(!r.ok)throw new Error("Governance projection unavailable");return r.json()});return cache;}
