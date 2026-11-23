import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type CompanyAdoptionSourcePackage = {
  sourceId:number;
  sourceKey:string;
  sourceName:string;
  releaseId:number;
  releaseKey:string;
  versionLabel:string;
  packageId:number;
  packageKey:string;
  packageSha256:string;
};

export type CompanyContextResult = {
  contextId:number;
  contextKey:string;
  contextName:string;
  status:string;
};

export type CompanyCompositionResult = {
  extensionChangeId:number;
  compositionId:number;
};


export type CompanyAdoptionEntity = {
  entityId:number;
  packageId:number;
  entityType:string;
  nativeIdentifier:string;
  name:string;
  definition?:string;
};

export type CompanyCollisionCandidate = {
  mappingId:number;
  mappingStatus:string;
  mappingType:string;
  provenanceMethod:string;
  confidence:number;

  left:{
    entityId:number;
    sourceKey:string;
    entityType:string;
    nativeIdentifier:string;
    name:string;
  };

  right:{
    entityId:number;
    sourceKey:string;
    entityType:string;
    nativeIdentifier:string;
    name:string;
  };

  decision?:{
    collisionDecisionId:number;
    decisionType:
      |"merge"
      |"keep_separate"
      |"rename"
      |"exclude"
      |"defer";
    subjectEntityId?:number;
    targetName?:string;
    rationale:string;
    reviewVersion:number;
    decidedBy:string;
    decidedAt:string;
  };
};

export class CompanyRdlAdoptionRepository {
  constructor(private readonly client:SqlJsonClient) {}

  async listPublishedIndustryPackages():Promise<CompanyAdoptionSourcePackage[]> {
    const rows=await this.client.query<any>(`
      SELECT
        s.source_id,s.source_key,s.name AS source_name,
        r.release_id,r.release_key,r.version_label,
        p.package_id,p.package_key,p.content_sha256
      FROM rdl.rdl_source s
      JOIN rdl.rdl_release r ON r.source_id=s.source_id
      JOIN rdl.rdl_package p ON p.release_id=r.release_id
      WHERE r.release_status='published'
      ORDER BY s.source_key,r.release_id,p.package_id`);

    return rows.map((r:any)=>({
      sourceId:Number(r.source_id),
      sourceKey:r.source_key,
      sourceName:r.source_name,
      releaseId:Number(r.release_id),
      releaseKey:r.release_key,
      versionLabel:r.version_label,
      packageId:Number(r.package_id),
      packageKey:r.package_key,
      packageSha256:r.content_sha256,
    }));
  }

  async createCompanyContext(input:{
    contextKey:string;
    name:string;
    ownerReference?:string;
  }):Promise<CompanyContextResult> {
    const rows=await this.client.query<any>(`
      SELECT *
      FROM rdl.create_company_rdl_context(
        ${sqlLiteral(input.contextKey)},
        ${sqlLiteral(input.name)},
        ${nullable(input.ownerReference)}
      )`);

    const row=rows[0];
    if(!row) throw new Error("Company context creation returned no result.");

    return {
      contextId:Number(row.context_id),
      contextKey:row.context_key,
      contextName:row.context_name,
      status:row.context_status,
    };
  }

  async pinIndustryPackage(input:{
    contextKey:string;
    packageId:number;
    precedence:number;
    reason:string;
  }) {
    const rows=await this.client.query<any>(`
      SELECT *
      FROM rdl.pin_company_industry_package(
        ${sqlLiteral(input.contextKey)},
        ${Number(input.packageId)},
        ${Number(input.precedence)},
        ${sqlLiteral(input.reason)}
      )`);

    const row=rows[0];
    if(!row) throw new Error("Company package adoption returned no result.");

    return {
      pinId:Number(row.context_package_pin_id),
      contextId:Number(row.context_id),
      packageId:Number(row.package_id),
      precedence:Number(row.precedence),
    };
  }

