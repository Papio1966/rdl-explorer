import { loadRdlSearchIndex, type RdlSearchRecord } from "./search";

export type DeltaCount = { old:number; new:number; retained:number; added:number; removed:number };
export type SourceReleaseAudit = {
  auditSha256: string;
  continuity: Record<string, { entities: Record<string,DeltaCount>; relationships: Record<string,DeltaCount> }>;
};
export type EntityDelta = { kind:"added"|"retired"|"modified"; entityType:string; nativeIdentifier:string; fromName?:string; toName?:string };

export async function loadSourceReleaseAudit(): Promise<SourceReleaseAudit> {
  const response = await fetch("/rdl-release-deltas.json");
  if (!response.ok) throw new Error("Release delta audit unavailable");
  return response.json() as Promise<SourceReleaseAudit>;
}

export async function compareIndexedReleaseEntities(sourceKey:string, fromReleaseKey:string, toReleaseKey:string): Promise<EntityDelta[]> {
  const records = await loadRdlSearchIndex();
  const from = index(records.filter((record)=>record.sourceKey===sourceKey && record.releaseKey===fromReleaseKey));
  const to = index(records.filter((record)=>record.sourceKey===sourceKey && record.releaseKey===toReleaseKey));
  const keys = new Set([...from.keys(), ...to.keys()]);
  const deltas: EntityDelta[] = [];
  for (const key of keys) {
    const a=from.get(key), b=to.get(key);
    if (!a && b) deltas.push({kind:"added",entityType:b.entityType,nativeIdentifier:b.nativeIdentifier,toName:b.name});
    else if (a && !b) deltas.push({kind:"retired",entityType:a.entityType,nativeIdentifier:a.nativeIdentifier,fromName:a.name});
    else if (a && b && a.name !== b.name) deltas.push({kind:"modified",entityType:b.entityType,nativeIdentifier:b.nativeIdentifier,fromName:a.name,toName:b.name});
  }
  return deltas.sort((a,b)=>a.entityType.localeCompare(b.entityType)||a.nativeIdentifier.localeCompare(b.nativeIdentifier));
}
function index(records:RdlSearchRecord[]){return new Map(records.map((record)=>[`${record.entityType}|${record.nativeIdentifier}`,record]));}
