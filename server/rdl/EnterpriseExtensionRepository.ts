import { createHash } from "node:crypto";
import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type EnterpriseExtensionAction = "submit" | "approve" | "reject" | "retire";
export type EnterpriseExtensionStatus = "draft" | "candidate" | "in_review" | "approved" | "rejected" | "retired";

export type EnterpriseExtensionItem = {
  extensionChangeId: number;
  contextId: number;
  contextKey: string;
  contextType: "company" | "asset" | "project";
  contextName: string;
  changeKind: "add" | "override" | "retire";
  entityType: string;
  nativeIdentifier: string;
  baseEntityId?: number;
  proposedName?: string;
  proposedDefinition?: string;
  status: EnterpriseExtensionStatus;
  rationale: string;
  proposedBy?: string;
  proposedAt: string;
  reviewVersion: number;
  reviewedBy?: string;
  reviewRationale?: string;
};

export class EnterpriseExtensionRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async list(status = "in_review", contextKey = "", limit = 100): Promise<EnterpriseExtensionItem[]> {
    const safeLimit = Math.max(1, Math.min(limit, 1000));
    const filters = [status === "all" ? "TRUE" : `status=${sqlLiteral(status)}`];
    if (contextKey) filters.push(`context_key=${sqlLiteral(contextKey)}`);
    const rows = await this.client.query<any>(`
      SELECT * FROM rdl.context_extension_governance_queue
      WHERE ${filters.join(" AND ")}
      ORDER BY proposed_at DESC,extension_change_id DESC LIMIT ${safeLimit}`);
    return rows.map(mapItem);
  }

  async create(input: {
    contextKey: string;
    changeKind: "add" | "override" | "retire";
    entityType: string;
    nativeIdentifier: string;
    baseEntityId?: number;
    proposedName?: string;
    proposedDefinition?: string;
    rationale: string;
    proposedBy: string;
    provenance?: Record<string, unknown>;
  }): Promise<EnterpriseExtensionItem> {
    const contextRows = await this.client.query<any>(`SELECT context_id,status FROM rdl.enterprise_context WHERE context_key=${sqlLiteral(input.contextKey)} LIMIT 1`);
    const context = contextRows[0];
    if (!context) throw new Error("A valid enterprise context is required.");
    if (context.status === "retired") throw new Error("Extensions cannot be authored in a retired enterprise context.");
    const baseEntity = input.baseEntityId == null ? "NULL" : String(Number(input.baseEntityId));
    const rows = await this.client.query<any>(`
      INSERT INTO rdl.context_extension_change(
        context_id,change_kind,entity_type_code,native_identifier,base_entity_id,proposed_name,proposed_definition,status,rationale,provenance,proposed_by
      ) VALUES (
        ${Number(context.context_id)},${sqlLiteral(input.changeKind)},${sqlLiteral(input.entityType)},${sqlLiteral(input.nativeIdentifier)},${baseEntity},
        ${nullable(input.proposedName)},${nullable(input.proposedDefinition)},'draft',${sqlLiteral(input.rationale)},${sqlLiteral(JSON.stringify(input.provenance ?? {}))}::jsonb,${sqlLiteral(input.proposedBy)}
      ) RETURNING extension_change_id`);
    const id = Number(rows[0]?.extension_change_id);
    const created = await this.get(id);
    if (!created) throw new Error("Extension draft could not be reloaded.");
    return created;
  }

  async get(extensionChangeId: number): Promise<EnterpriseExtensionItem | undefined> {
    const rows = await this.client.query<any>(`SELECT * FROM rdl.context_extension_governance_queue WHERE extension_change_id=${Number(extensionChangeId)} LIMIT 1`);
    return rows[0] ? mapItem(rows[0]) : undefined;
  }

  async conflicts(extensionChangeId: number) {
    const item = await this.get(extensionChangeId);
    if (!item) throw new Error("A valid extensionChangeId is required.");
    return this.client.query<any>(`SELECT * FROM rdl.extension_conflicts(${item.contextId},${sqlLiteral(item.entityType)},${sqlLiteral(item.nativeIdentifier)},${item.extensionChangeId})`);
  }

  async preview(extensionChangeId: number) {
    const item = await this.get(extensionChangeId);
    if (!item) throw new Error("A valid extensionChangeId is required.");
    const conflicts = await this.conflicts(extensionChangeId);
    const inherited = item.baseEntityId ? (await this.client.query<any>(`
      SELECT e.entity_id,e.entity_type,e.native_identifier,e.name,e.definition,p.package_key
      FROM rdl.rdl_entity e JOIN rdl.rdl_package p ON p.package_id=e.package_id
      WHERE e.entity_id=${item.baseEntityId} LIMIT 1`))[0] : undefined;
    return {
      extension: item,
      inherited: inherited ? { entityId:Number(inherited.entity_id), entityType:inherited.entity_type, nativeIdentifier:inherited.native_identifier, name:inherited.name, definition:inherited.definition, packageKey:inherited.package_key } : undefined,
      effective: item.changeKind === "retire" ? { retired:true } : { retired:false, name:item.proposedName ?? inherited?.name, definition:item.proposedDefinition ?? inherited?.definition },
      conflicts: conflicts.map((row:any)=>({ extensionChangeId:Number(row.extension_change_id), contextKey:row.context_key, contextType:row.context_type, changeKind:row.change_kind, status:row.status, proposedName:row.proposed_name??undefined, rationale:row.rationale })),
      publishable: conflicts.length === 0 && item.status === "approved",
    };
  }

  async publish(contextKey:string, effectivePackageId:number, publishedBy:string) {
    const contexts=await this.client.query<any>(`SELECT context_id,status FROM rdl.enterprise_context WHERE context_key=${sqlLiteral(contextKey)} LIMIT 1`);
    const context=contexts[0];
    if(!context) throw new Error("A valid enterprise context is required.");
    const pending=await this.client.query<any>(`SELECT count(*)::integer AS count FROM rdl.context_extension_change WHERE context_id=${Number(context.context_id)} AND status IN ('draft','candidate','in_review')`);
    if(Number(pending[0]?.count??0)>0) throw new Error("Pending extension changes must be resolved before publication.");
    const pins=await this.client.query<any>(`SELECT layer_type,package_id,precedence FROM rdl.context_package_pin WHERE context_id=${Number(context.context_id)} ORDER BY precedence`);
    const extensions=await this.client.query<any>(`SELECT extension_change_id,change_kind,entity_type_code,native_identifier,status,review_version FROM rdl.context_extension_change WHERE context_id=${Number(context.context_id)} AND status IN ('approved','retired') ORDER BY extension_change_id`);
    const manifest={contextKey,contextId:Number(context.context_id),pins:pins.map((r:any)=>({layerType:r.layer_type,packageId:Number(r.package_id),precedence:Number(r.precedence)})),extensions:extensions.map((r:any)=>({extensionChangeId:Number(r.extension_change_id),changeKind:r.change_kind,entityType:r.entity_type_code,nativeIdentifier:r.native_identifier,status:r.status,reviewVersion:Number(r.review_version)}))};
    const serialized=JSON.stringify(manifest);
    const sha=createHash("sha256").update(serialized).digest("hex");
    const rows=await this.client.query<any>(`INSERT INTO rdl.effective_context_publication(context_id,effective_package_id,composition_sha256,composition_manifest,published_by) VALUES (${Number(context.context_id)},${Number(effectivePackageId)},${sqlLiteral(sha)},${sqlLiteral(serialized)}::jsonb,${sqlLiteral(publishedBy)}) RETURNING effective_context_publication_id,published_at`);
    return {publicationId:Number(rows[0].effective_context_publication_id),compositionSha256:sha,manifest,publishedAt:rows[0].published_at};
  }

  async promote(extensionChangeId:number,targetContextKey:string,proposedBy:string,rationale:string) {
    const source=await this.get(extensionChangeId);
    if(!source || source.status!=="approved") throw new Error("Only an approved extension can be promoted.");
    const targets=await this.client.query<any>(`SELECT context_id,context_type FROM rdl.enterprise_context WHERE context_key=${sqlLiteral(targetContextKey)} LIMIT 1`);
    const target=targets[0];
    if(!target) throw new Error("A valid target enterprise context is required.");
    const allowed=(source.contextType==='project'&&target.context_type==='asset')||(source.contextType==='asset'&&target.context_type==='company');
    if(!allowed) throw new Error("Extension promotion must move one level upward: Project to Asset or Asset to Company.");
    const created=await this.create({contextKey:targetContextKey,changeKind:source.changeKind,entityType:source.entityType,nativeIdentifier:source.nativeIdentifier,baseEntityId:source.baseEntityId,proposedName:source.proposedName,proposedDefinition:source.proposedDefinition,rationale,proposedBy,provenance:{promotedFromExtensionChangeId:source.extensionChangeId,promotedFromContextKey:source.contextKey}});
    return created;
  }

  async review(extensionChangeId:number, action:EnterpriseExtensionAction, reviewer:string, rationale:string, expectedVersion:number, evidence:Record<string,unknown>={}) {
    const rows = await this.client.query<any>(`SELECT * FROM rdl.review_context_extension(${Number(extensionChangeId)},${sqlLiteral(action)},${sqlLiteral(reviewer)},${sqlLiteral(rationale)},${sqlLiteral(JSON.stringify(evidence))}::jsonb,${Number(expectedVersion)})`);
    return rows[0];
  }
}

function nullable(value: string | undefined) { return value == null || value === "" ? "NULL" : sqlLiteral(value); }
function mapItem(row:any): EnterpriseExtensionItem {
  return {
    extensionChangeId:Number(row.extension_change_id),contextId:Number(row.context_id),contextKey:row.context_key,contextType:row.context_type,contextName:row.context_name,
    changeKind:row.change_kind,entityType:row.entity_type_code,nativeIdentifier:row.native_identifier,baseEntityId:row.base_entity_id==null?undefined:Number(row.base_entity_id),
    proposedName:row.proposed_name??undefined,proposedDefinition:row.proposed_definition??undefined,status:row.status,rationale:row.rationale,proposedBy:row.proposed_by??undefined,
    proposedAt:row.proposed_at,reviewVersion:Number(row.review_version),reviewedBy:row.reviewed_by??undefined,reviewRationale:row.review_rationale??undefined,
  };
}