  async createComposition(input:{
    contextKey:string;
    compositionKind:"multi_source_merge"|"derived_copy"|"promotion";
    targetEntityType:string;
    targetNativeIdentifier:string;
    targetName:string;
    targetDefinition?:string;
    rationale:string;
    createdBy:string;
    contributors:Array<{
      sourceEntityId:number;
      contributionRole:"primary"|"contributor"|"reference";
    }>;
    componentDecisions:Array<{
      componentKind:string;
      componentKey:string;
      resolution:string;
      selectedSourceEntityId?:number;
      resolvedPayload?:Record<string,unknown>;
      rationale:string;
    }>;
  }):Promise<CompanyCompositionResult> {
    const rows=await this.client.query<any>(`
      SELECT *
      FROM rdl.create_company_adoption_composition(
        ${sqlLiteral(input.contextKey)},
        ${sqlLiteral(input.compositionKind)},
        ${sqlLiteral(input.targetEntityType)},
        ${sqlLiteral(input.targetNativeIdentifier)},
        ${sqlLiteral(input.targetName)},
        ${nullable(input.targetDefinition)},
        ${sqlLiteral(input.rationale)},
        ${sqlLiteral(input.createdBy)},
        ${sqlLiteral(JSON.stringify(input.contributors))}::jsonb,
        ${sqlLiteral(JSON.stringify(input.componentDecisions))}::jsonb
      )`);

    const row=rows[0];
    if(!row) throw new Error("Company composition creation returned no result.");

    return {
      extensionChangeId:Number(row.extension_change_id),
      compositionId:Number(row.composition_id),
    };
  }
  async listPublishedPackageEntities(
    packageId:number,
    query="",
    limit=100
  ):Promise<CompanyAdoptionEntity[]> {
    const safeLimit=Math.max(1,Math.min(limit,500));
    const search=query.trim();

    const searchFilter=search
      ?`AND (
          e.name ILIKE ${sqlLiteral("%"+search+"%")}
          OR e.native_identifier ILIKE ${sqlLiteral("%"+search+"%")}
          OR e.entity_type_code ILIKE ${sqlLiteral("%"+search+"%")}
        )`
      :"";

    const rows=await this.client.query<any>(`
      SELECT
        e.entity_id,
        e.package_id,
        e.entity_type_code,
        e.native_identifier,
        e.name,
        e.definition
      FROM rdl.rdl_entity e
      JOIN rdl.rdl_package p
        ON p.package_id=e.package_id
      JOIN rdl.rdl_release r
        ON r.release_id=p.release_id
      WHERE e.package_id=${Number(packageId)}
        AND r.release_status='published'
        ${searchFilter}
      ORDER BY
        e.entity_type_code,
        e.name,
        e.native_identifier
      LIMIT ${safeLimit}`);

    return rows.map((row:any)=>({
      entityId:Number(row.entity_id),
      packageId:Number(row.package_id),
      entityType:row.entity_type_code,
      nativeIdentifier:row.native_identifier,
      name:row.name,
      definition:row.definition??undefined,
    }));
  }


