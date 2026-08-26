import type { ControlTowerDashboard } from "./controlTowerService";

export const CONTROL_TOWER_DEMO: ControlTowerDashboard = {
  schemaVersion: "rdl-enterprise-control-tower/v1",
  generatedAt: "2026-08-26T12:00:00.000Z",
  health: "attention",
  kpis: {
    active_context_count: 8,
    draft_context_count: 3,
    pending_extension_review_count: 4,
    published_release_count: 12,
    active_distribution_count: 9,
    enabled_consumer_count: 6,
    unacknowledged_notification_count: 5,
    pending_consumer_adoption_count: 4,
    release_analysis_count: 7,
    open_migration_plan_count: 3,
    blocked_migration_plan_count: 1,
    open_breaking_action_count: 2,
    overdue_migration_action_count: 1,
  },
  queue: [
    { queue_type: "migration_plan", queue_item_id: 42, scope_key: "datagate-project-alpha", scope_name: "DataGate Project Alpha", title: "Adopt project-alpha-effective 1.2.0", status: "in_review", owner_key: "project-alpha-owner", due_date: "2026-09-03", priority: "blocked", created_at: "2026-08-25T09:00:00Z", drill_through_path: "/migration" },
    { queue_type: "extension_review", queue_item_id: 18, scope_key: "asset-north-sea", scope_name: "North Sea Asset", title: "add tag_class vacuum-toilet", status: "in_review", owner_key: "asset-engineering", priority: "review_required", created_at: "2026-08-25T12:00:00Z", drill_through_path: "/extensions" },
    { queue_type: "consumer_notification", queue_item_id: 73, scope_key: "datagate", scope_name: "DataGate", title: "release.published · company-effective · 3.4.0", status: "discovered", owner_key: "datagate", priority: "normal", created_at: "2026-08-26T08:30:00Z", drill_through_path: "/integration" },
  ],
  releases: [
    { release_id: 12, context_key: "company-global", context_type: "company", context_name: "Company Global RDL", release_key: "company-effective", release_version: "3.4.0", lifecycle_status: "active", published_at: "2026-08-26T08:00:00Z", subscribed_consumer_count: 4, discovered_consumer_count: 1, staged_consumer_count: 1, activated_consumer_count: 2, unacknowledged_notification_count: 2 },
    { release_id: 11, context_key: "asset-north-sea", context_type: "asset", context_name: "North Sea Asset RDL", release_key: "north-sea-effective", release_version: "2.1.0", lifecycle_status: "active", published_at: "2026-08-24T10:00:00Z", subscribed_consumer_count: 2, discovered_consumer_count: 0, staged_consumer_count: 0, activated_consumer_count: 2, unacknowledged_notification_count: 0 },
  ],
  adoption: [
    { subscription_id: 1, consumer_key: "datagate", context_key: "company-global", enabled: true, tracked_release_count: 4, discovered_count: 1, staged_count: 1, activated_count: 2, rejected_count: 0, unacknowledged_notification_count: 2 },
    { subscription_id: 2, consumer_key: "project-alpha", context_key: "asset-north-sea", enabled: true, tracked_release_count: 2, discovered_count: 0, staged_count: 0, activated_count: 2, rejected_count: 0, unacknowledged_notification_count: 0 },
  ],
  migrations: [
    { migration_plan_id: 42, subject_type: "project", subject_key: "datagate-project-alpha", title: "Adopt project-alpha-effective 1.2.0", owner_key: "project-alpha-owner", due_date: "2026-09-03", readiness_status: "blocked", lifecycle_status: "in_review", from_release_key: "project-alpha-effective", from_release_version: "1.1.0", to_release_key: "project-alpha-effective", to_release_version: "1.2.0", action_count: 5, open_action_count: 2, breaking_action_count: 1 },
    { migration_plan_id: 43, subject_type: "consumer", subject_key: "datagate", title: "Adopt company-effective 3.4.0", owner_key: "datagate-owner", readiness_status: "ready", lifecycle_status: "approved", from_release_key: "company-effective", from_release_version: "3.3.0", to_release_key: "company-effective", to_release_version: "3.4.0", action_count: 3, open_action_count: 0, breaking_action_count: 0 },
  ],
};
