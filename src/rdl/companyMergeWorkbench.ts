import { loadRdlEntityDetailRuntime } from "./runtimeDetail";

export const COMPANY_MERGE_CLOSURE_SCHEMA_VERSION=
  "rdl-company-merge-closure/v1" as const;

export type CompanyMergeContributor={
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

export type CompanyMergePreview={
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
};

export type MergeResolution=
  |"use_left"
  |"use_right"
  |"combine"
  |"exclude"
  |"custom";

export type MergeCategoryKey=
  |"definition"
  |"hierarchy"
  |"attributes"
  |"properties"
  |"documents"
  |"disciplines"
  |"informationRequirements"
  |"relationships"
  |"controlledValues"
  |"unitsOfMeasure";

export type MergeCategoryComparison={
  key:MergeCategoryKey;
  label:string;
  componentKind:string;
  common:string[];
  leftOnly:string[];
  rightOnly:string[];
  equal:boolean;
};

export type CompanyMergeDetails={
  preview:CompanyMergePreview;
  leftDetail:Record<string,unknown>;
  rightDetail:Record<string,unknown>;
  leftRelationships:Array<Record<string,unknown>>;
  rightRelationships:Array<Record<string,unknown>>;
};

export type MergeResolutionState=
  Record<MergeCategoryKey,MergeResolution|"">;

export type CompanyMergeTarget={
  nativeIdentifier:string;
  name:string;
  customDefinition:string;
};

const CATEGORY_META:Array<{
  key:MergeCategoryKey;
  label:string;
  componentKind:string;
}>= [
  {
    key:"definition",
    label:"Definition",
    componentKind:"definition",
  },
  {
    key:"hierarchy",
    label:"Hierarchy",
    componentKind:"hierarchy",
  },
  {
    key:"attributes",
    label:"Attributes",
    componentKind:"attribute",
  },
  {
    key:"properties",
    label:"Properties",
    componentKind:"property",
  },
  {
    key:"documents",
    label:"Documents",
    componentKind:"document_type",
  },
  {
    key:"disciplines",
    label:"Disciplines",
    componentKind:"discipline",
  },
  {
    key:"informationRequirements",
    label:"Information Requirements",
    componentKind:"information_requirement",
  },
  {
    key:"relationships",
    label:"Relationships",
    componentKind:"relationship",
  },
  {
    key:"controlledValues",
    label:"Controlled Values",
    componentKind:"controlled_value",
  },
  {
    key:"unitsOfMeasure",
    label:"Units of Measure",
    componentKind:"unit_of_measure",
  },
];

export async function loadCompanyMergePreview(
  contextKey:string,
  mappingId:number
){
  return requestJson<CompanyMergePreview>(
    `/api/company-adoption/merge-preview?context=${encodeURIComponent(contextKey)}&mappingId=${encodeURIComponent(String(mappingId))}`
  );
}

export async function loadCompanyMergeDetails(
  preview:CompanyMergePreview
):Promise<CompanyMergeDetails>{
  const [leftDetail,rightDetail,leftScope,rightScope]=
    await Promise.all([
      loadRdlEntityDetailRuntime({
        sourceKey:preview.left.sourceKey,
        releaseKey:preview.left.releaseKey,
        entityType:preview.left.entityType,
        nativeIdentifier:preview.left.nativeIdentifier,
        mode:"api",
      }),

      loadRdlEntityDetailRuntime({
        sourceKey:preview.right.sourceKey,
        releaseKey:preview.right.releaseKey,
        entityType:preview.right.entityType,
        nativeIdentifier:preview.right.nativeIdentifier,
        mode:"api",
      }),

      loadReleaseRelationships(
        preview.left.sourceKey,
        preview.left.releaseKey
      ),

      loadReleaseRelationships(
        preview.right.sourceKey,
        preview.right.releaseKey
      ),
    ]);

  if(!leftDetail||!rightDetail)
    throw new Error(
      "Both exact contributor details are required before merge resolution."
    );

  return {
    preview,
    leftDetail:leftDetail as unknown as Record<string,unknown>,
    rightDetail:rightDetail as unknown as Record<string,unknown>,

    leftRelationships:
      relationshipsForContributor(
        leftScope,
        preview.left
      ),

    rightRelationships:
      relationshipsForContributor(
        rightScope,
        preview.right
      ),
  };
}

export function compareCompanyMergeComponents(
  details:CompanyMergeDetails
):MergeCategoryComparison[]{
  return CATEGORY_META.map(meta=>{
    const left=
      valuesForCategory(
        details.leftDetail,
        details.leftRelationships,
        meta.key
      );

    const right=
      valuesForCategory(
        details.rightDetail,
        details.rightRelationships,
        meta.key
      );

    const l=new Set(left);
    const r=new Set(right);

    const common=
      [...l]
        .filter(value=>r.has(value))
        .sort();

    const leftOnly=
      [...l]
        .filter(value=>!r.has(value))
        .sort();

    const rightOnly=
      [...r]
        .filter(value=>!l.has(value))
        .sort();

    return {
      ...meta,
      common,
      leftOnly,
      rightOnly,
      equal:leftOnly.length===0&&rightOnly.length===0,
    };
  });
}

export function initialMergeResolutions(
  comparisons:readonly MergeCategoryComparison[]
):MergeResolutionState{
  const result={} as MergeResolutionState;

  for(const item of comparisons){
    if(item.equal){
      result[item.key]=
        item.key==="definition"
          ?"use_left"
          :"combine";
    }else{
      result[item.key]="";
    }
  }

  return result;
}

export function unresolvedMergeCategories(
  comparisons:readonly MergeCategoryComparison[],
  resolutions:MergeResolutionState
){
  return comparisons
    .filter(
      comparison=>
        !comparison.equal
        &&!resolutions[comparison.key]
    )
    .map(comparison=>comparison.key);
}

export function defaultCompanyMergeTarget(
  preview:CompanyMergePreview
):CompanyMergeTarget{
  const sameName=
    normalize(preview.left.name)===
    normalize(preview.right.name);

  return {
    nativeIdentifier:
      `COMPANY-${preview.mappingId}`,

    name:
      sameName
        ?preview.left.name
        :`${preview.left.name} / ${preview.right.name}`,

    customDefinition:"",
  };
}

export function buildCompanyMergeExecution(
  details:CompanyMergeDetails,
  comparisons:readonly MergeCategoryComparison[],
  resolutions:MergeResolutionState,
  target:CompanyMergeTarget,
  rationale:string
){
  const unresolved=
    unresolvedMergeCategories(
      comparisons,
      resolutions
    );

  if(unresolved.length)
    throw new Error(
      `Resolve all differing semantic components before merge: ${unresolved.join(", ")}.`
    );

  const componentDecisions:Array<Record<string,unknown>>=[];
  const resolvedComponents:Record<string,unknown>={};
  let targetDefinition="";

  for(const comparison of comparisons){
    const resolution=
      resolutions[comparison.key];

    if(!resolution)
      throw new Error(
        `A resolution is required for ${comparison.label}.`
      );

    const leftValues=
      valuesForCategory(
        details.leftDetail,
        details.leftRelationships,
        comparison.key
      );

    const rightValues=
      valuesForCategory(
        details.rightDetail,
        details.rightRelationships,
        comparison.key
      );

    const resolved=
      resolveValues(
        resolution,
        leftValues,
        rightValues,
        target.customDefinition,
        comparison.key
      );

    if(comparison.key==="definition")
      targetDefinition=resolved[0]??"";

    const dbResolution=
      resolutionToDatabase(resolution);

    const selectedSourceEntityId=
      resolution==="use_left"
        ?details.preview.left.entityId
        :resolution==="use_right"
          ?details.preview.right.entityId
          :undefined;

    const selectedContributorEntityIds=
      resolution==="combine"
        ?[
            details.preview.left.entityId,
            details.preview.right.entityId,
          ]
        :selectedSourceEntityId
          ?[selectedSourceEntityId]
          :[];

    componentDecisions.push({
      componentKind:comparison.componentKind,
      componentKey:
        comparison.key==="definition"
          ?"definition"
          :comparison.key,

      resolution:dbResolution,

      ...(selectedSourceEntityId
        ?{selectedSourceEntityId}
        :{}),

      resolvedPayload:{
        category:comparison.key,
        selectedContributorEntityIds,
        values:resolved,
      },

      rationale:
        `Administrator resolved ${comparison.label} as ${resolution.replace("_"," ")} during governed Company merge.`,
    });

    resolvedComponents[comparison.key]={
      resolution,
      values:resolved,
      selectedContributorEntityIds,
    };
  }

  const relationshipResolution=
    resolutions.relationships;

  const selectedRelationshipRows=
    relationshipResolution==="use_left"
      ?details.leftRelationships
      :relationshipResolution==="use_right"
        ?details.rightRelationships
        :relationshipResolution==="combine"
          ?[
              ...details.leftRelationships,
              ...details.rightRelationships,
            ]
          :[];

  const materializedRelationships=
    relationshipResolution==="exclude"
      ?[]
      :materializeRelationships(
          selectedRelationshipRows,
          details.preview,
          {
            entityType:details.preview.left.entityType,
            nativeIdentifier:target.nativeIdentifier,
          }
        );

  componentDecisions.push({
    componentKind:"other",
    componentKey:"merge_component_closure",
    resolution:"target_override",

    resolvedPayload:{
      schemaVersion:
        COMPANY_MERGE_CLOSURE_SCHEMA_VERSION,

      resolvedComponents,
      materializedRelationships,

      exactContributors:[
        exactContributor(details.preview.left),
        exactContributor(details.preview.right),
      ],

      sourceEntitiesImmutable:true,
      sameNameDoesNotImplyEquivalence:true,
    },

    rationale:
      "Final governed semantic closure for the Company multi-source merge.",
  });

  return {
    contextKey:details.preview.contextKey,
    mappingId:details.preview.mappingId,
    targetNativeIdentifier:target.nativeIdentifier.trim(),
    targetName:target.name.trim(),
    targetDefinition,
    rationale:rationale.trim(),
    componentDecisions,
  };
}

export async function executeCompanyMerge(
  body:ReturnType<typeof buildCompanyMergeExecution>
){
  return requestJson<{
    schemaVersion:"rdl-company-merge-execution/v1";
    result:{
      extensionChangeId:number;
      compositionId:number;
      retireExtensionChangeIds:number[];
    };
  }>(
    "/api/company-adoption/merge-execute",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify(body),
    }
  );
}

