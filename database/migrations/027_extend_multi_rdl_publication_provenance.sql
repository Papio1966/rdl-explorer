-- RDL-055R: multi-RDL hierarchy/publication repair.
-- Backward-compatible schema repair: allow multiple exact package pins at the same layer,
-- harden active-context pin immutability on INSERT/UPDATE/DELETE, and retain precedence identity.

ALTER TABLE rdl.context_package_pin
  DROP CONSTRAINT IF EXISTS context_package_pin_context_id_layer_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_package_pin_context_layer_package
  ON rdl.context_package_pin(context_id, layer_type, package_id);

CREATE OR REPLACE FUNCTION rdl.prevent_active_context_pin_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_context_id bigint;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_context_id := OLD.context_id;
  ELSE
    v_context_id := NEW.context_id;
  END IF;

  SELECT status INTO v_status
  FROM rdl.enterprise_context
  WHERE context_id = v_context_id;

  IF v_status = 'active' THEN
    RAISE EXCEPTION 'package pins for active contexts are immutable; create a new context/version instead';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_context_package_pin_immutable ON rdl.context_package_pin;
CREATE TRIGGER trg_context_package_pin_immutable
BEFORE INSERT OR UPDATE OR DELETE ON rdl.context_package_pin
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_active_context_pin_mutation();

COMMENT ON INDEX rdl.uq_context_package_pin_context_layer_package IS
'RDL-055R permits multiple exact packages at one standards layer while preventing duplicate context/layer/package pins.';

COMMENT ON FUNCTION rdl.prevent_active_context_pin_mutation() IS
'RDL-055R fail-closed immutability guard for INSERT, UPDATE and DELETE of package pins on active enterprise contexts.';
