import { createHash } from "node:crypto";
import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type EffectiveStandardChangeKind = "inherited" | "add" | "override" | "retire";
export type EffectiveStandardComparisonItem = {
  sourceLayer: "industry" | "company" | "asset" | "project";
  sourceContextKey?: string;
  changeKind: EffectiveStandardChangeKind;
  entityType: string;
  nativeIdentifier: string;
  inheritedName?: string;
  effectiveName?: string;
  baseEntityId?: number;
  extensionChangeId?: number;
  rationale?: string;
};
export type EffectiveStandardComparison = {
  contextId: number;
  contextKey: string;
  contextType: "company" | "asset" | "project";
  contextName: string;
  lineage: Array<{depth:number;contextKey:string;contextType:string;name:string;status:string}>;
  packagePins: Array<{contextKey:string;layerType:string;packageId:number;packageKey:string;precedence:number}>;
  items: EffectiveStandardComparisonItem[];
  summary: {inherited:number;added:number;overridden:number;retired:number;totalChanges:number};
  pendingCount: number;
  publishable: boolean;
};
export type EffectiveStandardRelease = {
  releaseId:number;
  contextKey:string;
  releaseKey:string;
  releaseVersion:string;
  compositionSha256:string;
  publishedBy:string;
  publishedAt:string;
  comparisonSummary:EffectiveStandardComparison["summary"];
  packageManifest:Record<string,unknown>;
  packagePayload:Record<string,unknown>;
};

export class EffectiveStandardPublicationRepository {
  constructor(private readonly client:SqlJsonClient) {}

  async compare(contextKey:string):Promise<EffectiveStandardComparison> {
    const contexts=await this.client.query<any>(`SELECT context_id,context_key,context_type,name,status FROM rdl.enterprise_context WHERE context_key=${sqlLiteral(contextKey)} LIMIT 1`);
    const context=contexts[0];
    if(!context) throw new Error("A valid enterprise context is required.");
    const contextId=Number(context.context_id);
    const lineageRows=await this.client.query<any>(`SELECT * FROM rdl.context_lineage(${contextId}) ORDER BY depth DESC`);
    const lineageIds=lineageRows.map((r:any)=>Number(r.context_id));
    const lineageFilter=lineageIds.length?lineageIds.join(","):String(contextId);
    const pinRows=await this.client.query<any>(`
      SELECT c.context_key,pin.layer_type,pin.package_id,p.package_key,pin.precedence
      FROM rdl.context_package_pin pin
      JOIN rdl.enterprise_context c ON c.context_id=pin.context_id
      JOIN rdl.rdl_package p ON p.package_id=pin.package_id
      WHERE pin.context_id IN (${lineageFilter})
      ORDER BY pin.precedence,c.context_id`);
    const extensionRows=await this.client.query<any>(`
      SELECT ch.extension_change_id,ch.context_id,c.context_key,c.context_type,ch.change_kind,ch.entity_type_code,ch.native_identifier,
             ch.base_entity_id,ch.proposed_name,ch.proposed_definition,ch.rationale,ch.status,
             e.name AS inherited_name,e.definition AS inherited_definition
      FROM rdl.context_extension_change ch
      JOIN rdl.enterprise_context c ON c.context_id=ch.context_id
      LEFT JOIN rdl.rdl_entity e ON e.entity_id=ch.base_entity_id
      WHERE ch.context_id IN (${lineageFilter}) AND ch.status IN ('approved','retired')
      ORDER BY ch.extension_change_id`);
    const pendingRows=await this.client.query<any>(`
      SELECT count(*)::integer AS count FROM rdl.context_extension_change
      WHERE context_id IN (${lineageFilter}) AND status IN ('draft','candidate','in_review')`);

    const items:EffectiveStandardComparisonItem[]=extensionRows.map((r:any)=>({
      sourceLayer:r.context_type,
      sourceContextKey:r.context_key,
      changeKind:r.change_kind,
      entityType:r.entity_type_code,
      nativeIdentifier:r.native_identifier,
      inheritedName:r.inherited_name??undefined,
      effectiveName:r.change_kind==='retire'?undefined:(r.proposed_name??r.inherited_name??undefined),
      baseEntityId:r.base_entity_id==null?undefined:Number(r.base_entity_id),
      extensionChangeId:Number(r.extension_change_id),
      rationale:r.rationale,
    }));
    const summary={
      inherited:pinRows.length,
      added:items.filter(i=>i.changeKind==='add').length,
      overridden:items.filter(i=>i.changeKind==='override').length,
      retired:items.filter(i=>i.changeKind==='retire').length,
      totalChanges:items.length,
    };
    const pendingCount=Number(pendingRows[0]?.count??0);
    return {
      contextId,contextKey:context.context_key,contextType:context.context_type,contextName:context.name,
      lineage:lineageRows.map((r:any)=>({depth:Number(r.depth),contextKey:r.context_key,contextType:r.context_type,name:r.name,status:r.status})),
      packagePins:pinRows.map((r:any)=>({contextKey:r.context_key,layerType:r.layer_type,packageId:Number(r.package_id),packageKey:r.package_key,precedence:Number(r.precedence)})),
      items,summary,pendingCount,publishable:pendingCount===0,
    };
  }

