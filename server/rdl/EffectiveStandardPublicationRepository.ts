import { createHash } from "node:crypto";
import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type EffectiveStandardChangeKind = "inherited" | "add" | "override" | "retire";

export type EffectiveStandardDerivationContributor = {
  contributionRole: "primary" | "contributor" | "reference";
  sourceKey: string;
  sourceId: number;
  releaseKey: string;
  releaseId: number;
  packageKey: string;
  packageId: number;
  entityId: number;
  entityType: string;
  nativeIdentifier: string;
  sourceSnapshot: Record<string, unknown>;
};

export type EffectiveStandardComponentDecision = {
  componentKind: string;
  componentKey: string;
  resolution: string;
  selectedSourceEntityId?: number;
  resolvedPayload?: Record<string, unknown>;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
};

export type EffectiveStandardDerivation = {
  schemaVersion: "rdl-entity-derivation/v1";
  compositionId: number;
  targetExtensionChangeId: number;
  compositionKind: "multi_source_merge" | "derived_copy" | "promotion";
  rationale: string;
  createdBy: string;
  createdAt: string;
  contributors: EffectiveStandardDerivationContributor[];
  componentDecisions: EffectiveStandardComponentDecision[];
  boundary: {
    exactSourceIdentityRetained: true;
    sameNameAutomaticEquivalence: false;
  };
};

export type EffectiveStandardRelationship = {
  relationshipId: number;
  sourcePackageId: number;
  sourcePackageKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  relationshipStatus: string;
  attributes: Record<string, unknown>;
  sourceLocator: Record<string, unknown>;
};

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
  derivation?: EffectiveStandardDerivation;
};

