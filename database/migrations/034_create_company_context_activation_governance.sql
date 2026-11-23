-- RDL-062: governed activation of a published Company/L2 context.
-- Activation is explicit, authenticated at the API boundary, auditable,
-- requires an immutable effective release, and freezes package pins through
-- the established active-context immutability trigger.

CREATE TABLE IF NOT EXISTS rdl.company_context_activation_event (
  company_context_activation_event_id bigint
    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  context_id bigint NOT NULL
    REFERENCES rdl.enterprise_context(context_id)
    ON DELETE RESTRICT,

  effective_standard_release_id bigint NOT NULL
    REFERENCES rdl.effective_standard_release(
      effective_standard_release_id
    )
    ON DELETE RESTRICT,

  from_status text NOT NULL
    CHECK (from_status='draft'),

  to_status text NOT NULL
    CHECK (to_status='active'),

  rationale text NOT NULL
    CHECK (
      length(btrim(rationale))
      BETWEEN 10 AND 2000
    ),

  activated_by text NOT NULL
    CHECK (btrim(activated_by)<>''),

  activated_at timestamptz NOT NULL
    DEFAULT now(),

  UNIQUE(context_id)
);

CREATE INDEX IF NOT EXISTS
  idx_company_context_activation_release
ON rdl.company_context_activation_event(
  effective_standard_release_id
);

CREATE OR REPLACE FUNCTION
rdl.prevent_company_context_activation_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Company context activation events are immutable';
END;
$$;

DROP TRIGGER IF EXISTS
  trg_company_context_activation_event_immutable
ON rdl.company_context_activation_event;

CREATE TRIGGER
  trg_company_context_activation_event_immutable
BEFORE UPDATE OR DELETE
ON rdl.company_context_activation_event
FOR EACH ROW
EXECUTE FUNCTION
  rdl.prevent_company_context_activation_event_mutation();


