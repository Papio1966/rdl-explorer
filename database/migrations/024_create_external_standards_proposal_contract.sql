-- RDL-044: external standards proposal intake contract for DataGate and other consumers.
-- RDL Explorer remains the standards governance authority. External systems may propose;
-- they must not mutate source packages, normalized projections, enterprise extensions or DataGate state directly.

CREATE TABLE IF NOT EXISTS rdl.external_standards_proposal (
  external_proposal_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_key text NOT NULL UNIQUE CHECK (length(btrim(proposal_key)) > 0),
  consumer_key text NOT NULL CHECK (length(btrim(consumer_key)) > 0),
  request_key text NOT NULL CHECK (length(btrim(request_key)) > 0),
  proposal_sha256 text NOT NULL CHECK (proposal_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  proposer_key text NOT NULL CHECK (length(btrim(proposer_key)) > 0),
  source_system text NOT NULL CHECK (length(btrim(source_system)) > 0),
  source_level text NOT NULL CHECK (source_level IN ('project','asset','company','industry','unknown')),
  target_level text NOT NULL CHECK (target_level IN ('project','asset','company','industry')),
  target_context_key text NOT NULL CHECK (length(btrim(target_context_key)) > 0),
  parent_package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  change_kind text NOT NULL CHECK (change_kind IN ('add','override','retire','relationship_delta')),
  entity_type_code text NOT NULL CHECK (length(btrim(entity_type_code)) > 0),
  native_identifier text NOT NULL CHECK (length(btrim(native_identifier)) > 0),
  delta_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(delta_payload) = 'object'),
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_evidence) = 'object'),
  rationale text NOT NULL CHECK (length(btrim(rationale)) >= 10),
  promotion_target_level text CHECK (promotion_target_level IS NULL OR promotion_target_level IN ('asset','company','industry')),
  promotion_target_context_key text,
  proposal_status text NOT NULL DEFAULT 'received' CHECK (proposal_status IN ('received','in_review','accepted','rejected','withdrawn')),
  review_version integer NOT NULL DEFAULT 0 CHECK (review_version >= 0),
  reviewed_by text,
  review_rationale text,
  reviewed_at timestamptz,
  publication_result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(publication_result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer_key, request_key)
);

