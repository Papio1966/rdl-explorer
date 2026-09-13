-- RDL-055R2: durable publication-to-distribution enrollment.
-- Every immutable effective-standard release receives exactly one persistent
-- consumer-facing distribution lifecycle row. Existing lifecycle rows are
-- never rewritten by enrollment.

CREATE OR REPLACE FUNCTION rdl.ensure_effective_standard_distribution(
  p_effective_standard_release_id bigint
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_distribution_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM rdl.effective_standard_release r
     WHERE r.effective_standard_release_id = p_effective_standard_release_id
  ) THEN
    RAISE EXCEPTION 'effective standard release % does not exist', p_effective_standard_release_id;
  END IF;

  INSERT INTO rdl.effective_standard_distribution(effective_standard_release_id)
  VALUES (p_effective_standard_release_id)
  ON CONFLICT (effective_standard_release_id) DO NOTHING
  RETURNING distribution_id INTO v_distribution_id;

  IF v_distribution_id IS NULL THEN
    SELECT d.distribution_id
      INTO v_distribution_id
      FROM rdl.effective_standard_distribution d
     WHERE d.effective_standard_release_id = p_effective_standard_release_id;
  END IF;

  IF v_distribution_id IS NULL THEN
    RAISE EXCEPTION 'unable to resolve distribution enrollment for effective standard release %', p_effective_standard_release_id;
  END IF;

  RETURN v_distribution_id;
END
$$;

CREATE OR REPLACE FUNCTION rdl.enroll_effective_standard_distribution_on_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM rdl.ensure_effective_standard_distribution(NEW.effective_standard_release_id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_enroll_effective_standard_distribution ON rdl.effective_standard_release;
CREATE TRIGGER trg_enroll_effective_standard_distribution
AFTER INSERT ON rdl.effective_standard_release
FOR EACH ROW EXECUTE FUNCTION rdl.enroll_effective_standard_distribution_on_publish();

-- Backfill releases published before this durable enrollment primitive existed.
-- ON CONFLICT DO NOTHING preserves any active/deprecated/superseded lifecycle
-- already governed in rdl.effective_standard_distribution.
INSERT INTO rdl.effective_standard_distribution(effective_standard_release_id)
SELECT r.effective_standard_release_id
  FROM rdl.effective_standard_release r
 ORDER BY r.effective_standard_release_id
ON CONFLICT (effective_standard_release_id) DO NOTHING;

COMMENT ON FUNCTION rdl.ensure_effective_standard_distribution(bigint) IS
'Idempotently ensures one persistent distribution lifecycle row for an immutable effective-standard release without rewriting an existing lifecycle state.';
COMMENT ON FUNCTION rdl.enroll_effective_standard_distribution_on_publish() IS
'AFTER INSERT trigger function that durably enrolls every newly published effective-standard release in the distribution lifecycle.';
