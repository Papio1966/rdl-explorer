BEGIN;

DO $$
DECLARE
  v_status text;
  v_blocked boolean := false;
BEGIN
  IF to_regprocedure(
    'rdl.activate_company_context(text,bigint,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'activate_company_context function is missing';
  END IF;

  SELECT status
  INTO v_status
  FROM rdl.enterprise_context
  WHERE context_id=32;

  IF v_status='draft' THEN
    PERFORM *
    FROM rdl.activate_company_context(
      'company-rdl-cfihos-2-0-v1',
      21,
      'Rollback-only RDL-062 activation acceptance.',
      'rdl062.database.acceptance'
    );
  ELSIF v_status<>'active' THEN
    RAISE EXCEPTION
      'unexpected operational Company context status: %',
      v_status;
  END IF;

  SELECT status
  INTO v_status
  FROM rdl.enterprise_context
  WHERE context_id=32;

  IF v_status<>'active' THEN
    RAISE EXCEPTION
      'Company activation did not produce active status';
  END IF;

  BEGIN
    UPDATE rdl.context_package_pin
    SET precedence=precedence
    WHERE context_id=32;

  EXCEPTION WHEN OTHERS THEN
    IF position(
      'package pins for active contexts are immutable'
      IN SQLERRM
    )>0 THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION
      'active Company package pin mutation was not blocked';
  END IF;
END;
$$;

ROLLBACK;
