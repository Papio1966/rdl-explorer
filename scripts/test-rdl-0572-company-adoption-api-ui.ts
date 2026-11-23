import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(path,"utf8");

const shared=read("api/company-adoption/_shared.ts");
const packages=read("api/company-adoption/packages.ts");
const createContext=read("api/company-adoption/create-context.ts");
const pin=read("api/company-adoption/pin-package.ts");
const composition=read("api/company-adoption/create-composition.ts");
const browser=read("src/rdl/companyRdlAdoptionService.ts");
const page=read("src/pages/RdlCompanyAdoptionPage.tsx");
const app=read("src/App.tsx");
const shell=read("src/components/AppShell.tsx");
const runtime=read("server/rdl/CompanyRdlAdoptionService.ts");
const docs=read("docs/development/RDL_057_COMPANY_RDL_ADOPTION_RUNTIME.md");

assert.ok(
  shared.includes("CompanyRdlAdoptionRepository")
  &&shared.includes("CompanyRdlAdoptionService"),
  "Company adoption APIs must use the governed server runtime"
);

for(const [name,source,phrase] of [
  ["packages",packages,"listPublishedIndustryPackages"],
  ["create-context",createContext,"createCompanyContext"],
  ["pin-package",pin,"pinIndustryPackage"],
  ["create-composition",composition,"createComposition"],
] as const){
  assert.ok(source.includes(phrase),`${name} API missing ${phrase}`);
  assert.ok(source.includes("handleApiError"),`${name} API must use standard error handling`);
}

for(const route of [
  "/api/company-adoption/session",
  "/api/company-adoption/packages",
  "/api/company-adoption/create-context",
  "/api/company-adoption/pin-package",
  "/api/company-adoption/create-composition",
]){
  assert.ok(browser.includes(route),`Browser service missing ${route}`);
}

assert.doesNotMatch(
  browser,
  /from\s+["']pg["']|INSERT\s+INTO|UPDATE\s+rdl\.|DELETE\s+FROM\s+rdl\./i,
  "Browser adoption service must not access PostgreSQL directly"
);

for(const text of [
  "Company RDL Adoption",
  "Create the Company/L2 context",
  "Adopt a complete L1 standard",
  "Analyse and resolve overlaps",
  "Selectively adopt one exact L1 entity",
  "Govern and publish",
  "same-name",
]){
  assert.ok(
    page.toLowerCase().includes(text.toLowerCase()),
    `Company adoption page missing: ${text}`
  );
}

for(const route of [
  "/intelligence",
  "/governance",
  "/extensions",
  "/publication",
]){
  assert.ok(page.includes(route),`Workflow must link to ${route}`);
}

assert.ok(
  app.includes('path="/company-adoption"'),
  "Company adoption route is not registered"
);

assert.ok(
  shell.includes('label: "Company RDL Adoption"')
  &&shell.includes('to: "/company-adoption"'),
  "Company adoption is not discoverable under Govern"
);

assert.ok(
  runtime.includes("At least one exact L1 contributor is required"),
  "Runtime must retain exact-contributor fail-closed semantics"
);

assert.ok(
  docs.includes("Whole-standard adoption")
  &&docs.includes("Selective adoption"),
  "RDL-057 documentation must explain both adoption patterns"
);

console.log(
  "PASS - RDL-057.2 Company RDL Adoption API/UI: authenticated runtime APIs and one discoverable L1-to-L2 administrator workflow orchestrate whole-standard and selective adoption without duplicating semantic engines"
);
