import { beginApiRequest,completeApiRequest } from "../_runtime.ts";
import { authenticateEnterpriseSsoIdentity } from "../../server/auth/EnterpriseIdentity.ts";
import { TenantIsolationError } from "../../server/auth/EnterpriseTenantContext.ts";
import { getRdlDatabaseClient } from "../../server/db/runtime.ts";
import { EnterpriseIdentityRepository } from "../../server/rdl/EnterpriseIdentityRepository.ts";
import { EnterpriseIdentityService } from "../../server/rdl/EnterpriseIdentityService.ts";
import { EnterpriseTenantRepository } from "../../server/rdl/EnterpriseTenantRepository.ts";
import { EnterpriseTenantService } from "../../server/rdl/EnterpriseTenantService.ts";
import { assertRuntimeEnvironment } from "../../server/runtime/environment.ts";
import { handleTenantError,parseBody,type ApiRequest,type ApiResponse } from "./_shared.ts";
export default async function handler(request:ApiRequest,response:ApiResponse){const context=beginApiRequest(request,response,"tenant.organizations");try{assertRuntimeEnvironment();const identity=authenticateEnterpriseSsoIdentity(request.headers);const client=getRdlDatabaseClient();const identityService=new EnterpriseIdentityService(new EnterpriseIdentityRepository(client));const session=await identityService.session(identity);if(session.status!=="active")throw new TenantIsolationError(403,"The enterprise identity is disabled.");const service=new EnterpriseTenantService(new EnterpriseTenantRepository(client));if(request.method==="GET"){const organizations=await service.accessibleOrganizations(identity);completeApiRequest(context,200);response.status(200).json({contract:"rdl-enterprise-organization-list/v1",organizations});return}if(request.method==="POST"){const body=parseBody<{organizationKey:string;displayName:string;rationale:string}>(request.body);const result=await service.createOrganization(identity,session.roles,body);completeApiRequest(context,201);response.status(201).json({contract:"rdl-enterprise-organization-admin/v1",result});return}completeApiRequest(context,405);response.status(405).json({error:"Method not allowed."})}catch(error){handleTenantError(response,error)}}
