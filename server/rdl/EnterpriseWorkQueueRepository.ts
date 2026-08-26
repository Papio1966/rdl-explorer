import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type WorkItemStatus = "open" | "acknowledged" | "in_progress" | "completed" | "dismissed";
export type WorkItemAction = "acknowledge" | "start" | "complete" | "dismiss" | "reopen";

export class EnterpriseWorkQueueRepository {
  constructor(private readonly client: SqlJsonClient) {}

  inbox(assignee: string, limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    return this.client.query<any>(`SELECT * FROM rdl.enterprise_work_queue_summary
      WHERE assignee_key=${sqlLiteral(assignee)} AND status NOT IN ('completed','dismissed')
      ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
               CASE sla_state WHEN 'overdue' THEN 1 WHEN 'due_soon' THEN 2 ELSE 3 END,
               due_at NULLS LAST, created_at
      LIMIT ${safeLimit}`);
  }

  team(limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    return this.client.query<any>(`SELECT * FROM rdl.enterprise_work_queue_summary
      WHERE status NOT IN ('completed','dismissed')
      ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
               CASE sla_state WHEN 'overdue' THEN 1 WHEN 'due_soon' THEN 2 ELSE 3 END,
               due_at NULLS LAST, created_at
      LIMIT ${safeLimit}`);
  }

  async item(workItemId: number) {
    const rows = await this.client.query<any>(`SELECT * FROM rdl.enterprise_work_queue_summary WHERE work_item_id=${workItemId}`);
    if (!rows[0]) return null;
    const events = await this.client.query<any>(`SELECT * FROM rdl.enterprise_work_item_event WHERE work_item_id=${workItemId} ORDER BY work_item_event_id`);
    return { item: rows[0], events };
  }

  async create(input: { workKey: string; sourceType: string; sourceRecordKey: string; scopeKey?: string; title: string; summary?: string; drillThroughPath: string; assigneeKey?: string; priority: string; dueAt?: string; createdBy: string }) {
    const rows = await this.client.query<any>(`INSERT INTO rdl.enterprise_work_item(work_key,source_type,source_record_key,scope_key,title,summary,drill_through_path,assignee_key,priority,due_at,created_by)
      VALUES(${sqlLiteral(input.workKey)},${sqlLiteral(input.sourceType)},${sqlLiteral(input.sourceRecordKey)},${input.scopeKey ? sqlLiteral(input.scopeKey) : "NULL"},${sqlLiteral(input.title)},${input.summary ? sqlLiteral(input.summary) : "NULL"},${sqlLiteral(input.drillThroughPath)},${input.assigneeKey ? sqlLiteral(input.assigneeKey) : "NULL"},${sqlLiteral(input.priority)},${input.dueAt ? sqlLiteral(input.dueAt) : "NULL"}::timestamptz,${sqlLiteral(input.createdBy)})
      RETURNING *`);
    const row = rows[0];
    await this.client.query(`INSERT INTO rdl.enterprise_work_item_event(work_item_id,event_type,actor_key,rationale) VALUES(${Number(row.work_item_id)},'created',${sqlLiteral(input.createdBy)},'Work item created') RETURNING work_item_event_id`);
    return row;
  }

  transition(workItemId: number, action: WorkItemAction, actor: string, rationale: string, expectedVersion: number) {
    return this.client.query<any>(`SELECT * FROM rdl.transition_enterprise_work_item(${workItemId},${sqlLiteral(action)},${sqlLiteral(actor)},${sqlLiteral(rationale)},${expectedVersion})`);
  }

  assign(workItemId: number, assignee: string, actor: string, rationale: string, expectedVersion: number) {
    return this.client.query<any>(`SELECT * FROM rdl.assign_enterprise_work_item(${workItemId},${sqlLiteral(assignee)},${sqlLiteral(actor)},${sqlLiteral(rationale)},${expectedVersion})`);
  }

  remind(workItemId: number, actor: string, rationale: string, escalate: boolean, expectedVersion: number) {
    return this.client.query<any>(`SELECT * FROM rdl.remind_enterprise_work_item(${workItemId},${sqlLiteral(actor)},${sqlLiteral(rationale)},${escalate ? "true" : "false"},${expectedVersion})`);
  }
}
