import fs from "node:fs";
function read(path:string){return fs.readFileSync(path,"utf8")}
function must(ok:boolean,msg:string){if(!ok)throw new Error(`RDL-025 contract failed: ${msg}`)}
const migration=read("database/migrations/016_create_ai_assisted_standards_intelligence.sql");
const api=read("api/ai-intelligence/ask.ts");
const browser=read("src/rdl/aiStandardsIntelligenceService.ts");
const page=read("src/pages/RdlAiStandardsIntelligencePage.tsx");
const identity=read("server/auth/GovernanceIdentity.ts");
const app=read("src/App.tsx");
const shell=read("src/components/AppShell.tsx");
must(migration.includes("ai_advisory_run")&&migration.includes("immutable"),"immutable advisory audit missing");
must(identity.includes("rdl-ai-standards-analyst"),"dedicated analyst role missing");
must(api.includes("Answer only from the supplied governed evidence"),"evidence-only model instruction missing");
must(api.includes("auto-approve")&&api.includes("auto-migrate"),"AI governance guardrails missing");
must(browser.includes('content-type')&&browser.includes('Expected JSON response.'),"browser must reject SPA/non-JSON fallback");
must(browser.includes('validSession')&&browser.includes('validAnswer'),"browser response-shape validation missing");
must(page.includes("Read-only demonstration mode")&&page.includes("Governance guardrails"),"honest demo/advisory UX missing");
must(app.includes('/ai-intelligence')&&shell.includes('AI Standards Intelligence'),"route/navigation missing");
console.log("PASS RDL-025 AI-assisted standards intelligence contract");