function valuesForCategory(
  detail:Record<string,unknown>,
  relationships:Array<Record<string,unknown>>,
  key:MergeCategoryKey
):string[]{
  const record=
    object(detail.record);

  if(key==="definition"){
    const definition=
      text(record.definition);

    return definition?[definition]:[];
  }

  if(key==="attributes"){
    const attributes=
      object(
        record.attributes
        ??record.metadata
        ??record.normalizedMetadata
      );

    return Object.keys(attributes)
      .sort()
      .map(
        attribute=>
          `${attribute}=${stableJson(attributes[attribute])}`
      );
  }

  if(key==="hierarchy"){
    return unique([
      ...linkedValues(detail.parents,"parent"),
      ...linkedValues(detail.children,"child"),
      ...linkedValues(detail.hierarchy,"hierarchy"),
    ]);
  }

  if(key==="properties")
    return linkedValues(detail.properties,"property");

  if(key==="documents")
    return linkedValues(
      detail.requiredDocuments
      ??detail.documents,
      "document"
    );

  if(key==="disciplines")
    return linkedValues(detail.disciplines,"discipline");

  if(key==="informationRequirements")
    return linkedValues(
      detail.informationRequirements,
      "information_requirement"
    );

  if(key==="controlledValues")
    return linkedValues(
      detail.controlledValues,
      "controlled_value"
    );

  if(key==="unitsOfMeasure")
    return linkedValues(
      detail.unitsOfMeasure,
      "unit_of_measure"
    );

  if(key==="relationships")
    return unique(
      relationships.map(
        relationshipSignature
      )
    );

  return [];
}

