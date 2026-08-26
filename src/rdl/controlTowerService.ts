export type ControlTowerSession = {
  authenticated: true;
  reviewer: string;
  roles: string[];
  authenticatedAt: string;
  contract: "rdl-enterprise-control-tower/v1";
};

export type ControlTowerKpis = {
  active_context_count: number;
  draft_context_count: number;
  pending_extension_review_count: number;
  published_release_count: number;
  active_distribution_count: number;
  enabled_consumer_count: number;
  unacknowledged_notification_count: number;
  pending_consumer_adoption_count: number;
  release_analysis_count: number;
  open_migration_plan_count: number;
  blocked_migration_plan_count: number;
  open_breaking_action_count: number;
  overdue_migration_action_count: number;
};

export type ControlTowerQueueItem = {
  queue_type: "extension_review" | "migration_plan" | "consumer_notification";
  queue_item_id: number;
  scope_key: string;
  scope_name: string;
  title: string;
  status: string;
  owner_key?: string | null;
  due_date?: string | null;
  priority: "blocked" | "overdue" | "review_required" | "normal";
  created_at?: string | null;
  drill_through_path: string;
};

export type ControlTowerRelease = {
  release_id: number;
  context_key: string;
  context_type: string;
  context_name: string;
  release_key: string;
  release_version: string;
  lifecycle_status?: string | null;
  published_at: string;
  subscribed_consumer_count: number;
  discovered_consumer_count: number;
  staged_consumer_count: number;
  activated_consumer_count: number;
  unacknowledged_notification_count: number;
};

export type ControlTowerAdoption = {
  subscription_id: number;
  consumer_key: string;
  context_key?: string | null;
  enabled: boolean;
  tracked_release_count: number;
  discovered_count: number;
  staged_count: number;
  activated_count: number;
  rejected_count: number;
  unacknowledged_notification_count: number;
};

export type ControlTowerMigration = {
  migration_plan_id: number;
  subject_type: "consumer" | "project";
  subject_key: string;
  title: string;
  owner_key: string;
  due_date?: string | null;
  readiness_status: string;
  lifecycle_status: string;
  from_release_key: string;
  from_release_version: string;
  to_release_key: string;
  to_release_version: string;
  action_count: number;
  open_action_count: number;
  breaking_action_count: number;
};

export type ControlTowerDashboard = {
  schemaVersion: "rdl-enterprise-control-tower/v1";
  generatedAt: string;
  health: "healthy" | "attention" | "critical";
  kpis: ControlTowerKpis;
  queue: ControlTowerQueueItem[];
  releases: ControlTowerRelease[];
  adoption: ControlTowerAdoption[];
  migrations: ControlTowerMigration[];
};

export async function loadControlTowerSession(): Promise<ControlTowerSession | null> {
  try {
    const value = await requestJson<unknown>("/api/control-tower/session");
    return validSession(value) ? value : null;
  } catch {
    return null;
  }
}

export async function loadControlTowerDashboard(): Promise<ControlTowerDashboard | null> {
  try {
    const value = await requestJson<unknown>("/api/control-tower/dashboard?limit=25");
    return validDashboard(value) ? value : null;
  } catch {
    return null;
  }
}

function validSession(value: unknown): value is ControlTowerSession {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return o.authenticated === true &&
    typeof o.reviewer === "string" && o.reviewer.trim().length > 0 &&
    Array.isArray(o.roles) && o.roles.every((role) => typeof role === "string") &&
    typeof o.authenticatedAt === "string" && o.authenticatedAt.trim().length > 0 &&
    o.contract === "rdl-enterprise-control-tower/v1";
}

function validDashboard(value: unknown): value is ControlTowerDashboard {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.schemaVersion !== "rdl-enterprise-control-tower/v1") return false;
  if (typeof o.generatedAt !== "string" || !o.generatedAt.trim()) return false;
  if (!new Set(["healthy", "attention", "critical"]).has(String(o.health))) return false;
  if (!o.kpis || typeof o.kpis !== "object") return false;
  if (!Array.isArray(o.queue) || !Array.isArray(o.releases) || !Array.isArray(o.adoption) || !Array.isArray(o.migrations)) return false;
  const kpis = o.kpis as Record<string, unknown>;
  const requiredKpis = [
    "active_context_count", "pending_extension_review_count", "published_release_count",
    "enabled_consumer_count", "unacknowledged_notification_count", "open_migration_plan_count",
    "blocked_migration_plan_count", "open_breaking_action_count", "overdue_migration_action_count",
  ];
  return requiredKpis.every((key) => Number.isFinite(Number(kpis[key])));
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) throw new Error("Expected JSON response.");
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string"
      ? String((payload as Record<string, unknown>).error)
      : "Control tower request failed.";
    throw new Error(message);
  }
  return payload as T;
}
