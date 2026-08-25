import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type CrossRdlMappingHit = {
  mappingId: number;
  mappingType: string;
  provenanceMethod: string;
  confidence: number;
  status: string;
  sourceKey: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
  sourceName: string;
  targetKey: string;
  targetEntityType: string;
  targetNativeIdentifier: string;
  targetName: string;
  evidence: Record<string, unknown>;
};

export class CrossRdlIntelligenceRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async getMappingsForEntity(sourceKey: string, entityType: string, nativeIdentifier: string): Promise<CrossRdlMappingHit[]> {
    const rows = await this.client.query<any>(`
      SELECT m.mapping_id, m.mapping_type, m.provenance_method, m.confidence, m.status, m.evidence,
             ss.source_key AS source_key, se.entity_type_code AS source_entity_type,
             se.native_identifier AS source_native_identifier, se.name AS source_name,
             ts.source_key AS target_key, te.entity_type_code AS target_entity_type,
             te.native_identifier AS target_native_identifier, te.name AS target_name
      FROM rdl.cross_rdl_mapping m
      JOIN rdl.rdl_entity se ON se.entity_id=m.source_entity_id
      JOIN rdl.rdl_package sp ON sp.package_id=se.package_id
      JOIN rdl.rdl_release sr ON sr.release_id=sp.release_id
      JOIN rdl.rdl_source ss ON ss.source_id=sr.source_id
      JOIN rdl.rdl_entity te ON te.entity_id=m.target_entity_id
      JOIN rdl.rdl_package tp ON tp.package_id=te.package_id
      JOIN rdl.rdl_release tr ON tr.release_id=tp.release_id
      JOIN rdl.rdl_source ts ON ts.source_id=tr.source_id
      WHERE (ss.source_key=${sqlLiteral(sourceKey)} AND se.entity_type_code=${sqlLiteral(entityType)} AND se.native_identifier=${sqlLiteral(nativeIdentifier)})
         OR (ts.source_key=${sqlLiteral(sourceKey)} AND te.entity_type_code=${sqlLiteral(entityType)} AND te.native_identifier=${sqlLiteral(nativeIdentifier)})
      ORDER BY m.confidence DESC, m.mapping_id
    `);
    return rows.map((row:any)=>({
      mappingId:Number(row.mapping_id),mappingType:row.mapping_type,provenanceMethod:row.provenance_method,
      confidence:Number(row.confidence),status:row.status,sourceKey:row.source_key,sourceEntityType:row.source_entity_type,
      sourceNativeIdentifier:row.source_native_identifier,sourceName:row.source_name,targetKey:row.target_key,
      targetEntityType:row.target_entity_type,targetNativeIdentifier:row.target_native_identifier,targetName:row.target_name,
      evidence:row.evidence ?? {},
    }));
  }

  async summarize(): Promise<Array<{sourceKey:string;targetKey:string;mappingType:string;count:number}>> {
    const rows = await this.client.query<any>(`
      SELECT LEAST(ss.source_key,ts.source_key) AS source_key,
             GREATEST(ss.source_key,ts.source_key) AS target_key,
             m.mapping_type, count(*)::int AS mapping_count
      FROM rdl.cross_rdl_mapping m
      JOIN rdl.rdl_entity se ON se.entity_id=m.source_entity_id
      JOIN rdl.rdl_package sp ON sp.package_id=se.package_id
      JOIN rdl.rdl_release sr ON sr.release_id=sp.release_id
      JOIN rdl.rdl_source ss ON ss.source_id=sr.source_id
      JOIN rdl.rdl_entity te ON te.entity_id=m.target_entity_id
      JOIN rdl.rdl_package tp ON tp.package_id=te.package_id
      JOIN rdl.rdl_release tr ON tr.release_id=tp.release_id
      JOIN rdl.rdl_source ts ON ts.source_id=tr.source_id
      GROUP BY 1,2,3 ORDER BY 1,2,3
    `);
    return rows.map((row:any)=>({sourceKey:row.source_key,targetKey:row.target_key,mappingType:row.mapping_type,count:Number(row.mapping_count)}));
  }
}
