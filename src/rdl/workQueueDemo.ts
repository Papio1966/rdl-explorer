import type { WorkQueuePayload } from "./workQueueService";

export const WORK_QUEUE_DEMO: WorkQueuePayload = {
  schemaVersion: "rdl-enterprise-work-queue/v1",
  generatedAt: "2026-08-26T12:00:00.000Z",
  reviewer: "demo.reviewer@example.com",
  items: [
    {
      work_item_id: 24001, work_key: "extension_review:demo-17", source_type: "extension_review", source_record_key: "demo-17", scope_key: "COMPANY-RDL",
      title: "Review proposed vacuum toilet class", summary: "Company standards review requested after project extension approval.", drill_through_path: "/extensions",
      assignee_key: "standards.reviewer@example.com", status: "open", priority: "high", due_at: "2026-08-27T12:00:00.000Z", reminder_count: 1, escalation_level: 0, expected_version: 2, age_hours: 31, sla_state: "due_soon",
    },
    {
      work_item_id: 24002, work_key: "migration_plan:demo-4", source_type: "migration_plan", source_record_key: "demo-4", scope_key: "FPSO-A",
      title: "Approve migration to Company RDL 3.2", summary: "Breaking property retirement requires explicit migration approval.", drill_through_path: "/migration",
      assignee_key: "migration.approver@example.com", status: "acknowledged", priority: "critical", due_at: "2026-08-25T12:00:00.000Z", reminder_count: 2, escalation_level: 1, expected_version: 4, age_hours: 56, sla_state: "overdue",
    },
    {
      work_item_id: 24003, work_key: "consumer_notification:demo-9", source_type: "consumer_notification", source_record_key: "demo-9", scope_key: "DATAGATE",
      title: "Review newly published release", summary: "Consumer notification acknowledged; package pull remains explicit.", drill_through_path: "/integration",
      assignee_key: "datagate.owner@example.com", status: "in_progress", priority: "normal", due_at: null, reminder_count: 0, escalation_level: 0, expected_version: 3, age_hours: 8, sla_state: "no_sla",
    },
  ],
};
