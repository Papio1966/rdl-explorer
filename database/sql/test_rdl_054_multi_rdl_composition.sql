DO $$
BEGIN
  IF to_regclass('rdl.entity_composition') IS NULL THEN RAISE EXCEPTION 'entity_composition missing'; END IF;
  IF to_regclass('rdl.entity_composition_contributor') IS NULL THEN RAISE EXCEPTION 'entity_composition_contributor missing'; END IF;
  IF to_regclass('rdl.entity_composition_component_decision') IS NULL THEN RAISE EXCEPTION 'entity_composition_component_decision missing'; END IF;
  IF to_regclass('rdl.entity_composition_dependency') IS NULL THEN RAISE EXCEPTION 'entity_composition_dependency view missing'; END IF;
  IF to_regclass('rdl.upward_promotion_candidate') IS NULL THEN RAISE EXCEPTION 'upward_promotion_candidate view missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rdl' AND p.proname='derived_compositions_impacted_by_release') THEN
    RAISE EXCEPTION 'derived_compositions_impacted_by_release function missing';
  END IF;
END $$;
