import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";

export class EnterpriseStandardsControlTowerRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async dashboard(limit = 25) {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const [kpiRows, queue, releases, adoption, migrations] = await Promise.all([
      this.client.query<any>("SELECT * FROM rdl.enterprise_standards_control_tower_kpi"),
      this.client.query<any>(`SELECT * FROM rdl.enterprise_standards_governance_queue ORDER BY CASE priority WHEN 'blocked' THEN 1 WHEN 'overdue' THEN 2 WHEN 'review_required' THEN 3 ELSE 4 END, created_at NULLS LAST LIMIT ${safeLimit}`),
      this.client.query<any>(`SELECT * FROM rdl.enterprise_standards_release_health ORDER BY published_at DESC NULLS LAST, release_id DESC LIMIT ${safeLimit}`),
      this.client.query<any>(`SELECT * FROM rdl.enterprise_standards_adoption_summary WHERE enabled ORDER BY unacknowledged_notification_count DESC, consumer_key LIMIT ${safeLimit}`),
      this.client.query<any>(`SELECT * FROM rdl.release_migration_plan_summary WHERE lifecycle_status NOT IN ('activated','rejected','cancelled') ORDER BY CASE readiness_status WHEN 'blocked' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END, due_date NULLS LAST, updated_at DESC LIMIT ${safeLimit}`),
    ]);
    return { kpis: kpiRows[0] ?? {}, queue, releases, adoption, migrations };
  }
}
