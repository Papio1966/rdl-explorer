import { createHash } from "node:crypto";
import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type DistributionLifecycle = "active" | "deprecated" | "superseded";
export type DistributedRelease = {
  releaseId:number; contextKey:string; contextType:string; contextName:string;
  releaseKey:string; releaseVersion:string; compositionSha256:string; publishedBy:string; publishedAt:string;
  lifecycleStatus:DistributionLifecycle; supersededByReleaseId?:number; compatibility:Record<string,unknown>; deprecationMessage?:string;
};
export type DistributedEntity = {
  entityType:string; nativeIdentifier:string; name:string; definition?:string;
  lifecycleStatus:string; sourcePackageId?:number; sourcePackageKey?:string;
  changeKind:"inherited"|"add"|"override"; sourceLayer?:string; sourceContextKey?:string; rationale?:string;
};

export class PublishedPackageDistributionRepository {
  constructor(private readonly client:SqlJsonClient) {}

  async catalogue(contextKey="",limit=100):Promise<DistributedRelease[]> {
    const safeLimit=Math.max(1,Math.min(limit,250));
    const where=contextKey?`WHERE context_key=${sqlLiteral(contextKey)}`:"";
    const rows=await this.client.query<any>(`SELECT * FROM rdl.distributed_effective_standard_release ${where} ORDER BY published_at DESC LIMIT ${safeLimit}`);
    return rows.map(mapRelease);
  }

  async release(releaseId:number){
    const rows=await this.client.query<any>(`SELECT r.*,d.lifecycle_status,d.superseded_by_release_id,d.compatibility,d.deprecation_message,c.context_key,c.context_type,c.name AS context_name
      FROM rdl.effective_standard_release r
      JOIN rdl.enterprise_context c ON c.context_id=r.context_id
      LEFT JOIN rdl.effective_standard_distribution d ON d.effective_standard_release_id=r.effective_standard_release_id
      WHERE r.effective_standard_release_id=${Number(releaseId)} LIMIT 1`);
    return rows[0];
  }

  async manifest(releaseId:number){
    const row=await this.release(releaseId); if(!row)return undefined;
    return {schemaVersion:"rdl-distribution-manifest/v1",release:mapRelease(row),packageManifest:row.package_manifest,integrity:{algorithm:"sha256",compositionSha256:row.composition_sha256}};
  }

  async entities(releaseId:number,entityType="",query=""):Promise<DistributedEntity[]> {
    const row=await this.release(releaseId); if(!row)return [];
    const manifest=row.package_manifest??{}; const payload=row.package_payload??{};
    const pins=Array.isArray(manifest.packagePins)?manifest.packagePins:[];
    const packageIds=pins.map((p:any)=>Number(p.packageId)).filter((id:number)=>Number.isSafeInteger(id)&&id>0);
    const packageKeyById=new Map<number,string>(pins.map((p:any)=>[Number(p.packageId),String(p.packageKey??"")]));
    const precedenceById=new Map<number,number>(pins.map((p:any)=>[Number(p.packageId),Number(p.precedence??0)]));
    let baseRows:any[]=[];
    if(packageIds.length){
      baseRows=await this.client.query<any>(`SELECT entity_id,package_id,entity_type_code,native_identifier,name,definition,lifecycle_status FROM rdl.rdl_entity WHERE package_id IN (${packageIds.join(",")}) ORDER BY package_id,entity_id`);
    }
    baseRows.sort((a,b)=>(precedenceById.get(Number(a.package_id))??0)-(precedenceById.get(Number(b.package_id))??0));
    const effective=new Map<string,DistributedEntity>();
    for(const e of baseRows){
      const key=`${e.entity_type_code}\u0000${e.native_identifier}`;
      effective.set(key,{entityType:e.entity_type_code,nativeIdentifier:e.native_identifier,name:e.name,definition:e.definition??undefined,lifecycleStatus:e.lifecycle_status,sourcePackageId:Number(e.package_id),sourcePackageKey:packageKeyById.get(Number(e.package_id)),changeKind:"inherited"});
    }
    const changes=Array.isArray(payload.changes)?payload.changes:[];
    for(const c of changes){
      const key=`${c.entityType}\u0000${c.nativeIdentifier}`;
      if(c.changeKind==="retire"){effective.delete(key);continue;}
      const prior=effective.get(key);
      effective.set(key,{entityType:String(c.entityType),nativeIdentifier:String(c.nativeIdentifier),name:String(c.effectiveName??prior?.name??c.nativeIdentifier),definition:prior?.definition,lifecycleStatus:"active",sourcePackageId:prior?.sourcePackageId,sourcePackageKey:prior?.sourcePackageKey,changeKind:c.changeKind==="add"?"add":"override",sourceLayer:c.sourceLayer,sourceContextKey:c.sourceContextKey,rationale:c.rationale});
    }
    const q=query.trim().toLowerCase();
    return [...effective.values()].filter(e=>(!entityType||e.entityType===entityType)&&(!q||e.nativeIdentifier.toLowerCase().includes(q)||e.name.toLowerCase().includes(q))).sort((a,b)=>a.entityType.localeCompare(b.entityType)||a.name.localeCompare(b.name));
  }

  async consumerPackage(releaseId:number){
    const row=await this.release(releaseId); if(!row)return undefined;
    const entities=await this.entities(releaseId);
    const release=mapRelease(row);
    const packageBody={schemaVersion:"rdl-distribution-package/v1",release,integrity:{algorithm:"sha256",compositionSha256:row.composition_sha256},manifest:row.package_manifest,effectiveEntities:entities};
    const distributionSha256=createHash("sha256").update(JSON.stringify(packageBody)).digest("hex");
    return {...packageBody,distributionSha256};
  }
}
function mapRelease(row:any):DistributedRelease{return {releaseId:Number(row.release_id??row.effective_standard_release_id),contextKey:row.context_key,contextType:row.context_type,contextName:row.context_name,releaseKey:row.release_key,releaseVersion:row.release_version,compositionSha256:row.composition_sha256,publishedBy:row.published_by,publishedAt:row.published_at,lifecycleStatus:(row.lifecycle_status??"active") as DistributionLifecycle,supersededByReleaseId:row.superseded_by_release_id==null?undefined:Number(row.superseded_by_release_id),compatibility:row.compatibility??{contract:"rdl-distribution/v1",minimumConsumerVersion:"1.0"},deprecationMessage:row.deprecation_message??undefined};}