export type EffectiveStandardComparison = {
  contextId: number;
  contextKey: string;
  contextType: "company" | "asset" | "project";
  contextName: string;
  lineage: Array<{depth:number;contextKey:string;contextType:string;name:string;status:string}>;
  packagePins: Array<{contextKey:string;layerType:string;packageId:number;packageKey:string;precedence:number}>;
  items: EffectiveStandardComparisonItem[];
  derivations: EffectiveStandardDerivation[];
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

  private async loadDerivations(extensionChangeIds:number[]):Promise<EffectiveStandardDerivation[]> {
    if(extensionChangeIds.length===0) return [];
    const ids=extensionChangeIds.filter(Number.isSafeInteger).join(",");
    if(!ids) return [];

    const compositionRows=await this.client.query<any>(`
      SELECT c.composition_id,c.target_extension_change_id,c.composition_kind,c.rationale,c.created_by,c.created_at
      FROM rdl.entity_composition c
      WHERE c.target_extension_change_id IN (${ids})
      ORDER BY c.composition_id`);
    if(compositionRows.length===0) return [];

    const compositionIds=compositionRows.map((r:any)=>Number(r.composition_id)).join(",");
    const contributorRows=await this.client.query<any>(`
      SELECT cc.composition_id,cc.contribution_role,cc.source_snapshot,
             src.source_id,src.source_key,rel.release_id,rel.release_key,
             p.package_id,p.package_key,e.entity_id,e.entity_type_code,e.native_identifier
      FROM rdl.entity_composition_contributor cc
      JOIN rdl.rdl_entity e ON e.entity_id=cc.source_entity_id
      JOIN rdl.rdl_package p ON p.package_id=cc.source_package_id
      JOIN rdl.rdl_release rel ON rel.release_id=p.release_id
      JOIN rdl.rdl_source src ON src.source_id=rel.source_id
      WHERE cc.composition_id IN (${compositionIds})
      ORDER BY cc.composition_id,cc.composition_contributor_id`);
    const decisionRows=await this.client.query<any>(`
      SELECT composition_id,component_kind,component_key,resolution,selected_source_entity_id,resolved_payload,
             rationale,decided_by,decided_at
      FROM rdl.entity_composition_component_decision
      WHERE composition_id IN (${compositionIds})
      ORDER BY composition_id,composition_component_decision_id`);

    return compositionRows.map((row:any)=>{
      const compositionId=Number(row.composition_id);
      const contributors:EffectiveStandardDerivationContributor[]=contributorRows
        .filter((c:any)=>Number(c.composition_id)===compositionId)
        .map((c:any)=>({
          contributionRole:c.contribution_role,
          sourceKey:c.source_key,
          sourceId:Number(c.source_id),
          releaseKey:c.release_key,
          releaseId:Number(c.release_id),
          packageKey:c.package_key,
          packageId:Number(c.package_id),
          entityId:Number(c.entity_id),
          entityType:c.entity_type_code,
          nativeIdentifier:c.native_identifier,
          sourceSnapshot:(c.source_snapshot??{}) as Record<string,unknown>,
        }));
      const componentDecisions:EffectiveStandardComponentDecision[]=decisionRows
        .filter((d:any)=>Number(d.composition_id)===compositionId)
        .map((d:any)=>({
          componentKind:d.component_kind,
          componentKey:d.component_key,
          resolution:d.resolution,
          selectedSourceEntityId:d.selected_source_entity_id==null?undefined:Number(d.selected_source_entity_id),
          resolvedPayload:d.resolved_payload??undefined,
          rationale:d.rationale,
          decidedBy:d.decided_by,
          decidedAt:d.decided_at,
        }));
      return {
        schemaVersion:"rdl-entity-derivation/v1" as const,
        compositionId,
        targetExtensionChangeId:Number(row.target_extension_change_id),
        compositionKind:row.composition_kind,
        rationale:row.rationale,
        createdBy:row.created_by,
        createdAt:row.created_at,
        contributors,
        componentDecisions,
        boundary:{exactSourceIdentityRetained:true as const,sameNameAutomaticEquivalence:false as const},
      };
    });
  }

  private async snapshotRelationships(packagePins:EffectiveStandardComparison["packagePins"], items:EffectiveStandardComparisonItem[]):Promise<EffectiveStandardRelationship[]> {
    const packageIds=[...new Set(packagePins.map((pin)=>pin.packageId).filter((id)=>Number.isSafeInteger(id)&&id>0))];
    if(packageIds.length===0) return [];
    const rows=await this.client.query<any>(`
      SELECT rel.relationship_id,rel.package_id,p.package_key,rel.relationship_type_code,
             rel.relationship_status,rel.attributes,rel.source_locator,
             source.entity_type_code AS source_entity_type,source.native_identifier AS source_native_identifier,
             target.entity_type_code AS target_entity_type,target.native_identifier AS target_native_identifier
      FROM rdl.rdl_relationship rel
      JOIN rdl.rdl_package p ON p.package_id=rel.package_id
      JOIN rdl.rdl_entity source ON source.entity_id=rel.source_entity_id
      JOIN rdl.rdl_entity target ON target.entity_id=rel.target_entity_id
      WHERE rel.package_id IN (${packageIds.join(",")})
        AND rel.is_authoritative IS TRUE
      ORDER BY rel.package_id,rel.relationship_id`);
    const retired=new Set(items.filter((item)=>item.changeKind==="retire").map((item)=>`${item.entityType}\u0000${item.nativeIdentifier}`));
    return rows
      .filter((row:any)=>!retired.has(`${row.source_entity_type}\u0000${row.source_native_identifier}`) && !retired.has(`${row.target_entity_type}\u0000${row.target_native_identifier}`))
      .map((row:any)=>({
        relationshipId:Number(row.relationship_id),
        sourcePackageId:Number(row.package_id),
        sourcePackageKey:row.package_key,
        relationshipType:row.relationship_type_code,
        sourceEntityType:row.source_entity_type,
        sourceNativeIdentifier:row.source_native_identifier,
        targetEntityType:row.target_entity_type,
        targetNativeIdentifier:row.target_native_identifier,
        relationshipStatus:row.relationship_status,
        attributes:(row.attributes??{}) as Record<string,unknown>,
        sourceLocator:(row.source_locator??{}) as Record<string,unknown>,
      }));
  }

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
      ORDER BY pin.precedence,c.context_id,pin.context_package_pin_id`);
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

    const extensionIds=extensionRows.map((r:any)=>Number(r.extension_change_id)).filter(Number.isSafeInteger);
    const derivations=await this.loadDerivations(extensionIds);
    const derivationByExtensionId=new Map(derivations.map((d)=>[d.targetExtensionChangeId,d]));

    const items:EffectiveStandardComparisonItem[]=extensionRows.map((r:any)=>{
      const extensionChangeId=Number(r.extension_change_id);
      const derivation=derivationByExtensionId.get(extensionChangeId);
      return {
        sourceLayer:r.context_type,
        sourceContextKey:r.context_key,
        changeKind:r.change_kind,
        entityType:r.entity_type_code,
        nativeIdentifier:r.native_identifier,
        inheritedName:r.inherited_name??undefined,
        effectiveName:r.change_kind==='retire'?undefined:(r.proposed_name??r.inherited_name??undefined),
        baseEntityId:r.base_entity_id==null?undefined:Number(r.base_entity_id),
        extensionChangeId,
        rationale:r.rationale,
        ...(derivation?{derivation}:{}),
      };
    });
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
      items,derivations,summary,pendingCount,publishable:pendingCount===0,
    };
  }

  async publish(contextKey:string,releaseKey:string,releaseVersion:string,publishedBy:string):Promise<EffectiveStandardRelease> {
    const comparison=await this.compare(contextKey);
    if(!comparison.publishable) throw new Error("Pending extension changes must be resolved before publication.");
    const effectiveRelationships=await this.snapshotRelationships(comparison.packagePins,comparison.items);
    const manifest={
      schemaVersion:"rdl-effective-standard-package/v1",
      context:{key:comparison.contextKey,type:comparison.contextType,name:comparison.contextName},
      release:{key:releaseKey,version:releaseVersion},
      lineage:comparison.lineage,
      packagePins:comparison.packagePins,
      extensionChanges:comparison.items.map(i=>({extensionChangeId:i.extensionChangeId,sourceLayer:i.sourceLayer,sourceContextKey:i.sourceContextKey,changeKind:i.changeKind,entityType:i.entityType,nativeIdentifier:i.nativeIdentifier})),
      derivations:comparison.derivations,
      relationshipClosure:{schemaVersion:"rdl-effective-relationships/v1",count:effectiveRelationships.length},
    };
    const payload={
      schemaVersion:"rdl-effective-standard-package/v1",
      release:{key:releaseKey,version:releaseVersion},
      context:{key:comparison.contextKey,type:comparison.contextType,name:comparison.contextName},
      provenance:{lineage:comparison.lineage,packagePins:comparison.packagePins,derivations:comparison.derivations},
      changes:comparison.items,
      effectiveRelationships,
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
