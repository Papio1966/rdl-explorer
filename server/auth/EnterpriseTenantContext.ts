import type { HeaderBag } from "./GovernanceIdentity.ts";
import type { EnterpriseSsoIdentity } from "./EnterpriseIdentity.ts";

export const TENANT_ADMIN_ROLE = "rdl-tenant-admin";
export type TenantRequestScope={organizationKey:string};

export function requestedTenantScope(headers:HeaderBag|undefined):TenantRequestScope{
  const organizationKey=get(headers,"x-rdl-organization-key").trim().toLowerCase();
  if(!organizationKey)throw new TenantIsolationError(400,"An enterprise organization scope is required.");
  if(!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(organizationKey))throw new TenantIsolationError(400,"The enterprise organization key is invalid.");
  return{organizationKey};
}

export function assertTenantActor(identity:EnterpriseSsoIdentity,subjectKey:string){
  if(identity.subject!==subjectKey)throw new TenantIsolationError(403,"Tenant actor identity does not match the trusted SSO subject.");
}

export class TenantIsolationError extends Error{constructor(readonly statusCode:number,message:string){super(message)}}
function get(headers:HeaderBag|undefined,name:string){if(!headers)return"";const direct=headers[name];if(direct!==undefined)return Array.isArray(direct)?direct[0]??"":direct;const entry=Object.entries(headers).find(([key])=>key.toLowerCase()===name);const value=entry?.[1];return Array.isArray(value)?value[0]??"":value??""}
