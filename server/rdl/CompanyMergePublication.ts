export const COMPANY_MERGE_CLOSURE_SCHEMA_VERSION =
  "rdl-company-merge-closure/v1" as const;

export type MergePublicationRelationship = {
  relationshipId:number;
  sourcePackageId:number;
  sourcePackageKey:string;
  relationshipType:string;
  sourceEntityType:string;
  sourceNativeIdentifier:string;
  targetEntityType:string;
  targetNativeIdentifier:string;
  relationshipStatus:string;
  attributes:Record<string,unknown>;
  sourceLocator:Record<string,unknown>;
};

type MergeContributor = {
  contributionRole:string;
  packageId:number;
  packageKey:string;
  entityId:number;
  entityType:string;
  nativeIdentifier:string;
};

type MergeDecision = {
  componentKind:string;
  componentKey:string;
  resolution:string;
  resolvedPayload?:Record<string,unknown>;
};

type MergeDerivation = {
  compositionId:number;
  compositionKind:string;
  contributors:MergeContributor[];
  componentDecisions:MergeDecision[];
};

type MergePublicationItem = {
  changeKind:string;
  entityType:string;
  nativeIdentifier:string;
  baseEntityId?:number;
  derivation?:MergeDerivation;
};

type PackagePin = {
  packageId:number;
};

type MaterializedRelationshipPayload = {
  relationshipType:string;
  sourceEntityType:string;
  sourceNativeIdentifier:string;
  targetEntityType:string;
  targetNativeIdentifier:string;
  relationshipStatus?:string;
  attributes?:Record<string,unknown>;
  sourceLocator?:Record<string,unknown>;
};

export function materializeCompanyMergeRelationships(
  baseRelationships:readonly MergePublicationRelationship[],
  items:readonly MergePublicationItem[],
  packagePins:readonly PackagePin[]
):MergePublicationRelationship[] {

  const effective=new Map<string,MergePublicationRelationship>();

  for(const relationship of baseRelationships)
    effective.set(relationshipKey(relationship),relationship);

  const pinnedPackageIds=new Set(
    packagePins
      .map(pin=>Number(pin.packageId))
      .filter(id=>Number.isSafeInteger(id)&&id>0)
  );

  const retiredEntityIds=new Set(
    items
      .filter(
        item=>
          item.changeKind==="retire"
          &&item.baseEntityId!=null
          &&Number.isSafeInteger(item.baseEntityId)
      )
      .map(item=>Number(item.baseEntityId))
  );

  for(const item of items){
    const derivation=item.derivation;

    if(
      !derivation
      ||derivation.compositionKind!=="multi_source_merge"
    )continue;

    const contributors=derivation.contributors??[];

    if(contributors.length<2)
      throw new Error(
        "A multi-source Company merge requires at least two exact contributors."
      );

    if(
      new Set(
        contributors.map(
          contributor=>contributor.packageKey
        )
      ).size<2
    )
      throw new Error(
        "A multi-source Company merge requires contributors from at least two exact packages."
      );

    for(const contributor of contributors){
      if(
        pinnedPackageIds.has(contributor.packageId)
        &&!retiredEntityIds.has(contributor.entityId)
      )
        throw new Error(
          `Pinned merge contributor ${contributor.entityId} must be explicitly retired from the Company effective view before publication.`
        );
    }

    const closureDecision=
      derivation.componentDecisions.find(
        decision=>
          decision.componentKind==="other"
          &&decision.componentKey==="merge_component_closure"
      );

    if(
      !closureDecision
      ||closureDecision.resolution!=="target_override"
    )
      throw new Error(
        `Company merge composition ${derivation.compositionId} has no resolved merge component closure.`
      );

    const payload=
      closureDecision.resolvedPayload??{};

    if(
      payload.schemaVersion!==
        COMPANY_MERGE_CLOSURE_SCHEMA_VERSION
    )
      throw new Error(
        `Company merge composition ${derivation.compositionId} has an unsupported merge closure schema.`
      );

    const resolvedComponents=
      payload.resolvedComponents;

    if(
      !resolvedComponents
      ||typeof resolvedComponents!=="object"
      ||Array.isArray(resolvedComponents)
      ||Object.keys(
        resolvedComponents as Record<string,unknown>
      ).length===0
    )
      throw new Error(
        `Company merge composition ${derivation.compositionId} contains no resolved semantic components.`
      );

    const materializedRelationships=
      payload.materializedRelationships;

    if(!Array.isArray(materializedRelationships))
      throw new Error(
        `Company merge composition ${derivation.compositionId} must contain a materializedRelationships array.`
      );

    const primary=
      contributors.find(
        contributor=>
          contributor.contributionRole==="primary"
      )
      ??contributors[0];

    materializedRelationships.forEach(
      (raw,index)=>{
        const relationship=
          validateMaterializedRelationship(
            raw,
            item,
            derivation.compositionId
          );

        const syntheticId=
          syntheticRelationshipId(
            derivation.compositionId,
            index
          );

        const resolved:MergePublicationRelationship={
          relationshipId:syntheticId,

          sourcePackageId:
            Number(primary.packageId),

          sourcePackageKey:
            String(primary.packageKey),

          relationshipType:
            relationship.relationshipType,

          sourceEntityType:
            relationship.sourceEntityType,

          sourceNativeIdentifier:
            relationship.sourceNativeIdentifier,

          targetEntityType:
            relationship.targetEntityType,

          targetNativeIdentifier:
            relationship.targetNativeIdentifier,

          relationshipStatus:
            relationship.relationshipStatus??"active",

          attributes:{
            ...(relationship.attributes??{}),

            companyMerge:{
              schemaVersion:
                COMPANY_MERGE_CLOSURE_SCHEMA_VERSION,

              compositionId:
                derivation.compositionId,

              derived:true,

              exactContributorEntityIds:
                contributors.map(
                  contributor=>
                    contributor.entityId
                ),

              exactContributorPackageKeys:
                contributors.map(
                  contributor=>
                    contributor.packageKey
                ),
            },
          },

          sourceLocator:{
            ...(relationship.sourceLocator??{}),

            workflow:
              "company_rdl_multi_source_merge",

            compositionId:
              derivation.compositionId,
          },
        };

        /*
         * A materialized Company relationship wins over
         * an identical source relationship signature.
         *
         * We never mutate the source relationship.
         */
        effective.set(
          relationshipKey(resolved),
          resolved
        );
      }
    );
  }

  return [...effective.values()].sort(
    (left,right)=>
      relationshipKey(left)
        .localeCompare(
          relationshipKey(right)
        )
  );
}


