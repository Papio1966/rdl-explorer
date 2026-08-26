export type ExtensionSession={authenticated:true;reviewer:string;roles:string[];authenticatedAt:string};
export type ExtensionItem={extensionChangeId:number;contextKey:string;contextType:"company"|"asset"|"project";contextName:string;changeKind:"add"|"override"|"retire";entityType:string;nativeIdentifier:string;baseEntityId?:number;proposedName?:string;proposedDefinition?:string;status:string;rationale:string;proposedBy?:string;proposedAt:string;reviewVersion:number;reviewedBy?:string;reviewRationale?:string};
export type ExtensionPreview={extension:ExtensionItem;inherited?:{entityId:number;entityType:string;nativeIdentifier:string;name:string;definition?:string;packageKey:string};effective:{retired:boolean;name?:string;definition?:string};conflicts:Array<{extensionChangeId:number;contextKey:string;contextType:string;changeKind:string;status:string;proposedName?:string;rationale:string}>;publishable:boolean};

export async function loadExtensionSession():Promise<ExtensionSession|null>{
  try{
    const payload=await requestJson<unknown>("/api/extensions/session");
    return isExtensionSession(payload)?payload:null;
  }catch{
    return null;
  }
}

export async function loadExtensionQueue(status="in_review"){const r=await requestJson<{items:ExtensionItem[]}>(`/api/extensions/queue?status=${encodeURIComponent(status)}`);return r.items;}
export async function createExtension(body:Record<string,unknown>){const r=await requestJson<{item:ExtensionItem}>("/api/extensions/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return r.item;}
export async function reviewExtension(body:{extensionChangeId:number;action:"submit"|"approve"|"reject"|"retire";rationale:string;expectedVersion:number}){return requestJson("/api/extensions/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
export async function promoteExtension(body:{extensionChangeId:number;targetContextKey:string;rationale:string}){const r=await requestJson<{item:ExtensionItem}>("/api/extensions/promote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return r.item;}
export async function publishEffectiveContext(body:{contextKey:string;effectivePackageId:number}){return requestJson("/api/extensions/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
export async function loadExtensionPreview(id:number){const r=await requestJson<{preview:ExtensionPreview}>(`/api/extensions/preview?id=${id}`);return r.preview;}

function isExtensionSession(value:unknown):value is ExtensionSession{
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

async function requestJson<T=unknown>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{Accept:"application/json",...(init?.headers??{})}});
  const contentType=response.headers.get("content-type")?.toLowerCase()??"";

  if(!contentType.includes("application/json")){
    throw new Error(`Expected JSON response from ${url}.`);
  }

  const payload:unknown=await response.json();
  if(!response.ok){
    const message=payload&&typeof payload==="object"&&typeof (payload as Record<string,unknown>).error==="string"
      ?String((payload as Record<string,unknown>).error)
      :`Request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}
