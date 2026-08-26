import { createHmac, timingSafeEqual } from "node:crypto";
import type { HeaderBag } from "./GovernanceIdentity.ts";

export const IDENTITY_ADMIN_ROLE = "rdl-identity-admin";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type EnterpriseSsoIdentity = {
  subject: string;
  email: string;
  displayName: string;
  groups: string[];
  authenticatedAt: string;
};

export function signEnterpriseSsoIdentity(input: Omit<EnterpriseSsoIdentity,"authenticatedAt"> & { authenticatedAt:string }, secret:string) {
  return createHmac("sha256",secret).update(canonical(input)).digest("hex");
}

export function authenticateEnterpriseSsoIdentity(headers:HeaderBag|undefined,env:NodeJS.ProcessEnv=process.env,now=Date.now()):EnterpriseSsoIdentity {
  const secret=env.RDL_SSO_GATEWAY_SECRET?.trim();
  if(!secret) throw new EnterpriseIdentityError(503,"Enterprise SSO is not configured.");
  const subject=get(headers,"x-rdl-oidc-sub").trim();
  const email=get(headers,"x-rdl-oidc-email").trim();
  const displayName=get(headers,"x-rdl-oidc-name").trim();
  const authenticatedAt=get(headers,"x-rdl-oidc-timestamp").trim();
  const groups=normalize(get(headers,"x-rdl-oidc-groups").split(","));
  const supplied=get(headers,"x-rdl-oidc-signature").trim().toLowerCase();
  if(!subject||!email||!displayName||!authenticatedAt||!supplied) throw new EnterpriseIdentityError(401,"Trusted enterprise SSO claims are required.");
  const parsed=Date.parse(authenticatedAt);
  if(!Number.isFinite(parsed)||Math.abs(now-parsed)>MAX_CLOCK_SKEW_MS) throw new EnterpriseIdentityError(401,"Enterprise SSO assertion is stale or invalid.");
  const expected=signEnterpriseSsoIdentity({subject,email,displayName,groups,authenticatedAt},secret);
  if(!safeEqual(supplied,expected)) throw new EnterpriseIdentityError(401,"Enterprise SSO assertion signature is invalid.");
  return {subject,email,displayName,groups,authenticatedAt};
}

export class EnterpriseIdentityError extends Error { constructor(readonly statusCode:number,message:string){super(message)} }
function canonical(v:EnterpriseSsoIdentity){return `${v.subject.trim()}\n${v.email.trim().toLowerCase()}\n${v.displayName.trim()}\n${normalize(v.groups).join(",")}\n${v.authenticatedAt.trim()}`}
function normalize(v:string[]){return [...new Set(v.map(x=>x.trim().toLowerCase()).filter(Boolean))].sort()}
function safeEqual(a:string,b:string){if(!/^[0-9a-f]{64}$/i.test(a)||!/^[0-9a-f]{64}$/i.test(b))return false;const x=Buffer.from(a,"hex"),y=Buffer.from(b,"hex");return x.length===y.length&&timingSafeEqual(x,y)}
function get(headers:HeaderBag|undefined,name:string){if(!headers)return"";const direct=headers[name];if(direct!==undefined)return Array.isArray(direct)?direct[0]??"":direct;const e=Object.entries(headers).find(([k])=>k.toLowerCase()===name);const v=e?.[1];return Array.isArray(v)?v[0]??"":v??""}
