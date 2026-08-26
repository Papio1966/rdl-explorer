import fs from "node:fs";
function read(path:string){return fs.readFileSync(path,"utf8")}
function must(ok:boolean,msg:string){if(!ok)throw new Error(`RDL-028 contract failed: ${msg}`)}
const migration=read("database/migrations/019_create_tenant_organization_isolation.sql");
const auth=read("server/auth/EnterpriseTenantContext.ts");
const repository=read("server/rdl/EnterpriseTenantRepository.ts");
const service=read("server/rdl/EnterpriseTenantService.ts");
const api=read("api/tenant/_shared.ts");
const browser=read("src/rdl/enterpriseTenantService.ts");
const page=read("src/pages/RdlTenantAdministrationPage.tsx");
const app=read("src/App.tsx");
const shell=read("src/components/AppShell.tsx");
const dbTest=read("database/sql/test_rdl_028_tenant_isolation.sql");
must(migration.includes("enterprise_organization")&&migration.includes("enterprise_organization_membership")&&migration.includes("enterprise_tenant_role_assignment"),"organization/membership/tenant role model missing");
must(migration.includes("enterprise_tenant_resource_binding")&&migration.includes("UNIQUE(resource_type,resource_key)"),"single-owner tenant resource binding missing");
must(migration.includes("assert_tenant_resource_access")&&migration.includes("cross-tenant access denied"),"database cross-tenant assertion missing");
must(migration.includes("enterprise_tenant_audit_event")&&migration.includes("append-only"),"append-only tenant audit missing");
must(auth.includes("x-rdl-organization-key")&&auth.includes("rdl-tenant-admin"),"tenant request scope and admin role missing");
must(service.includes("active member of this organization")&&service.includes("assertResourceAccess")&&service.includes("cannot remove their own active tenant membership"),"fail-closed membership/resource/SoD checks missing");
must(repository.includes("assert_tenant_resource_access")&&api.includes("authenticateEnterpriseSsoIdentity"),"server tenant boundary missing");
must(browser.includes("Expected JSON response.")&&browser.includes("validSession")&&browser.includes("validSummary"),"browser tenant client must fail closed");
must(page.includes("Read-only tenant demonstration")&&page.includes("Cross-tenant access is denied, not filtered after retrieval")&&page.includes("Global RDL stays global"),"tenant UX principles missing");
must(dbTest.includes("org_b")&&dbTest.includes("cross-tenant access denied")&&dbTest.includes("ROLLBACK"),"explicit cross-tenant DB denial test missing");
must(app.includes('/tenant-admin')&&shell.includes('Organizations & Tenancy'),"tenant route/navigation missing");
console.log("PASS RDL-028 tenant organization isolation and enterprise configuration contract");
