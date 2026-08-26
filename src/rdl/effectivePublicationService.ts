export type PublicationSession={authenticated:true;reviewer:string;roles:string[];authenticatedAt:string};
export type PublicationComparisonItem={sourceLayer:"industry"|"company"|"asset"|"project";sourceContextKey?:string;changeKind:"inherited"|"add"|"override"|"retire";entityType:string;nativeIdentifier:string;inheritedName?:string;effectiveName?:string;rationale?:string};
export type PublicationComparison={contextId:number;contextKey:string;contextType:"company"|"asset"|"project";contextName:string;lineage:Array<{depth:number;contextKey:string;contextType:string;name:string;status:string}>;packagePins:Array<{contextKey:string;layerType:string;packageId:number;packageKey:string;precedence:number}>;items:PublicationComparisonItem[];summary:{inherited:number;added:number;overridden:number;retired:number;totalChanges:number};pendingCount:number;publishable:boolean};
export type PublishedRelease={releaseId:number;contextKey:string;releaseKey:string;releaseVersion:string;compositionSha256:string;publishedBy:string;publishedAt:string;comparisonSummary:PublicationComparison["summary"]};

export async function loadPublicationSession():Promise<PublicationSession|null>{
  try{const payload=await requestJson<unknown>("/api/publications/session");return isPublicationSession(payload)?payload:null;}catch{return null;}
}
export async function loadPublicationComparison(contextKey:string){const r=await requestJson<{comparison:PublicationComparison}>(`/api/publications/compare?context=${encodeURIComponent(contextKey)}`);return r.comparison;}
export async function loadPublishedReleases(contextKey=""){const r=await requestJson<{releases:PublishedRelease[]}>(`/api/publications/list?context=${encodeURIComponent(contextKey)}`);return r.releases;}
export async function publishEffectiveStandard(body:{contextKey:string;releaseKey:string;releaseVersion:string}){const r=await requestJson<{release:PublishedRelease}>("/api/publications/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return r.release;}
export function publicationPackageUrl(releaseId:number){return `/api/publications/package?id=${encodeURIComponent(String(releaseId))}`;}

function isPublicationSession(value:unknown):value is PublicationSession{
  if(!value||typeof value!=="object")return false;const c=value as Record<string,unknown>;
  return c.authenticated===true&&typeof c.reviewer==="string"&&c.reviewer.trim().length>0&&Array.isArray(c.roles)&&c.roles.every(r=>typeof r==="string")&&typeof c.authenticatedAt==="string"&&c.authenticatedAt.trim().length>0;
}
async function requestJson<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{Accept:"application/json",...(init?.headers??{})}});
  const contentType=response.headers.get("content-type")?.toLowerCase()??"";
  if(!contentType.includes("application/json"))throw new Error(`Expected JSON response from ${url}.`);
  const payload:unknown=await response.json();
  if(!response.ok){const message=payload&&typeof payload==="object"&&typeof (payload as Record<string,unknown>).error==="string"?String((payload as Record<string,unknown>).error):`Request failed (${response.status}).`;throw new Error(message);}
  return payload as T;
}