function linkedValues(
  value:unknown,
  prefix:string
):string[]{
  if(!Array.isArray(value))return [];

  return unique(
    value.map((item,index)=>{
      const row=object(item);

      const entityType=
        text(row.entityType)
        ||text(row.entity_type_code)
        ||prefix;

      const nativeIdentifier=
        text(row.nativeIdentifier)
        ||text(row.native_identifier)
        ||text(row.id)
        ||String(index+1);

      const name=
        text(row.name)
        ||text(row.label);

      const attributes=
        object(row.attributes);

      return [
        entityType,
        nativeIdentifier,
        name,
        Object.keys(attributes).length
          ?stableJson(attributes)
          :"",
      ]
        .filter(Boolean)
        .join(" | ");
    })
  );
}

function resolveValues(
  resolution:MergeResolution,
  left:string[],
  right:string[],
  customDefinition:string,
  key:MergeCategoryKey
){
  if(resolution==="exclude")return [];

  if(resolution==="use_left")
    return [...left];

  if(resolution==="use_right")
    return [...right];

  if(resolution==="combine")
    return unique([...left,...right]);

  if(resolution==="custom"){
    if(key!=="definition")
      throw new Error(
        "Custom resolution is currently supported only for Definition."
      );

    const value=
      customDefinition.trim();

    if(!value)
      throw new Error(
        "A custom Company definition is required."
      );

    return [value];
  }

  return [];
}

