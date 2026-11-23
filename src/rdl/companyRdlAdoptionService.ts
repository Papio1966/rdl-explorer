export type CompanyAdoptionSession={
  authenticated:true;
  reviewer:string;
  roles:string[];
  authenticatedAt:string;
};

export type CompanyAdoptionSourcePackage={
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

export type CompanyContextResult={
  contextId:number;
  contextKey:string;
  contextName:string;
  status:string;
};

export type CompanyCompositionResult={
  extensionChangeId:number;
  compositionId:number;
};

export async function loadCompanyAdoptionSession():Promise<CompanyAdoptionSession|null>{
  try{
    const payload=await requestJson<unknown>("/api/company-adoption/session");
    return isSession(payload)?payload:null;
  }catch{
    return null;
  }
}

export async function loadPublishedCompanyAdoptionPackages(){
  const payload=await requestJson<{packages:CompanyAdoptionSourcePackage[]}>(
    "/api/company-adoption/packages"
  );
  return Array.isArray(payload.packages)?payload.packages:[];
}

export async function createCompanyContext(body:{
  contextKey:string;
  name:string;
  ownerReference?:string;
}){
  const payload=await requestJson<{item:CompanyContextResult}>(
    "/api/company-adoption/create-context",
    {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    }
  );
  return payload.item;
}

export async function pinCompanyIndustryPackage(body:{
  contextKey:string;
  packageId:number;
  precedence:number;
  reason:string;
}){
  const payload=await requestJson<{
    item:{
      pinId:number;
      contextId:number;
      packageId:number;
      precedence:number;
    }
  }>(
    "/api/company-adoption/pin-package",
    {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    }
  );
  return payload.item;
}

export async function createCompanyComposition(body:{
  contextKey:string;
  compositionKind:"multi_source_merge"|"derived_copy"|"promotion";
  targetEntityType:string;
  targetNativeIdentifier:string;
  targetName:string;
  targetDefinition?:string;
  rationale:string;
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
}){
  const payload=await requestJson<{item:CompanyCompositionResult}>(
    "/api/company-adoption/create-composition",
    {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    }
  );
  return payload.item;
}

function isSession(value:unknown):value is CompanyAdoptionSession{
  if(!value||typeof value!=="object")return false;
  const candidate=value as Record<string,unknown>;

  return candidate.authenticated===true
    &&typeof candidate.reviewer==="string"
    &&candidate.reviewer.trim().length>0
    &&Array.isArray(candidate.roles)
    &&candidate.roles.every(role=>typeof role==="string")
    &&typeof candidate.authenticatedAt==="string"
    &&candidate.authenticatedAt.trim().length>0;
}

async function requestJson<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{
    ...init,
    credentials:"same-origin",
    headers:{
      Accept:"application/json",
      ...(init?.headers??{}),
    },
  });

  const contentType=response.headers.get("content-type")?.toLowerCase()??"";

  if(!contentType.includes("application/json"))
    throw new Error(`Expected JSON response from ${url}.`);

  const payload:unknown=await response.json();

  if(!response.ok){
    const message=
      payload
      &&typeof payload==="object"
      &&typeof (payload as Record<string,unknown>).error==="string"
        ?String((payload as Record<string,unknown>).error)
        :`Request failed (${response.status}).`;

    throw new Error(message);
  }

  return payload as T;
}

export type CompanyAdoptionEntity={
  entityId:number;
  packageId:number;
  entityType:string;
  nativeIdentifier:string;
  name:string;
  definition?:string;
};

export type CompanyCollisionDecisionType=
  |"merge"
  |"keep_separate"
  |"rename"
  |"exclude"
  |"defer";

export type CompanyCollisionCandidate={
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
    decisionType:CompanyCollisionDecisionType;
    subjectEntityId?:number;
    targetName?:string;
    rationale:string;
    reviewVersion:number;
    decidedBy:string;
    decidedAt:string;
  };
};


export async function loadPublishedPackageEntities(
  packageId:number,
  query=""
){
  const params=new URLSearchParams({
    packageId:String(packageId),
    q:query,
    limit:"200",
  });

  const payload=await requestJson<{
    items:CompanyAdoptionEntity[];
  }>(
    `/api/company-adoption/entities?${params.toString()}`
  );

  return Array.isArray(payload.items)
    ?payload.items
    :[];
}


export async function loadCompanyCollisionCandidates(
  contextKey:string,
  entityId:number
){
  const params=new URLSearchParams({
    contextKey,
    entityId:String(entityId),
    limit:"100",
  });

  const payload=await requestJson<{
    items:CompanyCollisionCandidate[];
  }>(
    `/api/company-adoption/collisions?${params.toString()}`
  );

  return Array.isArray(payload.items)
    ?payload.items
    :[];
}


export async function recordCompanyCollisionDecision(
  body:{
    contextKey:string;
    mappingId:number;
    decisionType:CompanyCollisionDecisionType;
    subjectEntityId?:number;
    targetName?:string;
    rationale:string;
    expectedVersion:number;
  }
){
  const payload=await requestJson<{
    item:{
      collisionDecisionId:number;
      decisionType:CompanyCollisionDecisionType;
      targetName?:string;
      reviewVersion:number;
      decidedBy:string;
      decidedAt:string;
    }
  }>(
    "/api/company-adoption/collision-decision",
    {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    }
  );

  return payload.item;
}