  async publish(contextKey:string,releaseKey:string,releaseVersion:string,publishedBy:string):Promise<EffectiveStandardRelease> {
    const comparison=await this.compare(contextKey);
    if(!comparison.publishable) throw new Error("Pending extension changes must be resolved before publication.");
    const manifest={
      schemaVersion:"rdl-effective-standard-package/v1",
      context:{key:comparison.contextKey,type:comparison.contextType,name:comparison.contextName},
      release:{key:releaseKey,version:releaseVersion},
      lineage:comparison.lineage,
      packagePins:comparison.packagePins,
      extensionChanges:comparison.items.map(i=>({extensionChangeId:i.extensionChangeId,sourceLayer:i.sourceLayer,sourceContextKey:i.sourceContextKey,changeKind:i.changeKind,entityType:i.entityType,nativeIdentifier:i.nativeIdentifier})),
    };
    const payload={
      schemaVersion:"rdl-effective-standard-package/v1",
      release:{key:releaseKey,version:releaseVersion},
      context:{key:comparison.contextKey,type:comparison.contextType,name:comparison.contextName},
      provenance:{lineage:comparison.lineage,packagePins:comparison.packagePins},
      changes:comparison.items,
      summary:comparison.summary,
    };
    const canonical=JSON.stringify({manifest,payload});
    const sha=createHash("sha256").update(canonical).digest("hex");
    const rows=await this.client.query<any>(`
      INSERT INTO rdl.effective_standard_release(
        context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by
      ) VALUES (
        ${comparison.contextId},${sqlLiteral(releaseKey)},${sqlLiteral(releaseVersion)},${sqlLiteral(sha)},
        ${sqlLiteral(JSON.stringify(comparison.summary))}::jsonb,${sqlLiteral(JSON.stringify(manifest))}::jsonb,
        ${sqlLiteral(JSON.stringify(payload))}::jsonb,${sqlLiteral(publishedBy)}
      ) RETURNING effective_standard_release_id,published_at`);
    return {releaseId:Number(rows[0].effective_standard_release_id),contextKey,releaseKey,releaseVersion,compositionSha256:sha,publishedBy,publishedAt:rows[0].published_at,comparisonSummary:comparison.summary,packageManifest:manifest,packagePayload:payload};
  }

  async list(contextKey="",limit=50):Promise<EffectiveStandardRelease[]> {
    const safeLimit=Math.max(1,Math.min(limit,200));
    const filter=contextKey?`WHERE context_key=${sqlLiteral(contextKey)}`:"";
    const rows=await this.client.query<any>(`
      SELECT s.*,r.package_manifest,r.package_payload FROM rdl.effective_standard_release_summary s
      JOIN rdl.effective_standard_release r USING(effective_standard_release_id)
      ${filter} ORDER BY published_at DESC LIMIT ${safeLimit}`);
    return rows.map(mapRelease);
  }

  async get(releaseId:number):Promise<EffectiveStandardRelease|undefined> {
    const rows=await this.client.query<any>(`
      SELECT s.*,r.package_manifest,r.package_payload FROM rdl.effective_standard_release_summary s
      JOIN rdl.effective_standard_release r USING(effective_standard_release_id)
      WHERE effective_standard_release_id=${Number(releaseId)} LIMIT 1`);
    return rows[0]?mapRelease(rows[0]):undefined;
  }
}

function mapRelease(row:any):EffectiveStandardRelease {
  return {releaseId:Number(row.effective_standard_release_id),contextKey:row.context_key,releaseKey:row.release_key,releaseVersion:row.release_version,compositionSha256:row.composition_sha256,publishedBy:row.published_by,publishedAt:row.published_at,comparisonSummary:row.comparison_summary,packageManifest:row.package_manifest,packagePayload:row.package_payload};
}
