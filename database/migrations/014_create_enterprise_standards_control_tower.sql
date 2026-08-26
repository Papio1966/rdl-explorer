-- RDL-023: enterprise standards dashboard and control tower.
-- Provides read-only operational views over the governed enterprise lifecycle.
-- No lifecycle state is duplicated or mutated by the control tower.

CREATE OR REPLACE VIEW rdl.enterprise_standards_control_tower_kpi AS
SELECT
  (SELECT count(*)::integer FROM rdl.enterprise_context WHERE status='active') AS active_context_count,
  (SELECT count(*)::integer FROM rdl.enterprise_context WHERE status='draft') AS draft_context_count,
  (SELECT count(*)::integer FROM rdl.context_extension_change WHERE status='in_review') AS pending_extension_review_count,
  (SELECT count(*)::integer FROM rdl.effective_standard_release) AS published_release_count,
  (SELECT count(*)::integer FROM rdl.effective_standard_distribution WHERE lifecycle_status='active') AS active_distribution_count,
  (SELECT count(*)::integer FROM rdl.consumer_subscription WHERE enabled) AS enabled_consumer_count,
  (SELECT count(*)::integer FROM rdl.release_notification WHERE acknowledged_at IS NULL) AS unacknowledged_notification_count,
  (SELECT count(*)::integer FROM rdl.consumer_release_state WHERE lifecycle_status IN ('discovered','staged')) AS pending_consumer_adoption_count,
  (SELECT count(*)::integer FROM rdl.release_change_analysis) AS release_analysis_count,
  (SELECT count(*)::integer FROM rdl.release_migration_plan WHERE lifecycle_status NOT IN ('activated','rejected','cancelled')) AS open_migration_plan_count,
  (SELECT count(*)::integer FROM rdl.release_migration_plan WHERE readiness_status='blocked' AND lifecycle_status NOT IN ('activated','rejected','cancelled')) AS blocked_migration_plan_count,
  (SELECT count(*)::integer FROM rdl.release_migration_action WHERE breaking AND action_status NOT IN ('completed','waived')) AS open_breaking_action_count,
  (SELECT count(*)::integer FROM rdl.release_migration_action WHERE due_date < current_date AND action_status NOT IN ('completed','waived')) AS overdue_migration_action_count;

CREATE OR REPLACE VIEW rdl.enterprise_standards_release_health AS
SELECT
  d.release_id,
  d.context_key,
  d.context_type,
  d.context_name,
  d.release_key,
  d.release_version,
  d.lifecycle_status,
  d.published_at,
  count(DISTINCT cs.subscription_id) FILTER (WHERE cs.enabled)::integer AS subscribed_consumer_count,
  count(DISTINCT crs.consumer_release_state_id) FILTER (WHERE crs.lifecycle_status='discovered')::integer AS discovered_consumer_count,
  count(DISTINCT crs.consumer_release_state_id) FILTER (WHERE crs.lifecycle_status='staged')::integer AS staged_consumer_count,
  count(DISTINCT crs.consumer_release_state_id) FILTER (WHERE crs.lifecycle_status='activated')::integer AS activated_consumer_count,
  count(DISTINCT rn.notification_id) FILTER (WHERE rn.acknowledged_at IS NULL)::integer AS unacknowledged_notification_count
FROM rdl.distributed_effective_standard_release d
LEFT JOIN rdl.consumer_subscription cs
  ON cs.enabled AND (cs.context_key IS NULL OR cs.context_key=d.context_key)
LEFT JOIN rdl.consumer_release_state crs
  ON crs.subscription_id=cs.subscription_id AND crs.effective_standard_release_id=d.release_id
LEFT JOIN rdl.release_notification rn
  ON rn.subscription_id=cs.subscription_id AND rn.effective_standard_release_id=d.release_id
GROUP BY d.release_id,d.context_key,d.context_type,d.context_name,d.release_key,d.release_version,d.lifecycle_status,d.published_at;