CREATE INDEX IF NOT EXISTS idx_external_standards_proposal_status
  ON rdl.external_standards_proposal(proposal_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_standards_proposal_consumer
  ON rdl.external_standards_proposal(consumer_key, request_key);
CREATE INDEX IF NOT EXISTS idx_external_standards_proposal_target
  ON rdl.external_standards_proposal(target_context_key, target_level, entity_type_code, native_identifier);

CREATE TABLE IF NOT EXISTS rdl.external_standards_proposal_event (
  proposal_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_proposal_id bigint NOT NULL REFERENCES rdl.external_standards_proposal(external_proposal_id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('submit','start_review','accept','reject','withdraw','link_publication')),
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_key text NOT NULL CHECK (length(btrim(actor_key)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) >= 10),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  review_version integer NOT NULL CHECK (review_version >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_standards_proposal_event_proposal
  ON rdl.external_standards_proposal_event(external_proposal_id, proposal_event_id);

CREATE OR REPLACE FUNCTION rdl.prevent_external_standards_proposal_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'external standards proposal events are append-only';
END $$;

DROP TRIGGER IF EXISTS trg_external_standards_proposal_event_immutable ON rdl.external_standards_proposal_event;
CREATE TRIGGER trg_external_standards_proposal_event_immutable
BEFORE UPDATE OR DELETE ON rdl.external_standards_proposal_event
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_external_standards_proposal_event_mutation();

CREATE OR REPLACE FUNCTION rdl.submit_external_standards_proposal(
  p_consumer_key text,
  p_request_key text,
  p_proposal_sha256 text,
  p_proposer_key text,
  p_source_system text,
  p_source_level text,
  p_target_level text,
  p_target_context_key text,
  p_parent_package_id bigint,
  p_change_kind text,
  p_entity_type_code text,
  p_native_identifier text,
  p_delta_payload jsonb,
  p_source_evidence jsonb,
  p_rationale text,
  p_promotion_target_level text DEFAULT NULL,
  p_promotion_target_context_key text DEFAULT NULL
) RETURNS rdl.external_standards_proposal
LANGUAGE plpgsql AS $$
DECLARE
  v_existing rdl.external_standards_proposal%ROWTYPE;
  v_created rdl.external_standards_proposal%ROWTYPE;
  v_proposal_key text;
BEGIN
  IF length(btrim(coalesce(p_consumer_key,''))) = 0 THEN RAISE EXCEPTION 'consumer_key is required'; END IF;
  IF length(btrim(coalesce(p_request_key,''))) = 0 THEN RAISE EXCEPTION 'request_key is required'; END IF;
  IF p_proposal_sha256 IS NULL OR p_proposal_sha256 !~ '^[0-9A-Fa-f]{64}$' THEN RAISE EXCEPTION 'proposal_sha256 must be a SHA-256 hex string'; END IF;
  IF NOT EXISTS (SELECT 1 FROM rdl.rdl_package WHERE package_id = p_parent_package_id) THEN RAISE EXCEPTION 'parent package % does not exist', p_parent_package_id; END IF;

  SELECT * INTO v_existing
  FROM rdl.external_standards_proposal
  WHERE consumer_key = btrim(p_consumer_key)
    AND request_key = btrim(p_request_key)
  LIMIT 1;

  IF FOUND THEN
    IF lower(v_existing.proposal_sha256) <> lower(p_proposal_sha256) THEN
      RAISE EXCEPTION 'idempotency conflict for consumer % request %', p_consumer_key, p_request_key;
    END IF;
    RETURN v_existing;
  END IF;

  v_proposal_key := btrim(p_consumer_key) || ':' || btrim(p_request_key);

  INSERT INTO rdl.external_standards_proposal(
    proposal_key, consumer_key, request_key, proposal_sha256, proposer_key,
    source_system, source_level, target_level, target_context_key, parent_package_id,
    change_kind, entity_type_code, native_identifier, delta_payload, source_evidence,
    rationale, promotion_target_level, promotion_target_context_key
  ) VALUES (
    v_proposal_key, btrim(p_consumer_key), btrim(p_request_key), lower(p_proposal_sha256), btrim(p_proposer_key),
    btrim(p_source_system), p_source_level, p_target_level, btrim(p_target_context_key), p_parent_package_id,
    p_change_kind, btrim(p_entity_type_code), btrim(p_native_identifier), coalesce(p_delta_payload,'{}'::jsonb), coalesce(p_source_evidence,'{}'::jsonb),
    btrim(p_rationale), p_promotion_target_level, NULLIF(btrim(coalesce(p_promotion_target_context_key,'')),'')
  ) RETURNING * INTO v_created;

  INSERT INTO rdl.external_standards_proposal_event(
    external_proposal_id, action, from_status, to_status, actor_key, rationale, evidence, review_version
  ) VALUES (
    v_created.external_proposal_id, 'submit', 'none', v_created.proposal_status,
    v_created.proposer_key, v_created.rationale,
    jsonb_build_object('consumerKey', v_created.consumer_key, 'requestKey', v_created.request_key, 'sourceSystem', v_created.source_system),
    v_created.review_version
  );

  RETURN v_created;
END $$;

CREATE OR REPLACE FUNCTION rdl.review_external_standards_proposal(
  p_external_proposal_id bigint,
  p_action text,
  p_actor_key text,
  p_rationale text,
  p_expected_version integer,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_publication_result jsonb DEFAULT '{}'::jsonb
) RETURNS rdl.external_standards_proposal
LANGUAGE plpgsql AS $$
DECLARE
  v_current rdl.external_standards_proposal%ROWTYPE;
  v_next_status text;
  v_updated rdl.external_standards_proposal%ROWTYPE;
BEGIN
  IF length(btrim(coalesce(p_actor_key,''))) = 0 THEN RAISE EXCEPTION 'actor_key is required'; END IF;
  IF length(btrim(coalesce(p_rationale,''))) < 10 THEN RAISE EXCEPTION 'review rationale must be at least 10 characters'; END IF;

  SELECT * INTO v_current
  FROM rdl.external_standards_proposal
  WHERE external_proposal_id = p_external_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'external proposal % not found', p_external_proposal_id; END IF;
  IF v_current.review_version <> p_expected_version THEN
    RAISE EXCEPTION 'external proposal version conflict: expected %, actual %', p_expected_version, v_current.review_version;
  END IF;

  v_next_status := CASE
    WHEN p_action = 'start_review' AND v_current.proposal_status = 'received' THEN 'in_review'
    WHEN p_action = 'accept' AND v_current.proposal_status IN ('received','in_review') THEN 'accepted'
    WHEN p_action = 'reject' AND v_current.proposal_status IN ('received','in_review') THEN 'rejected'
    WHEN p_action = 'withdraw' AND v_current.proposal_status IN ('received','in_review') THEN 'withdrawn'
    WHEN p_action = 'link_publication' AND v_current.proposal_status = 'accepted' THEN 'accepted'
    ELSE NULL
  END;

  IF v_next_status IS NULL THEN
    RAISE EXCEPTION 'unsupported external proposal transition: % from %', p_action, v_current.proposal_status;
  END IF;

  UPDATE rdl.external_standards_proposal
  SET proposal_status = v_next_status,
      review_version = review_version + 1,
      reviewed_by = btrim(p_actor_key),
      review_rationale = btrim(p_rationale),
      reviewed_at = now(),
      publication_result = CASE WHEN p_action = 'link_publication' THEN coalesce(p_publication_result,'{}'::jsonb) ELSE publication_result END,
      updated_at = now()
  WHERE external_proposal_id = p_external_proposal_id
  RETURNING * INTO v_updated;

  INSERT INTO rdl.external_standards_proposal_event(
    external_proposal_id, action, from_status, to_status, actor_key, rationale, evidence, review_version
  ) VALUES (
    p_external_proposal_id, p_action, v_current.proposal_status, v_updated.proposal_status,
    btrim(p_actor_key), btrim(p_rationale), coalesce(p_evidence,'{}'::jsonb), v_current.review_version
  );

  RETURN v_updated;
END $$;

CREATE OR REPLACE VIEW rdl.external_standards_proposal_queue AS
SELECT
  p.external_proposal_id,
  p.proposal_key,
  p.consumer_key,
  p.request_key,
  p.proposer_key,
  p.source_system,
  p.source_level,
  p.target_level,
  p.target_context_key,
  p.parent_package_id,
  pkg.package_key AS parent_package_key,
  p.change_kind,
  p.entity_type_code,
  p.native_identifier,
  p.proposal_status,
  p.review_version,
  p.reviewed_by,
  p.reviewed_at,
  p.created_at,
  p.updated_at
FROM rdl.external_standards_proposal p
JOIN rdl.rdl_package pkg ON pkg.package_id = p.parent_package_id;

COMMENT ON TABLE rdl.external_standards_proposal IS 'External proposal intake contract for DataGate and other consumers. Proposals are quarantined, idempotent and reviewed in RDL Explorer before any standards-layer change is governed.';
COMMENT ON TABLE rdl.external_standards_proposal_event IS 'Append-only audit history for external standards proposal submission and review transitions.';
COMMENT ON FUNCTION rdl.submit_external_standards_proposal IS 'Idempotent external standards proposal submission. The same consumer/request/hash returns the existing proposal; a changed hash is rejected.';
COMMENT ON FUNCTION rdl.review_external_standards_proposal IS 'Governed optimistic-locking transition function for external standards proposals.';
