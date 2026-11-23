import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type CompanyMergeContributor = {
  entityId:number;
  sourceKey:string;
  releaseKey:string;
  packageId:number;
  packageKey:string;
  entityType:string;
  nativeIdentifier:string;
  name:string;
  definition?:string;
  pinned:boolean;
};

export type CompanyMergePreview = {
  schemaVersion:"rdl-company-merge-preview/v1";
  contextKey:string;
  contextStatus:string;
  mappingId:number;
  mappingType:string;
  mappingStatus:string;
  confidence:number;
  decisionType?:string;
  left:CompanyMergeContributor;
  right:CompanyMergeContributor;
  boundaries:{
    sourceEntitiesImmutable:true;
    sameNameDoesNotImplyEquivalence:true;
    exactContributorIdentityFromMapping:true;
    bothPackagesMustBePinned:true;
    extensionGovernanceRequiredAfterMerge:true;
  };
};

export class CompanyMergeWorkbenchRepository {
  constructor(private readonly client:SqlJsonClient) {}

  async preview(contextKey:string,mappingId:number):Promise<CompanyMergePreview> {
    const contexts=await this.client.query<any>(`
      SELECT context_id,context_key,status
      FROM rdl.enterprise_context
      WHERE context_key=${sqlLiteral(contextKey)}
        AND context_type='company'
      LIMIT 1
    `);

    const context=contexts[0];

    if(!context)
      throw new Error("A valid Company context is required.");

    const rows=await this.client.query<any>(`
      SELECT
        m.mapping_id,
        m.mapping_type,
        m.status AS mapping_status,
        m.confidence,

        se.entity_id AS left_entity_id,
        ss.source_key AS left_source_key,
        sr.release_key AS left_release_key,
        sp.package_id AS left_package_id,
        sp.package_key AS left_package_key,
        se.entity_type_code AS left_entity_type,
        se.native_identifier AS left_native_identifier,
        se.name AS left_name,
        se.definition AS left_definition,

        te.entity_id AS right_entity_id,
        ts.source_key AS right_source_key,
        tr.release_key AS right_release_key,
        tp.package_id AS right_package_id,
        tp.package_key AS right_package_key,
        te.entity_type_code AS right_entity_type,
        te.native_identifier AS right_native_identifier,
        te.name AS right_name,
        te.definition AS right_definition

      FROM rdl.cross_rdl_mapping m

      JOIN rdl.rdl_entity se
        ON se.entity_id=m.source_entity_id
      JOIN rdl.rdl_package sp
        ON sp.package_id=se.package_id
      JOIN rdl.rdl_release sr
        ON sr.release_id=sp.release_id
      JOIN rdl.rdl_source ss
        ON ss.source_id=sr.source_id

      JOIN rdl.rdl_entity te
        ON te.entity_id=m.target_entity_id
      JOIN rdl.rdl_package tp
        ON tp.package_id=te.package_id
      JOIN rdl.rdl_release tr
        ON tr.release_id=tp.release_id
      JOIN rdl.rdl_source ts
        ON ts.source_id=tr.source_id

      WHERE m.mapping_id=${Number(mappingId)}
      LIMIT 1
    `);

    const row=rows[0];

    if(!row)
      throw new Error("A valid cross-RDL mapping is required.");

    const pins=await this.client.query<any>(`
      SELECT package_id
      FROM rdl.context_package_pin
      WHERE context_id=${Number(context.context_id)}
    `);

    const pinned=new Set(
      pins.map((item:any)=>Number(item.package_id))
    );

    const decisionRows=await this.client.query<any>(`
      SELECT decision_type
      FROM rdl.company_adoption_collision_decision
      WHERE context_id=${Number(context.context_id)}
        AND mapping_id=${Number(mappingId)}
      ORDER BY decided_at DESC,collision_decision_id DESC
      LIMIT 1
    `);

    const decision=decisionRows[0];

    return {
      schemaVersion:"rdl-company-merge-preview/v1",

      contextKey:context.context_key,
      contextStatus:context.status,

      mappingId:Number(row.mapping_id),
      mappingType:row.mapping_type,
      mappingStatus:row.mapping_status,
      confidence:Number(row.confidence),

      decisionType:decision?.decision_type??undefined,

      left:{
        entityId:Number(row.left_entity_id),
        sourceKey:row.left_source_key,
        releaseKey:row.left_release_key,
        packageId:Number(row.left_package_id),
        packageKey:row.left_package_key,
        entityType:row.left_entity_type,
        nativeIdentifier:row.left_native_identifier,
        name:row.left_name,
        definition:row.left_definition??undefined,
        pinned:pinned.has(Number(row.left_package_id)),
      },

      right:{
        entityId:Number(row.right_entity_id),
        sourceKey:row.right_source_key,
        releaseKey:row.right_release_key,
        packageId:Number(row.right_package_id),
        packageKey:row.right_package_key,
        entityType:row.right_entity_type,
        nativeIdentifier:row.right_native_identifier,
        name:row.right_name,
        definition:row.right_definition??undefined,
        pinned:pinned.has(Number(row.right_package_id)),
      },

      boundaries:{
        sourceEntitiesImmutable:true,
        sameNameDoesNotImplyEquivalence:true,
        exactContributorIdentityFromMapping:true,
        bothPackagesMustBePinned:true,
        extensionGovernanceRequiredAfterMerge:true,
      },
    };
  }

  async execute(input:{
    contextKey:string;
    mappingId:number;
    targetNativeIdentifier:string;
    targetName:string;
    targetDefinition?:string;
    rationale:string;
    actor:string;
    componentDecisions:Array<Record<string,unknown>>;
  }){
    const rows=await this.client.query<any>(`
      SELECT *
      FROM rdl.resolve_company_adoption_merge(
        ${sqlLiteral(input.contextKey)},
        ${Number(input.mappingId)},
        ${sqlLiteral(input.targetNativeIdentifier)},
        ${sqlLiteral(input.targetName)},
        ${nullable(input.targetDefinition)},
        ${sqlLiteral(input.rationale)},
        ${sqlLiteral(input.actor)},
        ${sqlLiteral(JSON.stringify(input.componentDecisions))}::jsonb
      )
    `);

    const row=rows[0];

    if(!row)
      throw new Error("Company merge workflow returned no result.");

    return {
      extensionChangeId:Number(row.extension_change_id),
      compositionId:Number(row.composition_id),
      retireExtensionChangeIds:
        Array.isArray(row.retire_extension_change_ids)
          ? row.retire_extension_change_ids.map(Number)
          : parsePgArray(row.retire_extension_change_ids),
    };
  }
}

function nullable(value:string|undefined){
  const text=value?.trim()??"";
  return text ? sqlLiteral(text) : "NULL";
}

function parsePgArray(value:unknown):number[]{
  if(typeof value!=="string")return [];

  return value
    .replace(/^\{/,"")
    .replace(/\}$/,"")
    .split(",")
    .map(Number)
    .filter(Number.isSafeInteger);
}