function validateMaterializedRelationship(
  value:unknown,
  item:MergePublicationItem,
  compositionId:number
):MaterializedRelationshipPayload {

  if(!value||typeof value!=="object")
    throw new Error(
      `Company merge composition ${compositionId} contains an invalid materialized relationship.`
    );

  const raw=value as Record<string,unknown>;

  const result:MaterializedRelationshipPayload={
    relationshipType:
      requiredText(
        raw.relationshipType,
        "relationshipType",
        compositionId
      ),

    sourceEntityType:
      requiredText(
        raw.sourceEntityType,
        "sourceEntityType",
        compositionId
      ),

    sourceNativeIdentifier:
      requiredText(
        raw.sourceNativeIdentifier,
        "sourceNativeIdentifier",
        compositionId
      ),

    targetEntityType:
      requiredText(
        raw.targetEntityType,
        "targetEntityType",
        compositionId
      ),

    targetNativeIdentifier:
      requiredText(
        raw.targetNativeIdentifier,
        "targetNativeIdentifier",
        compositionId
      ),

    relationshipStatus:
      optionalText(raw.relationshipStatus),

    attributes:
      objectValue(raw.attributes),

    sourceLocator:
      objectValue(raw.sourceLocator),
  };

  const targetKey=
    `${item.entityType}\u0000${item.nativeIdentifier}`;

  const sourceKey=
    `${result.sourceEntityType}\u0000${result.sourceNativeIdentifier}`;

  const relationshipTargetKey=
    `${result.targetEntityType}\u0000${result.targetNativeIdentifier}`;

  if(
    sourceKey!==targetKey
    &&relationshipTargetKey!==targetKey
  )
    throw new Error(
      `Company merge composition ${compositionId} contains a materialized relationship that does not reference the governed Company target entity.`
    );

  return result;
}


function relationshipKey(
  relationship:{
    relationshipType:string;
    sourceEntityType:string;
    sourceNativeIdentifier:string;
    targetEntityType:string;
    targetNativeIdentifier:string;
  }
){
  return [
    relationship.relationshipType,
    relationship.sourceEntityType,
    relationship.sourceNativeIdentifier,
    relationship.targetEntityType,
    relationship.targetNativeIdentifier,
  ].join("\u0000");
}


function syntheticRelationshipId(
  compositionId:number,
  index:number
){
  const base=
    Math.abs(Number(compositionId));

  if(
    !Number.isSafeInteger(base)
    ||base<=0
  )
    throw new Error(
      "A valid compositionId is required for Company merge relationship materialization."
    );

  const value=
    base*100000+(index+1);

  if(!Number.isSafeInteger(value))
    throw new Error(
      "Company merge synthetic relationship identifier exceeded the safe integer range."
    );

  return -value;
}


function requiredText(
  value:unknown,
  field:string,
  compositionId:number
){
  const result=
    typeof value==="string"
      ?value.trim()
      :"";

  if(!result)
    throw new Error(
      `Company merge composition ${compositionId} materialized relationship requires ${field}.`
    );

  return result;
}


function optionalText(
  value:unknown
){
  const result=
    typeof value==="string"
      ?value.trim()
      :"";

  return result||undefined;
}


function objectValue(
  value:unknown
):Record<string,unknown>|undefined{
  if(
    !value
    ||typeof value!=="object"
    ||Array.isArray(value)
  )return undefined;

  return value as Record<string,unknown>;
}
