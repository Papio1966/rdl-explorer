export type WorkQueueSession = {
  authenticated: true;
  reviewer: string;
  roles: string[];
  authenticatedAt: string;
  contract: "rdl-enterprise-work-queue/v1";
  canCoordinate: boolean;
};

export type WorkQueueItem = {
  work_item_id: number;
  work_key: string;
  source_type: string;
  source_record_key: string;
  scope_key?: string | null;
  title: string;
  summary?: string | null;
  drill_through_path: string;
  assignee_key?: string | null;
  status: "open" | "acknowledged" | "in_progress" | "completed" | "dismissed";
  priority: "normal" | "high" | "critical";
  due_at?: string | null;
  reminder_count: number;
  escalation_level: number;
  expected_version: number;
  age_hours: number;
  sla_state: "closed" | "no_sla" | "overdue" | "due_soon" | "within_sla";
};

export type WorkQueuePayload = {
  schemaVersion: "rdl-enterprise-work-queue/v1";
  generatedAt: string;
  reviewer?: string;
  items: WorkQueueItem[];
};

export async function loadWorkQueueSession(): Promise<WorkQueueSession | null> {
  try {
    const value = await requestJson<unknown>("/api/work-queue/session");
    return validSession(value) ? value : null;
  } catch { return null; }
}

export async function loadWorkQueueInbox(): Promise<WorkQueuePayload | null> {
  try {
    const value = await requestJson<unknown>("/api/work-queue/inbox?limit=100");
    return validPayload(value) ? value : null;
  } catch { return null; }
}

function validSession(value: unknown): value is WorkQueueSession {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return o.authenticated === true && typeof o.reviewer === "string" && o.reviewer.trim().length > 0 &&
    Array.isArray(o.roles) && o.roles.every(role => typeof role === "string") &&
    typeof o.authenticatedAt === "string" && o.authenticatedAt.trim().length > 0 &&
    o.contract === "rdl-enterprise-work-queue/v1" && typeof o.canCoordinate === "boolean";
}

function validPayload(value: unknown): value is WorkQueuePayload {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.schemaVersion !== "rdl-enterprise-work-queue/v1" || typeof o.generatedAt !== "string" || !Array.isArray(o.items)) return false;
  return o.items.every(item => {
    if (!item || typeof item !== "object") return false;
    const w = item as Record<string, unknown>;
    return Number.isSafeInteger(Number(w.work_item_id)) && Number(w.work_item_id) > 0 &&
      typeof w.title === "string" && typeof w.drill_through_path === "string" && String(w.drill_through_path).startsWith("/") &&
      ["open","acknowledged","in_progress","completed","dismissed"].includes(String(w.status)) &&
      ["normal","high","critical"].includes(String(w.priority)) &&
      ["closed","no_sla","overdue","due_soon","within_sla"].includes(String(w.sla_state));
  });
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) throw new Error("Expected JSON response.");
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string"
      ? String((payload as Record<string, unknown>).error) : "Work queue request failed.";
    throw new Error(message);
  }
  return payload as T;
}
