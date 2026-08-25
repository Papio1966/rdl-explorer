import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type RdlGlobalSearchHit = {
  sourceKey: string;
  sourceName: string;
  versionLabel: string;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string | null;
};

export class RdlGlobalSearchRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async search(query: string, sourceKey: string | null = null, limit = 80): Promise<RdlGlobalSearchHit[]> {
    const term = query.trim();
    if (!term) return [];
    const sourceFilter = sourceKey && sourceKey !== "all" ? `AND s.source_key = ${sqlLiteral(sourceKey)}` : "";
    const pattern = `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const rows = await this.client.query<any>(`
      SELECT s.source_key, s.name AS source_name, r.version_label, p.package_key,
             e.entity_type_code, e.native_identifier, e.name, e.definition
      FROM rdl.rdl_entity e
      JOIN rdl.rdl_package p ON p.package_id=e.package_id
      JOIN rdl.rdl_release r ON r.release_id=p.release_id
      JOIN rdl.rdl_source s ON s.source_id=r.source_id
      WHERE (e.native_identifier ILIKE ${sqlLiteral(pattern)} ESCAPE '\\'
         OR e.name ILIKE ${sqlLiteral(pattern)} ESCAPE '\\'
         OR COALESCE(e.definition,'') ILIKE ${sqlLiteral(pattern)} ESCAPE '\\')
        ${sourceFilter}
      ORDER BY CASE WHEN lower(e.native_identifier)=lower(${sqlLiteral(term)}) THEN 0 WHEN lower(e.name)=lower(${sqlLiteral(term)}) THEN 1 ELSE 2 END,
               e.name, s.source_key, e.entity_type_code, e.native_identifier
      LIMIT ${Math.max(1, Math.min(200, Math.floor(limit)))}
    `);
    return rows.map((row:any)=>({sourceKey:row.source_key,sourceName:row.source_name,versionLabel:row.version_label,packageKey:row.package_key,entityType:row.entity_type_code,nativeIdentifier:row.native_identifier,name:row.name,definition:row.definition}));
  }
}
