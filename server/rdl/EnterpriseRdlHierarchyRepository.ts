import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type EnterpriseContextSummary = {
  contextId: number;
  contextKey: string;
  contextType: "company" | "asset" | "project";
  name: string;
  status: "draft" | "active" | "retired";
  parentContextKey?: string;
  packagePinCount: number;
  approvedExtensionCount: number;
};

export type EnterpriseComposition = {
  context: EnterpriseContextSummary;
  lineage: Array<{ depth: number; contextKey: string; contextType: string; name: string; status: string }>;
  packagePins: Array<{ contextKey: string; layerType: string; precedence: number; packageKey: string; packageStatus: string }>;
  extensions: Array<{ contextKey: string; changeKind: string; entityType: string; nativeIdentifier: string; name?: string; status: string; rationale: string }>;
};

export class EnterpriseRdlHierarchyRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async listContexts(): Promise<EnterpriseContextSummary[]> {
    const rows = await this.client.query<any>(`SELECT * FROM rdl.enterprise_context_summary ORDER BY context_type,context_key`);
    return rows.map(mapSummary);
  }

  async getComposition(contextKey: string): Promise<EnterpriseComposition | undefined> {
    const contextRows = await this.client.query<any>(`SELECT * FROM rdl.enterprise_context_summary WHERE context_key=${sqlLiteral(contextKey)} LIMIT 1`);
    if (!contextRows[0]) return undefined;
    const context = mapSummary(contextRows[0]);
    const lineage = await this.client.query<any>(`SELECT * FROM rdl.context_lineage(${context.contextId})`);
    const pins = await this.client.query<any>(`
      SELECT c.context_key,pin.layer_type,pin.precedence,p.package_key,p.package_status
      FROM rdl.context_lineage(${context.contextId}) l
      JOIN rdl.enterprise_context c ON c.context_id=l.context_id
      JOIN rdl.context_package_pin pin ON pin.context_id=c.context_id
      JOIN rdl.rdl_package p ON p.package_id=pin.package_id
      ORDER BY pin.precedence,c.context_type`);
    const extensions = await this.client.query<any>(`
      SELECT c.context_key,ch.change_kind,ch.entity_type_code,ch.native_identifier,ch.proposed_name,ch.status,ch.rationale
      FROM rdl.context_lineage(${context.contextId}) l
      JOIN rdl.enterprise_context c ON c.context_id=l.context_id
      JOIN rdl.context_extension_change ch ON ch.context_id=c.context_id
      WHERE ch.status='approved'
      ORDER BY l.depth DESC,ch.extension_change_id`);
    return {
      context,
      lineage: lineage.map((r:any)=>({depth:Number(r.depth),contextKey:r.context_key,contextType:r.context_type,name:r.name,status:r.status})),
      packagePins: pins.map((r:any)=>({contextKey:r.context_key,layerType:r.layer_type,precedence:Number(r.precedence),packageKey:r.package_key,packageStatus:r.package_status})),
      extensions: extensions.map((r:any)=>({contextKey:r.context_key,changeKind:r.change_kind,entityType:r.entity_type_code,nativeIdentifier:r.native_identifier,name:r.proposed_name??undefined,status:r.status,rationale:r.rationale})),
    };
  }
}

function mapSummary(row:any): EnterpriseContextSummary {
  return {contextId:Number(row.context_id),contextKey:row.context_key,contextType:row.context_type,name:row.name,status:row.status,parentContextKey:row.parent_context_key??undefined,packagePinCount:Number(row.package_pin_count),approvedExtensionCount:Number(row.approved_extension_count)};
}
