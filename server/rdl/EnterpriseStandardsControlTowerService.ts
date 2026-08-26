import type { EnterpriseStandardsControlTowerRepository } from "./EnterpriseStandardsControlTowerRepository.ts";

export type ControlTowerHealth = "healthy" | "attention" | "critical";

export class EnterpriseStandardsControlTowerService {
  constructor(private readonly repository: EnterpriseStandardsControlTowerRepository) {}

  async dashboard(limit = 25) {
    const data = await this.repository.dashboard(Number.isFinite(limit) ? limit : 25);
    const k = data.kpis as Record<string, unknown>;
    const blocked = toInt(k.blocked_migration_plan_count);
    const overdue = toInt(k.overdue_migration_action_count);
    const breaking = toInt(k.open_breaking_action_count);
    const pendingReviews = toInt(k.pending_extension_review_count);
    const unacknowledged = toInt(k.unacknowledged_notification_count);
    const health: ControlTowerHealth = blocked > 0 || overdue > 0 ? "critical" : breaking > 0 || pendingReviews > 0 || unacknowledged > 0 ? "attention" : "healthy";

    return {
      schemaVersion: "rdl-enterprise-control-tower/v1" as const,
      generatedAt: new Date().toISOString(),
      health,
      ...data,
    };
  }
}

function toInt(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}