function resolutionToDatabase(
  resolution:MergeResolution
){
  if(resolution==="use_left"||resolution==="use_right")
    return "use_source";

  if(resolution==="combine")
    return "combine";

  if(resolution==="exclude")
    return "exclude";

  return "target_override";
}

function materializeRelationships(
  rows:Array<Record<string,unknown>>,
  preview:CompanyMergePreview,
  target:{
    entityType:string;
    nativeIdentifier:string;
  }
){
  const result=
    new Map<string,Record<string,unknown>>();

  for(const raw of rows){
    const relationshipType=
      text(raw.relationshipType)
      ||text(raw.relationship_type);

    let sourceEntityType=
      text(raw.sourceEntityType)
      ||text(raw.source_entity_type);

    let sourceNativeIdentifier=
      text(raw.sourceNativeIdentifier)
      ||text(raw.source_native_identifier);

    let targetEntityType=
      text(raw.targetEntityType)
      ||text(raw.target_entity_type);

    let targetNativeIdentifier=
      text(raw.targetNativeIdentifier)
      ||text(raw.target_native_identifier);

    if(
      contributorEndpoint(
        sourceEntityType,
        sourceNativeIdentifier,
        preview
      )
    ){
      sourceEntityType=target.entityType;
      sourceNativeIdentifier=target.nativeIdentifier;
    }

    if(
      contributorEndpoint(
        targetEntityType,
        targetNativeIdentifier,
        preview
      )
    ){
      targetEntityType=target.entityType;
      targetNativeIdentifier=target.nativeIdentifier;
    }

    if(
      !relationshipType
      ||!sourceEntityType
      ||!sourceNativeIdentifier
      ||!targetEntityType
      ||!targetNativeIdentifier
    )continue;

    const item={
      relationshipType,
      sourceEntityType,
      sourceNativeIdentifier,
      targetEntityType,
      targetNativeIdentifier,

      relationshipStatus:
        text(raw.relationshipStatus)
        ||text(raw.relationship_status)
        ||"active",

      attributes:
        object(raw.attributes),

      sourceLocator:{
        ...object(
          raw.sourceLocator
          ??raw.source_locator
        ),

        sourceSheet:
          text(raw.sourceSheet)
          ||text(raw.source_sheet)
          ||undefined,
      },
    };

    const signature=[
      relationshipType,
      sourceEntityType,
      sourceNativeIdentifier,
      targetEntityType,
      targetNativeIdentifier,
      stableJson(item.attributes),
    ].join("\u0000");

    result.set(signature,item);
  }

  return [...result.values()];
}

async function loadReleaseRelationships(
  sourceKey:string,
  releaseKey:string
){
  const pageSize=1000;
  const rows:Array<Record<string,unknown>>=[];
  let offset=0;

  for(let page=0;page<100;page++){
    const payload=
      await requestJson<Record<string,unknown>>(
        `/api/rdl-runtime/relationships?sourceKey=${encodeURIComponent(sourceKey)}&releaseKey=${encodeURIComponent(releaseKey)}&limit=${pageSize}&offset=${offset}`
      );

    const items=
      Array.isArray(payload.items)
        ?payload.items
        :Array.isArray(payload.relationships)
          ?payload.relationships
          :[];

    rows.push(
      ...items.filter(
        (item):item is Record<string,unknown>=>
          Boolean(item)
          &&typeof item==="object"
      )
    );

    const total=
      Number(payload.total??rows.length);

    if(
      items.length<pageSize
      ||rows.length>=total
    )break;

    offset+=items.length;
  }

  return rows;
}

