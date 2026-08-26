import fs from "node:fs";
function read(path:string){return fs.readFileSync(path,"utf8")}
function must(ok:boolean,msg:string){if(!ok)throw new Error(`RDL-026 contract failed: ${msg}`)}
const migration=read("database/migrations/017_create_ai_evaluation_feedback_trust_controls.sql");
const apiSummary=read("api/ai-trust/summary.ts");
const apiFeedback=read("api/ai-trust/feedback.ts");
const browser=read("src/rdl/aiTrustService.ts");
const page=read("src/pages/RdlAiTrustPage.tsx");
const aiPage=read("src/pages/RdlAiStandardsIntelligencePage.tsx");
const askApi=read("api/ai-intelligence/ask.ts");
const app=read("src/App.tsx");
const shell=read("src/components/AppShell.tsx");
must(migration.includes("ai_feedback")&&migration.includes("ai_evaluation_case")&&migration.includes("ai_evaluation_result"),"feedback/evaluation persistence missing");
must(migration.includes("ai_trust_metrics")&&migration.includes("append-only"),"trust metrics or append-only controls missing");
must(migration.includes("prompt_version")&&askApi.includes("PROMPT_VERSION"),"prompt-version tracking missing");
must(apiSummary.includes("rdl-ai-trust/v1")&&apiFeedback.includes("rdl-ai-feedback/v1"),"trust API contracts missing");
must(browser.includes('content-type')&&browser.includes('Expected JSON response.')&&browser.includes('validSession')&&browser.includes('validSummary'),"browser must fail closed on malformed/non-JSON trust responses");
must(page.includes("Read-only trust demonstration")&&page.includes("No automatic promotion")&&page.includes("Unsupported claims are visible"),"trust UX principles missing");
must(aiPage.includes("submitAiFeedback")&&aiPage.includes("Helpful")&&aiPage.includes("Incomplete")&&aiPage.includes("Incorrect"),"answer feedback UX missing");
must(app.includes('/ai-trust')&&shell.includes('AI Trust & Evaluation'),"route/navigation missing");
console.log("PASS RDL-026 AI evaluation, feedback and trust controls contract");