CREATE OR REPLACE VIEW rdl.enterprise_standards_governance_queue AS
SELECT
  'extension_review'::text AS queue_type,
  q.extension_change_id::bigint AS queue_item_id,
  q.context_key AS scope_key,
  q.context_name AS scope_name,
  concat(q.change_kind,' ',q.entity_type_code,' ',q.native_identifier) AS title,
  q.status,
  q.proposed_by AS owner_key,
  NULL::date AS due_date,
  CASE WHEN q.change_kind='retire' THEN 'review_required' ELSE 'normal' END::text AS priority,
  q.submitted_at AS created_at,
  '/extensions'::text AS drill_through_path
FROM rdl.context_extension_governance_queue q
WHERE q.status='in_review'
UNION ALL
SELECT
  'migration_plan'::text,
  p.migration_plan_id::bigint,
  p.subject_key,
  p.subject_key,
  p.title,
  p.lifecycle_status,
  p.owner_key,
  p.due_date,
  CASE
    WHEN p.readiness_status='blocked' THEN 'blocked'
    WHEN p.due_date IS NOT NULL AND p.due_date < current_date THEN 'overdue'
    WHEN p.breaking_action_count > 0 THEN 'review_required'
    ELSE 'normal'
  END,
  p.created_at,
  '/migration'::text
FROM rdl.release_migration_plan_summary p
WHERE p.lifecycle_status NOT IN ('activated','rejected','cancelled')
UNION ALL
SELECT
  'consumer_notification'::text,
  i.notification_id::bigint,
  i.consumer_key,
  i.consumer_key,
  concat(i.event_type,' · ',i.release_key,' · ',i.release_version),
  COALESCE(i.consumer_lifecycle_status,'discovered'),
  i.consumer_key,
  NULL::date,
  CASE WHEN i.change_classification='breaking' THEN 'review_required' ELSE 'normal' END,
  i.created_at,
  '/integration'::text
FROM rdl.consumer_release_inbox i
WHERE i.acknowledged_at IS NULL;

CREATE OR REPLACE VIEW rdl.enterprise_standards_adoption_summary AS
SELECT
  s.subscription_id,
  s.consumer_key,
  s.context_key,
  s.enabled,
  count(st.consumer_release_state_id)::integer AS tracked_release_count,
  count(DISTINCT st.consumer_release_state_id) FILTER (WHERE st.lifecycle_status='discovered')::integer AS discovered_count,
  count(DISTINCT st.consumer_release_state_id) FILTER (WHERE st.lifecycle_status='staged')::integer AS staged_count,
  count(DISTINCT st.consumer_release_state_id) FILTER (WHERE st.lifecycle_status='activated')::integer AS activated_count,
  count(DISTINCT st.consumer_release_state_id) FILTER (WHERE st.lifecycle_status='rejected')::integer AS rejected_count,
  count(DISTINCT n.notification_id) FILTER (WHERE n.acknowledged_at IS NULL)::integer AS unacknowledged_notification_count
FROM rdl.consumer_subscription s
LEFT JOIN rdl.consumer_release_state st ON st.subscription_id=s.subscription_id
LEFT JOIN rdl.release_notification n ON n.subscription_id=s.subscription_id
GROUP BY s.subscription_id,s.consumer_key,s.context_key,s.enabled;

COMMENT ON VIEW rdl.enterprise_standards_control_tower_kpi IS
'RDL-023 read-only KPI projection over enterprise standards governance, release, consumer and migration lifecycle state.';
COMMENT ON VIEW rdl.enterprise_standards_governance_queue IS
'RDL-023 consolidated read-only queue linking extension review, migration planning and unacknowledged consumer events to their authoritative workflows.';
COMMENT ON VIEW rdl.enterprise_standards_release_health IS
'RDL-023 release health projection combining distribution and consumer adoption signals without duplicating lifecycle state.';
COMMENT ON VIEW rdl.enterprise_standards_adoption_summary IS
'RDL-023 consumer adoption projection over subscriptions, release state and notification acknowledgement.';
