import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type MappingReviewAction = "approve" | "reject" | "supersede";

export type MappingReviewQueueItem = {
  mappingId: number;
  status: string;
  reviewVersion: number;
  mappingType: string;
  provenanceMethod: string;
  confidence: number;
  sourceKey: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  sourceName: string;
  targetKey: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  targetName: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRationale?: string;
};

export type MappingReviewEvent = {
  reviewEventId: number;
  mappingId: number;
  action: MappingReviewAction;
  fromStatus: string;
  toStatus: string;
  reviewer: string;
  rationale: string;
  evidence: Record<string, unknown>;
  reviewVersion: number;
  occurredAt: string;
};

export class CrossRdlGovernanceRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async listReviewQueue(status = "candidate", limit = 100): Promise<MappingReviewQueueItem[]> {
    const safeLimit = Math.max(1, Math.min(limit, 5000));
    const rows = await this.client.query<any>(`
      SELECT m.mapping_id,m.status,m.review_version,m.mapping_type,m.provenance_method,m.confidence,
             ss.source_key,se.entity_type AS source_entity_type,se.native_identifier AS source_native_identifier,se.name AS source_name,
             ts.source_key AS target_key,te.entity_type AS target_entity_type,te.native_identifier AS target_native_identifier,te.name AS target_name,
             m.reviewed_by,m.reviewed_at,m.review_rationale
      FROM rdl.cross_rdl_mapping m
      JOIN rdl.rdl_entity se ON se.entity_id=m.source_entity_id
      JOIN rdl.rdl_package sp ON sp.package_id=se.package_id JOIN rdl.rdl_release sr ON sr.release_id=sp.release_id JOIN rdl.rdl_source ss ON ss.source_id=sr.source_id
      JOIN rdl.rdl_entity te ON te.entity_id=m.target_entity_id
      JOIN rdl.rdl_package tp ON tp.package_id=te.package_id JOIN rdl.rdl_release tr ON tr.release_id=tp.release_id JOIN rdl.rdl_source ts ON ts.source_id=tr.source_id
      WHERE m.status=${sqlLiteral(status)} ORDER BY m.confidence DESC,m.mapping_id LIMIT ${safeLimit}
    `);
    return rows.map((row:any)=>({
      mappingId:Number(row.mapping_id),status:row.status,reviewVersion:Number(row.review_version),mappingType:row.mapping_type,
      provenanceMethod:row.provenance_method,confidence:Number(row.confidence),sourceKey:row.source_key,
      sourceEntityType:row.source_entity_type,sourceNativeIdentifier:row.source_native_identifier,sourceName:row.source_name,
      targetKey:row.target_key,targetEntityType:row.target_entity_type,targetNativeIdentifier:row.target_native_identifier,targetName:row.target_name,
      reviewedBy:row.reviewed_by??undefined,reviewedAt:row.reviewed_at??undefined,reviewRationale:row.review_rationale??undefined,
    }));
  }

  async getHistory(mappingId: number): Promise<MappingReviewEvent[]> {
    const rows = await this.client.query<any>(`SELECT review_event_id,mapping_id,action,from_status,to_status,reviewer,rationale,evidence,review_version,occurred_at FROM rdl.cross_rdl_mapping_review_event WHERE mapping_id=${Number(mappingId)} ORDER BY review_event_id`);
    return rows.map((row:any)=>({reviewEventId:Number(row.review_event_id),mappingId:Number(row.mapping_id),action:row.action,fromStatus:row.from_status,toStatus:row.to_status,
      reviewer:row.reviewer,rationale:row.rationale,evidence:row.evidence??{},reviewVersion:Number(row.review_version),occurredAt:row.occurred_at}));
  }

  async review(mappingId:number, action:MappingReviewAction, reviewer:string, rationale:string, expectedVersion:number, evidence:Record<string,unknown>={}, successorMappingId?:number) {
    const evidenceLiteral=sqlLiteral(JSON.stringify(evidence));
    const successor=successorMappingId==null?'NULL':String(Number(successorMappingId));
    const rows=await this.client.query<any>(`SELECT * FROM rdl.review_cross_rdl_mapping(${Number(mappingId)},${sqlLiteral(action)},${sqlLiteral(reviewer)},${sqlLiteral(rationale)},${evidenceLiteral}::jsonb,${Number(expectedVersion)},${successor})`);
    return rows[0];
  }
}
