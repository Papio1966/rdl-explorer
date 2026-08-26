import type { EnterpriseWorkQueueRepository, WorkItemAction } from "./EnterpriseWorkQueueRepository.ts";

const SOURCE_TYPES = new Set(["extension_review","consumer_notification","migration_plan","release_impact","publication","other"]);
const PRIORITIES = new Set(["normal","high","critical"]);

export class EnterpriseWorkQueueService {
  constructor(private readonly repository: EnterpriseWorkQueueRepository) {}

  inbox(actor: string, limit = 100) {
    return this.repository.inbox(requiredText(actor, "actor"), finiteLimit(limit));
  }

  team(limit = 100) {
    return this.repository.team(finiteLimit(limit));
  }

  item(workItemId: number) {
    validId(workItemId, "workItemId");
    return this.repository.item(workItemId);
  }

  create(input: { workKey: string; sourceType: string; sourceRecordKey: string; scopeKey?: string; title: string; summary?: string; drillThroughPath: string; assigneeKey?: string; priority?: string; dueAt?: string; createdBy: string }) {
    const sourceType = requiredText(input.sourceType, "sourceType");
    if (!SOURCE_TYPES.has(sourceType)) throw new Error("Invalid sourceType.");
    const priority = input.priority ?? "normal";
    if (!PRIORITIES.has(priority)) throw new Error("Invalid priority.");
    const path = requiredText(input.drillThroughPath, "drillThroughPath");
    if (!path.startsWith("/")) throw new Error("drillThroughPath must be an application route.");
    return this.repository.create({
      ...input,
      workKey: requiredText(input.workKey, "workKey"),
      sourceType,
      sourceRecordKey: requiredText(input.sourceRecordKey, "sourceRecordKey"),
      title: requiredText(input.title, "title"),
      drillThroughPath: path,
      priority,
      createdBy: requiredText(input.createdBy, "createdBy"),
    });
  }

  async transition(workItemId: number, action: WorkItemAction, actor: string, rationale: string, expectedVersion: number) {
    validId(workItemId, "workItemId"); validVersion(expectedVersion);
    if (!["acknowledge","start","complete","dismiss","reopen"].includes(action)) throw new Error("Invalid work item action.");
    const actorKey = requiredText(actor, "actor");
    if (["acknowledge","start","complete"].includes(action)) {
      const current = await this.repository.item(workItemId);
      if (!current) throw new Error("Work item does not exist.");
      const assignee = String(current.item.assignee_key ?? "").trim();
      if (assignee && assignee !== actorKey) throw new Error("Only the assigned reviewer can progress this work item.");
    }
    const rows = await this.repository.transition(workItemId, action, actorKey, requiredText(rationale, "rationale"), expectedVersion);
    return rows[0] ?? null;
  }

  assign(workItemId: number, assignee: string, actor: string, rationale: string, expectedVersion: number) {
    validId(workItemId, "workItemId"); validVersion(expectedVersion);
    return this.repository.assign(workItemId, requiredText(assignee, "assignee"), requiredText(actor, "actor"), requiredText(rationale, "rationale"), expectedVersion).then(rows => rows[0] ?? null);
  }

  remind(workItemId: number, actor: string, rationale: string, escalate: boolean, expectedVersion: number) {
    validId(workItemId, "workItemId"); validVersion(expectedVersion);
    return this.repository.remind(workItemId, requiredText(actor, "actor"), requiredText(rationale, "rationale"), Boolean(escalate), expectedVersion).then(rows => rows[0] ?? null);
  }
}

function requiredText(value: string, name: string) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${name} is required.`); return text; }
function validId(value: number, name: string) { if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`A valid ${name} is required.`); }
function validVersion(value: number) { if (!Number.isSafeInteger(value) || value <= 0) throw new Error("A valid expectedVersion is required."); }
function finiteLimit(value: number) { return Number.isFinite(value) ? value : 100; }