function relationshipsForContributor(
  rows:Array<Record<string,unknown>>,
  contributor:CompanyMergeContributor
){
  return rows.filter(row=>{
    const sourceType=
      text(row.sourceEntityType)
      ||text(row.source_entity_type);

    const sourceId=
      text(row.sourceNativeIdentifier)
      ||text(row.source_native_identifier);

    const targetType=
      text(row.targetEntityType)
      ||text(row.target_entity_type);

    const targetId=
      text(row.targetNativeIdentifier)
      ||text(row.target_native_identifier);

    return (
      sourceType===contributor.entityType
      &&sourceId===contributor.nativeIdentifier
    )||(
      targetType===contributor.entityType
      &&targetId===contributor.nativeIdentifier
    );
  });
}

function contributorEndpoint(
  entityType:string,
  nativeIdentifier:string,
  preview:CompanyMergePreview
){
  return (
    entityType===preview.left.entityType
    &&nativeIdentifier===preview.left.nativeIdentifier
  )||(
    entityType===preview.right.entityType
    &&nativeIdentifier===preview.right.nativeIdentifier
  );
}

function relationshipSignature(
  row:Record<string,unknown>
){
  return [
    text(row.relationshipType)
      ||text(row.relationship_type),

    text(row.sourceEntityType)
      ||text(row.source_entity_type),

    text(row.sourceNativeIdentifier)
      ||text(row.source_native_identifier),

    text(row.targetEntityType)
      ||text(row.target_entity_type),

    text(row.targetNativeIdentifier)
      ||text(row.target_native_identifier),

    stableJson(object(row.attributes)),
  ].join(" | ");
}

function exactContributor(
  contributor:CompanyMergeContributor
){
  return {
    entityId:contributor.entityId,
    sourceKey:contributor.sourceKey,
    releaseKey:contributor.releaseKey,
    packageId:contributor.packageId,
    packageKey:contributor.packageKey,
    entityType:contributor.entityType,
    nativeIdentifier:contributor.nativeIdentifier,
  };
}

function normalize(value:string){
  return value
    .trim()
    .replace(/\s+/g," ")
    .toLocaleLowerCase("en");
}

function text(value:unknown){
  return typeof value==="string"
    ?value.trim()
    :"";
}

function object(value:unknown):Record<string,unknown>{
  return value&&typeof value==="object"&&!Array.isArray(value)
    ?value as Record<string,unknown>
    :{};
}

function unique(values:string[]){
  return [...new Set(
    values
      .map(value=>value.trim())
      .filter(Boolean)
  )].sort();
}

function stableJson(value:unknown):string{
  if(Array.isArray(value))
    return `[${value.map(stableJson).join(",")}]`;

  if(value&&typeof value==="object"){
    const record=
      value as Record<string,unknown>;

    return `{${Object.keys(record)
      .sort()
      .map(
        key=>
          `${JSON.stringify(key)}:${stableJson(record[key])}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value)??"null";
}

async function requestJson<T>(
  url:string,
  init?:RequestInit
):Promise<T>{
  const response=
    await fetch(
      url,
      {
        ...init,
        headers:{
          Accept:"application/json",
          ...(init?.headers??{}),
        },
      }
    );

  const contentType=
    response.headers
      .get("content-type")
      ?.toLowerCase()
    ??"";

  if(!contentType.includes("application/json"))
    throw new Error(
      `Expected JSON response from ${url}.`
    );

  const payload=
    await response.json() as unknown;

  if(!response.ok){
    const message=
      payload
      &&typeof payload==="object"
      &&typeof (
        payload as Record<string,unknown>
      ).error==="string"
        ?String(
            (
              payload as Record<string,unknown>
            ).error
          )
        :`Request failed (${response.status}).`;

    throw new Error(message);
  }

  return payload as T;
}