  async listCollisionCandidates(
    contextKey:string,
    entityId:number,
    limit=100
  ):Promise<CompanyCollisionCandidate[]> {
    const safeLimit=Math.max(1,Math.min(limit,500));

    const rows=await this.client.query<any>(`
      SELECT
        m.mapping_id,
        m.status AS mapping_status,
        m.mapping_type,
        m.provenance_method,
        m.confidence,

        left_entity.entity_id AS left_entity_id,
        left_source.source_key AS left_source_key,
        left_entity.entity_type_code AS left_entity_type,
        left_entity.native_identifier AS left_native_identifier,
        left_entity.name AS left_name,

        right_entity.entity_id AS right_entity_id,
        right_source.source_key AS right_source_key,
        right_entity.entity_type_code AS right_entity_type,
        right_entity.native_identifier AS right_native_identifier,
        right_entity.name AS right_name,

        decision.collision_decision_id,
        decision.decision_type,
        decision.subject_entity_id,
        decision.target_name,
        decision.rationale AS decision_rationale,
        decision.review_version,
        decision.decided_by,
        decision.decided_at

      FROM rdl.cross_rdl_mapping m

      JOIN rdl.rdl_entity left_entity
        ON left_entity.entity_id=m.source_entity_id
      JOIN rdl.rdl_package left_package
        ON left_package.package_id=left_entity.package_id
      JOIN rdl.rdl_release left_release
        ON left_release.release_id=left_package.release_id
      JOIN rdl.rdl_source left_source
        ON left_source.source_id=left_release.source_id

      JOIN rdl.rdl_entity right_entity
        ON right_entity.entity_id=m.target_entity_id
      JOIN rdl.rdl_package right_package
        ON right_package.package_id=right_entity.package_id
      JOIN rdl.rdl_release right_release
        ON right_release.release_id=right_package.release_id
      JOIN rdl.rdl_source right_source
        ON right_source.source_id=right_release.source_id

      LEFT JOIN rdl.company_adoption_collision_decision decision
        ON decision.mapping_id=m.mapping_id
       AND decision.context_id=(
         SELECT context_id
         FROM rdl.enterprise_context
         WHERE context_key=${sqlLiteral(contextKey)}
         LIMIT 1
       )

      WHERE
        (
          m.source_entity_id=${Number(entityId)}
          OR m.target_entity_id=${Number(entityId)}
        )

      ORDER BY
        m.confidence DESC,
        m.mapping_id

      LIMIT ${safeLimit}`);

    return rows.map((row:any)=>({
      mappingId:Number(row.mapping_id),
      mappingStatus:row.mapping_status,
      mappingType:row.mapping_type,
      provenanceMethod:row.provenance_method,
      confidence:Number(row.confidence),

      left:{
        entityId:Number(row.left_entity_id),
        sourceKey:row.left_source_key,
        entityType:row.left_entity_type,
        nativeIdentifier:row.left_native_identifier,
        name:row.left_name,
      },

      right:{
        entityId:Number(row.right_entity_id),
        sourceKey:row.right_source_key,
        entityType:row.right_entity_type,
        nativeIdentifier:row.right_native_identifier,
        name:row.right_name,
      },

      ...(row.collision_decision_id==null
        ?{}
        :{
          decision:{
            collisionDecisionId:Number(
              row.collision_decision_id
            ),
            decisionType:row.decision_type,
            subjectEntityId:
              row.subject_entity_id==null
                ?undefined
                :Number(row.subject_entity_id),
            targetName:row.target_name??undefined,
            rationale:row.decision_rationale,
            reviewVersion:Number(row.review_version),
            decidedBy:row.decided_by,
            decidedAt:row.decided_at,
          },
        }),
    }));
  }


  async recordCollisionDecision(input:{
    contextKey:string;
    mappingId:number;
    decisionType:
      |"merge"
      |"keep_separate"
      |"rename"
      |"exclude"
      |"defer";
    targetName?:string;
    rationale:string;
    decidedBy:string;
    expectedVersion:number;
  }) {
    const rows=await this.client.query<any>(`
      SELECT *
      FROM rdl.record_company_adoption_collision_decision_v2(
        ${sqlLiteral(input.contextKey)},
        ${Number(input.mappingId)},
        ${
          sqlLiteral(input.decisionType)
        },
        ${
          input.subjectEntityId==null
            ?"NULL"
            :String(Number(input.subjectEntityId))
        },
        ${nullable(input.targetName)},
        ${sqlLiteral(input.rationale)},
        ${sqlLiteral(input.decidedBy)},
        ${Number(input.expectedVersion)}
      )`);

    const row=rows[0];

    if(!row)
      throw new Error(
        "Company collision decision returned no result."
      );

    return {
      collisionDecisionId:Number(
        row.collision_decision_id
      ),
      decisionType:row.decision_type,
      subjectEntityId:
        row.subject_entity_id==null
          ?undefined
          :Number(row.subject_entity_id),
      targetName:row.target_name??undefined,
      reviewVersion:Number(row.review_version),
      decidedBy:row.decided_by,
      decidedAt:row.decided_at,
    };
  }

}

function nullable(value:string|undefined) {
  return value==null || value.trim()===""
    ? "NULL"
    : sqlLiteral(value.trim());
}
