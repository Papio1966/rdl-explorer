\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_package_id bigint;
  v_release_id bigint := 17;
  v_context_key text;
  v_release_sha text;
  v_legacy rdl.external_standards_proposal%ROWTYPE;
  v_effective rdl.external_standards_proposal%ROWTYPE;
  v_bundle rdl.external_standards_proposal_bundle%ROWTYPE;
  v_dep_type text;
  v_dep_native text;
  v_satisfied_by text;
  v_detail jsonb;
  v_non_project_context_id bigint;
  v_non_project_context_key text;
  v_non_project_release_id bigint;
BEGIN
  SELECT package_id INTO v_package_id FROM rdl.rdl_package ORDER BY package_id LIMIT 1;
  IF v_package_id IS NULL THEN RAISE EXCEPTION 'legacy package fixture unavailable'; END IF;
  SELECT c.context_key,r.composition_sha256
  INTO v_context_key,v_release_sha
  FROM rdl.effective_standard_release r
  JOIN rdl.enterprise_context c ON c.context_id=r.context_id
  WHERE r.effective_standard_release_id=v_release_id AND c.context_type='project';
  IF NOT FOUND THEN RAISE EXCEPTION 'release 17 Project parent fixture unavailable'; END IF;

  -- Legacy package-parent overload stays green unchanged.
  SELECT * INTO v_legacy FROM rdl.submit_external_standards_proposal(
    'rdl055r4-dbtest','legacy-proposal',repeat('1',64),'rdl055r4-dbtest','DATAGATE',
    'project','project','rdl055r4-legacy-context',v_package_id,
    'add','unit_of_measure','RDL055R4-LEGACY','{}'::jsonb,'{}'::jsonb,
    'RDL-055R4 legacy package parent preservation.',NULL,NULL
  );
  IF v_legacy.parent_package_id<>v_package_id OR v_legacy.parent_effective_release_id IS NOT NULL THEN
    RAISE EXCEPTION 'legacy package parent semantics changed';
  END IF;

  -- New effective-release overload accepts exact release 17.
  SELECT * INTO v_effective FROM rdl.submit_external_standards_proposal(
    'rdl055r4-dbtest','effective-proposal',repeat('2',64),'rdl055r4-dbtest','DATAGATE',
    'project','project',v_context_key,NULL,v_release_id,
    'add','unit_of_measure','RDL055R4-EFFECTIVE','{}'::jsonb,
    jsonb_build_object('parentEffectiveReleaseCompositionSha256',v_release_sha),
    'RDL-055R4 effective release parent positive case.',NULL,NULL
  );
  IF v_effective.parent_package_id IS NOT NULL OR v_effective.parent_effective_release_id<>v_release_id THEN
    RAISE EXCEPTION 'effective release parent was not persisted exactly';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rdl.external_standards_proposal_queue q
    WHERE q.external_proposal_id=v_effective.external_proposal_id
      AND q.parent_mode='effective_release'
      AND q.parent_effective_release_id=v_release_id
      AND q.parent_effective_context_key=v_context_key
      AND q.parent_effective_release_key='rdl055-qualification-project-release'
      AND q.parent_effective_release_version='1.0.0'
      AND q.parent_effective_composition_sha256=v_release_sha
  ) THEN RAISE EXCEPTION 'effective release readback is incomplete'; END IF;

  -- Both parents fail closed.
  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'rdl055r4-dbtest','both-parents',repeat('3',64),'rdl055r4-dbtest','DATAGATE',
      'project','project',v_context_key,v_package_id,v_release_id,
      'add','unit_of_measure','RDL055R4-BOTH','{}'::jsonb,'{}'::jsonb,
      'RDL-055R4 both parent identities rejection.',NULL,NULL
    );
    RAISE EXCEPTION 'both parent identities were accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM='both parent identities were accepted' THEN RAISE; END IF;
    IF position('exactly one parent identity' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Neither parent fails closed.
  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'rdl055r4-dbtest','no-parent',repeat('4',64),'rdl055r4-dbtest','DATAGATE',
      'project','project',v_context_key,NULL,NULL,
      'add','unit_of_measure','RDL055R4-NONE','{}'::jsonb,'{}'::jsonb,
      'RDL-055R4 missing parent identity rejection.',NULL,NULL
    );
    RAISE EXCEPTION 'missing parent identity was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM='missing parent identity was accepted' THEN RAISE; END IF;
    IF position('exactly one parent identity' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Unknown effective release fails closed.
  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'rdl055r4-dbtest','unknown-release',repeat('5',64),'rdl055r4-dbtest','DATAGATE',
      'project','project',v_context_key,NULL,999999999,
      'add','unit_of_measure','RDL055R4-UNKNOWN','{}'::jsonb,'{}'::jsonb,
      'RDL-055R4 unknown effective parent rejection.',NULL,NULL
    );
    RAISE EXCEPTION 'unknown effective release was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM='unknown effective release was accepted' THEN RAISE; END IF;
    IF position('does not exist' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Target context mismatch fails closed.
  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'rdl055r4-dbtest','context-mismatch',repeat('6',64),'rdl055r4-dbtest','DATAGATE',
      'project','project','rdl055r4-wrong-context',NULL,v_release_id,
      'add','unit_of_measure','RDL055R4-CONTEXT','{}'::jsonb,'{}'::jsonb,
      'RDL-055R4 target context mismatch rejection.',NULL,NULL
    );
    RAISE EXCEPTION 'target context mismatch was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM='target context mismatch was accepted' THEN RAISE; END IF;
    IF position('does not match target context' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Caller-supplied integrity mismatch fails closed.
  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'rdl055r4-dbtest','sha-mismatch',repeat('7',64),'rdl055r4-dbtest','DATAGATE',
      'project','project',v_context_key,NULL,v_release_id,
      'add','unit_of_measure','RDL055R4-SHA','{}'::jsonb,
      jsonb_build_object('parentEffectiveReleaseCompositionSha256',repeat('0',64)),
      'RDL-055R4 parent composition mismatch rejection.',NULL,NULL
    );
    RAISE EXCEPTION 'composition SHA mismatch was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM='composition SHA mismatch was accepted' THEN RAISE; END IF;
    IF position('composition SHA-256 mismatch' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- A non-Project effective release must fail when used on a Project path.
  SELECT context_id,context_key INTO v_non_project_context_id,v_non_project_context_key
  FROM rdl.enterprise_context WHERE context_type IN ('company','asset') ORDER BY context_id LIMIT 1;
  IF v_non_project_context_id IS NULL THEN RAISE EXCEPTION 'non-project context fixture unavailable'; END IF;
  INSERT INTO rdl.effective_standard_release(
    context_id,release_key,release_version,composition_sha256,comparison_summary,package_manifest,package_payload,published_by
  ) VALUES (
    v_non_project_context_id,'rdl055r4-dbtest-nonproject','0.0.0',repeat('8',64),'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'rdl055r4-dbtest'
  ) RETURNING effective_standard_release_id INTO v_non_project_release_id;
  BEGIN
    PERFORM rdl.submit_external_standards_proposal(
      'rdl055r4-dbtest','non-project-release',repeat('9',64),'rdl055r4-dbtest','DATAGATE',
      'project','project',v_non_project_context_key,NULL,v_non_project_release_id,
      'add','unit_of_measure','RDL055R4-NONPROJECT','{}'::jsonb,'{}'::jsonb,
      'RDL-055R4 non-Project parent rejection.',NULL,NULL
    );
    RAISE EXCEPTION 'non-project effective release was accepted on project path';
  EXCEPTION WHEN others THEN
    IF SQLERRM='non-project effective release was accepted on project path' THEN RAISE; END IF;
    IF position('context type' in SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Select an exact entity that exists only once across release 17 pinned packages.
  SELECT e.entity_type_code,e.native_identifier INTO v_dep_type,v_dep_native
  FROM rdl.rdl_entity e
  WHERE e.package_id IN (5,10)
    AND rdl.effective_release_contains_entity(v_release_id,e.entity_type_code,e.native_identifier)
  GROUP BY e.entity_type_code,e.native_identifier
  HAVING count(*)=1
  ORDER BY e.entity_type_code,e.native_identifier
  LIMIT 1;
  IF v_dep_type IS NULL THEN RAISE EXCEPTION 'effective release dependency fixture unavailable'; END IF;

  SELECT * INTO v_bundle FROM rdl.submit_external_standards_proposal_bundle(
    'rdl055r4-dbtest','effective-bundle',repeat('a',64),'rdl055r4-dbtest','DATAGATE',
    'project','project',v_context_key,NULL,v_release_id,
    jsonb_build_object(
      'bundleKey','rdl055r4-effective-bundle',
      'rootEntityTypeCode','unit_of_measure',
      'rootNativeIdentifier','RDL055R4-BUNDLE-ROOT',
      'components',jsonb_build_array(jsonb_build_object(
        'componentKey','root','componentKind','object_delta','action','add',
        'entityTypeCode','unit_of_measure','nativeIdentifier','RDL055R4-BUNDLE-ROOT',
        'payload',jsonb_build_object('name','RDL055R4 bundle root'),'requiredFieldsMissing','[]'::jsonb
      )),
      'dependencies',jsonb_build_array(jsonb_build_object(
        'dependencyKey','existing-release-object','sourceComponentKey','root','dependencyType','semantic_dependency','required',true,
        'targetEntityTypeCode',v_dep_type,'targetNativeIdentifier',v_dep_native
      ))
    ),
    jsonb_build_object('parentEffectiveReleaseCompositionSha256',v_release_sha),
    'RDL-055R4 effective release dependency closure test.',NULL,NULL
  );
  IF v_bundle.parent_effective_release_id<>v_release_id OR v_bundle.completeness_status<>'complete' THEN
    RAISE EXCEPTION 'effective-release bundle parent did not complete';
  END IF;
  SELECT satisfied_by,satisfaction_detail INTO v_satisfied_by,v_detail
  FROM rdl.external_standards_proposal_bundle_dependency
  WHERE proposal_bundle_id=v_bundle.proposal_bundle_id AND dependency_key='existing-release-object';
  IF v_satisfied_by<>'existing_governed_object' THEN RAISE EXCEPTION 'effective release dependency did not resolve'; END IF;
  IF v_detail->>'parentMode'<>'effective_release' OR (v_detail->>'parentEffectiveReleaseId')::bigint<>v_release_id THEN
    RAISE EXCEPTION 'effective release dependency audit detail is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rdl.external_standards_proposal_bundle_queue q
    WHERE q.proposal_bundle_id=v_bundle.proposal_bundle_id
      AND q.parent_mode='effective_release'
      AND q.parent_effective_release_id=v_release_id
      AND q.parent_effective_context_key=v_context_key
      AND q.parent_effective_composition_sha256=v_release_sha
  ) THEN RAISE EXCEPTION 'bundle effective release readback is incomplete'; END IF;

  -- Same-name source identities and RDL-054 provenance remain distinct/intact.
  IF (SELECT count(*) FROM rdl.rdl_entity WHERE entity_id IN (34261,145606)
      AND entity_type_code='unit_of_measure' AND native_identifier='CFIHOS-60000001' AND name='percent')<>2 THEN
    RAISE EXCEPTION 'same-name source identities changed';
  END IF;
  IF (SELECT jsonb_array_length(package_payload#>'{provenance,derivations,0,contributors}')
      FROM rdl.effective_standard_release WHERE effective_standard_release_id=v_release_id)<>2 THEN
    RAISE EXCEPTION 'RDL-054 two-source provenance changed';
  END IF;
END $$;

ROLLBACK;
\echo PASS_RDL055R4_DATABASE_CONTRACT