CREATE OR REPLACE FUNCTION
rdl.activate_company_context(
  p_context_key text,
  p_effective_standard_release_id bigint,
  p_rationale text,
  p_actor text
)
RETURNS TABLE(
  activation_event_id bigint,
  context_id bigint,
  context_key text,
  effective_standard_release_id bigint,
  status text,
  activated_by text,
  activated_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text := btrim(coalesce(p_context_key,''));
  v_rationale text := btrim(coalesce(p_rationale,''));
  v_actor text := btrim(coalesce(p_actor,''));

  v_context_id bigint;
  v_context_type text;
  v_status text;

  v_manifest jsonb;
  v_manifest_pins jsonb;
  v_manifest_changes jsonb;
  v_current_pins jsonb;

  v_distribution_status text;
  v_pending_count integer;
  v_current_change_count integer;
  v_manifest_change_count integer;

  v_event_id bigint;
  v_event_release_id bigint;
  v_event_actor text;
  v_event_at timestamptz;
  v_activated_at timestamptz;
BEGIN
  IF v_key='' THEN
    RAISE EXCEPTION
      'Company context key is required';
  END IF;

  IF p_effective_standard_release_id IS NULL
     OR p_effective_standard_release_id<=0 THEN
    RAISE EXCEPTION
      'A valid effective standard release is required';
  END IF;

  IF length(v_rationale)<10
     OR length(v_rationale)>2000 THEN
    RAISE EXCEPTION
      'Activation rationale must be between 10 and 2000 characters';
  END IF;

  IF v_actor='' THEN
    RAISE EXCEPTION
      'Activation actor is required';
  END IF;


  SELECT
    c.context_id,
    c.context_type,
    c.status
  INTO
    v_context_id,
    v_context_type,
    v_status
  FROM rdl.enterprise_context c
  WHERE c.context_key=v_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Company context % does not exist',
      v_key;
  END IF;

  IF v_context_type<>'company' THEN
    RAISE EXCEPTION
      'Only Company contexts can use the Company activation workflow';
  END IF;


  /*
   * Idempotent retry after successful activation.
   */
  IF v_status='active' THEN
    SELECT
      e.company_context_activation_event_id,
      e.effective_standard_release_id,
      e.activated_by,
      e.activated_at
    INTO
      v_event_id,
      v_event_release_id,
      v_event_actor,
      v_event_at
    FROM rdl.company_context_activation_event e
    WHERE e.context_id=v_context_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Active Company context has no governed activation event';
    END IF;

    IF v_event_release_id
       <>p_effective_standard_release_id THEN
      RAISE EXCEPTION
        'Company context is already active against a different effective release';
    END IF;

    RETURN QUERY
    SELECT
      v_event_id,
      v_context_id,
      v_key,
      v_event_release_id,
      'active'::text,
      v_event_actor,
      v_event_at;

    RETURN;
  END IF;


  IF v_status<>'draft' THEN
    RAISE EXCEPTION
      'Company context must be draft before activation; current status is %',
      v_status;
  END IF;


  /*
   * Activation is anchored to one exact immutable effective release
   * belonging to this exact Company context.
   */
  SELECT
    r.package_manifest
  INTO
    v_manifest
  FROM rdl.effective_standard_release r
  WHERE
    r.effective_standard_release_id=
      p_effective_standard_release_id
    AND r.context_id=v_context_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Effective release does not belong to the Company context';
  END IF;


  SELECT d.lifecycle_status
  INTO v_distribution_status
  FROM rdl.effective_standard_distribution d
  WHERE
    d.effective_standard_release_id=
      p_effective_standard_release_id;

  IF v_distribution_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION
      'Effective release must be active in the distribution lifecycle before Company activation';
  END IF;


  /*
   * The current package-pin set must still equal the immutable
   * release manifest. This prevents draft drift after publication.
   */
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'contextKey',c.context_key,
          'layerType',pin.layer_type,
          'packageId',pin.package_id,
          'packageKey',p.package_key,
          'precedence',pin.precedence
        )
        ORDER BY
          pin.precedence,
          pin.context_package_pin_id
      ),
      '[]'::jsonb
    )
  INTO v_current_pins
  FROM rdl.enterprise_context c
  JOIN rdl.context_package_pin pin
    ON pin.context_id=c.context_id
  JOIN rdl.rdl_package p
    ON p.package_id=pin.package_id
  WHERE c.context_id=v_context_id;

  v_manifest_pins :=
    coalesce(
      v_manifest->'packagePins',
      '[]'::jsonb
    );

  IF jsonb_array_length(v_manifest_pins)=0 THEN
    RAISE EXCEPTION
      'Published Company release contains no package pins';
  END IF;

  IF v_current_pins
     IS DISTINCT FROM v_manifest_pins THEN
    RAISE EXCEPTION
      'Company context package pins drifted after publication';
  END IF;


  /*
   * Nothing unresolved may exist when the operational context
   * becomes active.
   */
  SELECT count(*)::integer
  INTO v_pending_count
  FROM rdl.context_extension_change x
  WHERE
    x.context_id=v_context_id
    AND x.status NOT IN (
      'approved',
      'rejected',
      'retired'
    );

  IF v_pending_count<>0 THEN
    RAISE EXCEPTION
      'Company context has unresolved extension changes';
  END IF;


  /*
   * The approved/retired change set must equal the immutable
   * publication manifest.
   */
  v_manifest_changes :=
    coalesce(
      v_manifest->'extensionChanges',
      '[]'::jsonb
    );

  v_manifest_change_count :=
    jsonb_array_length(
      v_manifest_changes
    );

  SELECT count(*)::integer
  INTO v_current_change_count
  FROM rdl.context_extension_change x
  WHERE
    x.context_id=v_context_id
    AND x.status IN (
      'approved',
      'retired'
    );

  IF v_current_change_count
     <>v_manifest_change_count THEN
    RAISE EXCEPTION
      'Company context governed changes drifted after publication';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rdl.context_extension_change x
    WHERE
      x.context_id=v_context_id
      AND x.status IN (
        'approved',
        'retired'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          v_manifest_changes
        ) item
        WHERE
          nullif(
            item->>'extensionChangeId',
            ''
          )::bigint=
            x.extension_change_id
      )
  ) THEN
    RAISE EXCEPTION
      'Company context governed change identity drifted after publication';
  END IF;


  UPDATE rdl.enterprise_context AS c
  SET
    status='active',
    activated_at=clock_timestamp()
  WHERE c.context_id=v_context_id
  RETURNING c.activated_at
  INTO v_activated_at;


  INSERT INTO
    rdl.company_context_activation_event(
      context_id,
      effective_standard_release_id,
      from_status,
      to_status,
      rationale,
      activated_by,
      activated_at
    )
  VALUES(
    v_context_id,
    p_effective_standard_release_id,
    'draft',
    'active',
    v_rationale,
    v_actor,
    v_activated_at
  )
  RETURNING
    company_context_activation_event_id
  INTO v_event_id;


  RETURN QUERY
  SELECT
    v_event_id,
    v_context_id,
    v_key,
    p_effective_standard_release_id,
    'active'::text,
    v_actor,
    v_activated_at;
END;
$$;


COMMENT ON TABLE
  rdl.company_context_activation_event
IS
  'Immutable audit event linking explicit Company/L2 activation to one exact effective standard release.';

COMMENT ON FUNCTION
  rdl.activate_company_context(text,bigint,text,text)
IS
  'Fail-closed draft-to-active Company context transition. Requires exact immutable release, active distribution enrollment, unchanged package pins and unchanged governed publication content.';
