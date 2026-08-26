import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("database/migrations/015_create_enterprise_notifications_work_queue.sql");
const repository = read("server/rdl/EnterpriseWorkQueueRepository.ts");
const service = read("server/rdl/EnterpriseWorkQueueService.ts");
const browser = read("src/rdl/workQueueService.ts");
const page = read("src/pages/RdlWorkQueuePage.tsx");
const app = read("src/App.tsx");
const shell = read("src/components/AppShell.tsx");
const apiShared = read("api/work-queue/_shared.ts");
const workflow = read(".github/workflows/build.yml");
const dbTest = read("database/sql/test_rdl_024_work_queue.sql");

assert.ok(migration.includes("enterprise_work_item") && migration.includes("enterprise_work_item_event"), "RDL-024 must persist durable work items and append-only operational events");
assert.ok(migration.includes("enterprise_work_queue_summary") && migration.includes("sla_state") && migration.includes("age_hours"), "RDL-024 must derive SLA and aging signals");
assert.ok(migration.includes("transition_enterprise_work_item") && migration.includes("assign_enterprise_work_item") && migration.includes("remind_enterprise_work_item"), "RDL-024 must govern work-item transitions, assignment and reminders");
assert.ok(migration.includes("never approve, publish, stage, activate or migrate") || migration.includes("never change governed lifecycle state"), "RDL-024 must preserve governance ownership boundaries");
assert.ok(repository.includes("enterprise_work_queue_summary") && repository.includes("remind_enterprise_work_item"), "RDL-024 repository must use the database work-queue contract");
assert.ok(service.includes("drillThroughPath") && service.includes("Invalid sourceType") && service.includes("expectedVersion"), "RDL-024 service must validate work-item inputs and optimistic versioning");
assert.ok(apiShared.includes("WORK_QUEUE_COORDINATOR_ROLE") && apiShared.includes("GOVERNANCE_REVIEWER_ROLE"), "RDL-024 must separate reviewer access from coordination authority");
assert.ok(browser.includes("validSession") && browser.includes("validPayload") && browser.includes("content-type"), "RDL-024 browser client must fail closed on invalid session/data and SPA fallback responses");
assert.ok(page.includes("Enterprise notifications & work queue") && page.includes("Read-only work queue demonstration") && page.includes("Personal inbox, not an approval engine"), "RDL-024 UX must expose honest fail-closed orchestration semantics");
assert.ok(page.includes('tabIndex={0}') && page.includes('aria-label="Enterprise standards reviewer work queue"'), "RDL-024 work table must be keyboard focusable and labelled");
assert.ok(app.includes('path="/work-queue"') && shell.includes("My Work Queue"), "RDL-024 work queue must be routed and discoverable");
assert.ok(workflow.includes("npm run test:rdl-024"), "RDL-024 contract must run in CI");
assert.ok(dbTest.includes("RDL-024 enterprise notifications and work queue") && dbTest.includes("ROLLBACK"), "RDL-024 database acceptance test must be self-contained and rollback fixtures");

console.log("PASS RDL-024 enterprise notifications and work queue contract");
