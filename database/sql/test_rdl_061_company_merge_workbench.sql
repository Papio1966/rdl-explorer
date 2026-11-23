BEGIN;

DO $$
DECLARE
  v_mapping_id bigint;
  v_failed boolean := false;
BEGIN
  SELECT m.mapping_id
    INTO v_mapping_id
  FROM rdl.cross_rdl_mapping m
  ORDER BY m.mapping_id
  LIMIT 1;

  IF v_mapping_id IS NULL THEN
    RAISE EXCEPTION 'RDL-061 requires at least one live cross-RDL mapping';
  END IF;

  /*
   * Use a non-existent context to prove the write boundary rejects invalid
   * execution before any composition/source mutation.
   */
  BEGIN
    PERFORM *
    FROM rdl.resolve_company_adoption_merge(
      'RDL061-NONEXISTENT-CONTEXT',
      v_mapping_id,
      'RDL061-COMPANY-TARGET',
      'RDL-061 test target',
      'Rollback-only test definition',
      'Rollback-only merge workflow validation.',
      'rdl061-test',
      jsonb_build_array(
        jsonb_build_object(
          'componentKind','other',
          'componentKey','merge_component_closure',
          'resolution','target_override',
          'resolvedPayload',
            jsonb_build_object(
              'schemaVersion','rdl-company-merge-closure/v1',
              'resolvedComponents',
                jsonb_build_object(
                  'definition',
                  jsonb_build_object(
                    'resolution','target_override',
                    'values',
                    jsonb_build_array('test')
                  )
                ),
              'materializedRelationships',
                jsonb_build_array()
            ),
          'rationale','Rollback-only merge closure acceptance.'
        )
      )
    );

  EXCEPTION WHEN OTHERS THEN
    IF position(
      'Company context RDL061-NONEXISTENT-CONTEXT does not exist'
      in SQLERRM
    )>0 THEN
      v_failed := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION
      'RDL-061 invalid-context execution did not fail closed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rdl.context_extension_change
    WHERE native_identifier='RDL061-COMPANY-TARGET'
  ) THEN
    RAISE EXCEPTION
      'RDL-061 fail-closed acceptance mutated extension state';
  END IF;
END;
$$;

ROLLBACK;
