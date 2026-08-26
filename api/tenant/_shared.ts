import { EnterpriseIdentityError } from "../../server/auth/EnterpriseIdentity.ts";
import { requestedTenantScope,TenantIsolationError } from "../../server/auth/EnterpriseTenantContext.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { DatabaseRuntimeError } from "../../server/db/PgJsonClient.ts";
import { EnterpriseIdentityRepository } from "../../server/rdl/EnterpriseIdentityRepository.ts";
import { EnterpriseIdentityService } from "../../server/rdl/EnterpriseIdentityService.ts";
import { EnterpriseTenantRepository } from "../../server/rdl/EnterpriseTenantRepository.ts";
import { EnterpriseTenantService } from "../../server/rdl/EnterpriseTenantService.ts";
import { RuntimeConfigurationError,assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { authenticateEnterpriseSsoIdentity } from "../../server/auth/EnterpriseIdentity.ts";
import type {ApiRequest,ApiResponse} from "../governance/_shared.ts";
export type {ApiRequest,ApiResponse};
export async function tenantContext(request:ApiRequest){assertRuntimeEnvironment();const identity=authenticateEnterpriseSsoIdentity(request.headers);const client=getRdlDatabaseClient();const identityService=new EnterpriseIdentityService(new EnterpriseIdentityRepository(client));const identitySession=await identityService.session(identity);if(identitySession.status!=="active")throw new TenantIsolationError(403,"The enterprise identity is disabled.");const scope=requestedTenantScope(request.headers);const repository=new EnterpriseTenantRepository(client);const service=new EnterpriseTenantService(repository);return{identity,globalRoles:identitySession.roles,scope,repository,service}}
export function parseBody<T>(value:unknown):T{if(typeof value==="string")return JSON.parse(value) as T;if(value&&typeof value==="object"&&!Array.isArray(value))return value as T;throw new Error("A JSON request body is required.")}
export function handleTenantError(response:ApiResponse,error:unknown){if(error instanceof TenantIsolationError||error instanceof EnterpriseIdentityError){response.status(error.statusCode).json({error:error.message});return}if(error instanceof RuntimeConfigurationError||error instanceof DatabaseRuntimeError){response.status(503).json({error:"The enterprise tenant service is temporarily unavailable."});return}const message=error instanceof Error?error.message:"Unexpected tenant service error.";const status=/required|invalid|cannot|not found|duplicate|already/i.test(message)?400:500;response.status(status).json({error:status===500?"The enterprise tenant service could not complete the request.":message})}
