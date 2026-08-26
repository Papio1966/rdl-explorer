import fs from "node:fs";
function read(path:string){return fs.readFileSync(path,"utf8")}
function must(ok:boolean,msg:string){if(!ok)throw new Error(`RDL-027 contract failed: ${msg}`)}
const migration=read("database/migrations/018_create_enterprise_identity_role_administration.sql");
const auth=read("server/auth/EnterpriseIdentity.ts");
const service=read("server/rdl/EnterpriseIdentityService.ts");
const api=read("api/identity/_shared.ts");
const browser=read("src/rdl/enterpriseIdentityService.ts");
const page=read("src/pages/RdlIdentityAdministrationPage.tsx");
const app=read("src/App.tsx");
const shell=read("src/components/AppShell.tsx");
const env=read(".env.example");
must(migration.includes("enterprise_identity_user")&&migration.includes("enterprise_role_assignment")&&migration.includes("enterprise_group_role_mapping"),"identity/role/group persistence missing");
must(migration.includes("enterprise_identity_audit_event")&&migration.includes("append-only"),"append-only identity audit missing");
must(auth.includes("x-rdl-oidc-sub")&&auth.includes("x-rdl-oidc-signature")&&auth.includes("RDL_SSO_GATEWAY_SECRET"),"trusted OIDC gateway boundary missing");
must(auth.includes("rdl-identity-admin")&&service.includes("cannot grant the identity-admin role to themselves")&&service.includes("cannot disable their own account"),"separation-of-duties controls missing");
must(api.includes("RDL_IDENTITY_BOOTSTRAP_ADMINS"),"controlled bootstrap admin boundary missing");
must(browser.includes('content-type')&&browser.includes('Expected JSON response.')&&browser.includes('validSession')&&browser.includes('validSummary'),"browser identity client must fail closed");
must(page.includes("Read-only identity demonstration")&&page.includes("No automatic privilege promotion")&&page.includes("OIDC at the enterprise boundary"),"identity UX principles missing");
must(app.includes('/identity-admin')&&shell.includes('Identity & Access'),"identity route/navigation missing");
must(env.includes("RDL_SSO_GATEWAY_SECRET")&&env.includes("RDL_IDENTITY_BOOTSTRAP_ADMINS"),"enterprise SSO environment contract missing");
console.log("PASS RDL-027 enterprise SSO user identity and role administration contract");
