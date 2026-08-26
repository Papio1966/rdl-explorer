-- RDL-020: consumer integration contract, release notifications and explicit activation lifecycle.

CREATE TABLE IF NOT EXISTS rdl.consumer_subscription (
  subscription_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consumer_key text NOT NULL CHECK (length(btrim(consumer_key)) > 0),
  context_key text,
  contract_version text NOT NULL DEFAULT 'rdl-consumer-integration/v1',
  notification_mode text NOT NULL DEFAULT 'pull'
    CHECK (notification_mode IN ('pull','webhook-contract')),
  callback_reference text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer_key, context_key)
);

CREATE TABLE IF NOT EXISTS rdl.release_notification (
  notification_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES rdl.consumer_subscription(subscription_id) ON DELETE CASCADE,
  effective_standard_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('release.published','release.deprecated','release.superseded')),
  change_classification text NOT NULL DEFAULT 'review_required'
    CHECK (change_classification IN ('compatible','review_required','breaking','unknown')),
  delta_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text
);

CREATE TABLE IF NOT EXISTS rdl.consumer_release_state (
  consumer_release_state_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES rdl.consumer_subscription(subscription_id) ON DELETE CASCADE,
  effective_standard_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  lifecycle_status text NOT NULL DEFAULT 'discovered'
    CHECK (lifecycle_status IN ('discovered','staged','activated','rejected')),
  package_sha256 text CHECK (package_sha256 IS NULL OR package_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  staged_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, effective_standard_release_id),
  CHECK (lifecycle_status <> 'staged' OR staged_at IS NOT NULL),
  CHECK (lifecycle_status <> 'activated' OR (staged_at IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK (lifecycle_status <> 'rejected' OR rejected_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS rdl.consumer_pull_receipt (
  pull_receipt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES rdl.consumer_subscription(subscription_id) ON DELETE CASCADE,
  effective_standard_release_id bigint NOT NULL REFERENCES rdl.effective_standard_release(effective_standard_release_id) ON DELETE RESTRICT,
  request_key text NOT NULL CHECK (length(btrim(request_key)) > 0),
  package_sha256 text NOT NULL CHECK (package_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  pulled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, request_key)
);

CREATE OR REPLACE FUNCTION rdl.validate_consumer_release_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.lifecycle_status NOT IN ('discovered','staged') THEN
    RAISE EXCEPTION 'consumer release state must begin discovered or staged';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.lifecycle_status = 'discovered' AND NEW.lifecycle_status NOT IN ('discovered','staged','rejected') THEN
      RAISE EXCEPTION 'release must be staged before activation';
    END IF;
    IF OLD.lifecycle_status = 'staged' AND NEW.lifecycle_status NOT IN ('staged','activated','rejected') THEN
      RAISE EXCEPTION 'invalid staged release transition';
    END IF;
    IF OLD.lifecycle_status IN ('activated','rejected') AND NEW.lifecycle_status <> OLD.lifecycle_status THEN
      RAISE EXCEPTION 'activated or rejected consumer state is terminal';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumer_release_transition ON rdl.consumer_release_state;
CREATE TRIGGER trg_consumer_release_transition
BEFORE INSERT OR UPDATE ON rdl.consumer_release_state
FOR EACH ROW EXECUTE FUNCTION rdl.validate_consumer_release_transition();

CREATE OR REPLACE FUNCTION rdl.enqueue_release_notifications(
  p_release_id bigint,
  p_event_type text,
  p_change_classification text DEFAULT 'review_required',
  p_delta_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_context_key text; v_count integer;
BEGIN
  IF p_event_type NOT IN ('release.published','release.deprecated','release.superseded') THEN
    RAISE EXCEPTION 'unsupported release notification event type';
  END IF;
  SELECT c.context_key INTO v_context_key
  FROM rdl.effective_standard_release r
  JOIN rdl.enterprise_context c ON c.context_id=r.context_id
  WHERE r.effective_standard_release_id=p_release_id;
  IF v_context_key IS NULL THEN RAISE EXCEPTION 'release not found'; END IF;

  INSERT INTO rdl.release_notification(subscription_id,effective_standard_release_id,event_type,change_classification,delta_metadata,event_key)
  SELECT s.subscription_id,p_release_id,p_event_type,p_change_classification,COALESCE(p_delta_metadata,'{}'::jsonb),
         s.subscription_id::text || ':' || p_event_type || ':' || p_release_id::text
  FROM rdl.consumer_subscription s
  WHERE s.enabled AND (s.context_key IS NULL OR s.context_key=v_context_key)
  ON CONFLICT (event_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO rdl.consumer_release_state(subscription_id,effective_standard_release_id,lifecycle_status)
  SELECT s.subscription_id,p_release_id,'discovered'
  FROM rdl.consumer_subscription s
  WHERE s.enabled AND (s.context_key IS NULL OR s.context_key=v_context_key)
  ON CONFLICT (subscription_id,effective_standard_release_id) DO NOTHING;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION rdl.notify_effective_standard_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rdl.enqueue_release_notifications(NEW.effective_standard_release_id,'release.published','review_required',NEW.comparison_summary);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_effective_standard_publication ON rdl.effective_standard_release;
CREATE TRIGGER trg_notify_effective_standard_publication
AFTER INSERT ON rdl.effective_standard_release
FOR EACH ROW EXECUTE FUNCTION rdl.notify_effective_standard_publication();

CREATE OR REPLACE FUNCTION rdl.notify_distribution_lifecycle_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_event text;
BEGIN
  IF NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    v_event := CASE NEW.lifecycle_status WHEN 'deprecated' THEN 'release.deprecated' WHEN 'superseded' THEN 'release.superseded' ELSE NULL END;
    IF v_event IS NOT NULL THEN
      PERFORM rdl.enqueue_release_notifications(NEW.effective_standard_release_id,v_event,'review_required',jsonb_build_object('lifecycleStatus',NEW.lifecycle_status,'supersededByReleaseId',NEW.superseded_by_release_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_distribution_lifecycle_change ON rdl.effective_standard_distribution;
CREATE TRIGGER trg_notify_distribution_lifecycle_change
AFTER UPDATE OF lifecycle_status ON rdl.effective_standard_distribution
FOR EACH ROW EXECUTE FUNCTION rdl.notify_distribution_lifecycle_change();

CREATE OR REPLACE VIEW rdl.consumer_release_inbox AS
SELECT n.notification_id,n.event_type,n.change_classification,n.delta_metadata,n.created_at,n.acknowledged_at,n.acknowledged_by,
       s.subscription_id,s.consumer_key,s.context_key,s.contract_version,s.notification_mode,
       r.effective_standard_release_id AS release_id,r.release_key,r.release_version,r.composition_sha256,
       c.context_key AS release_context_key,c.name AS context_name,
       st.lifecycle_status AS consumer_lifecycle_status,st.package_sha256 AS staged_package_sha256,st.staged_at,st.activated_at,st.rejected_at
FROM rdl.release_notification n
JOIN rdl.consumer_subscription s ON s.subscription_id=n.subscription_id
JOIN rdl.effective_standard_release r ON r.effective_standard_release_id=n.effective_standard_release_id
JOIN rdl.enterprise_context c ON c.context_id=r.context_id
LEFT JOIN rdl.consumer_release_state st ON st.subscription_id=s.subscription_id AND st.effective_standard_release_id=r.effective_standard_release_id;

COMMENT ON TABLE rdl.release_notification IS 'Transactional consumer notification/outbox records. Notification announces availability; consumers still pull and verify immutable packages.';
COMMENT ON TABLE rdl.consumer_release_state IS 'Consumer-controlled discovered -> staged -> activated/rejected lifecycle. Publication never auto-activates a consumer.';
