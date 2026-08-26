-- RDL-016: enterprise RDL hierarchy, extension governance and immutable effective-context publication.
-- Industry packages remain immutable source packages. Company, Asset and Project contexts
-- compose exact package pins plus governed extension changes without mutating upstream content.

CREATE TABLE IF NOT EXISTS rdl.enterprise_context (
  context_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  context_key text NOT NULL UNIQUE,
  context_type text NOT NULL CHECK (context_type IN ('company','asset','project')),
  name text NOT NULL,
  parent_context_id bigint REFERENCES rdl.enterprise_context(context_id) ON DELETE RESTRICT,
  owner_reference text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_enterprise_context_parent ON rdl.enterprise_context(parent_context_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_context_type_status ON rdl.enterprise_context(context_type,status);

CREATE OR REPLACE FUNCTION rdl.enforce_enterprise_context_hierarchy()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_type text;
BEGIN
  IF NEW.context_type='company' THEN
    IF NEW.parent_context_id IS NOT NULL THEN
      RAISE EXCEPTION 'company context cannot have a parent context';
    END IF;
  ELSE
    IF NEW.parent_context_id IS NULL THEN
      RAISE EXCEPTION '% context requires a parent context', NEW.context_type;
    END IF;
    SELECT context_type INTO parent_type FROM rdl.enterprise_context WHERE context_id=NEW.parent_context_id;
    IF NEW.context_type='asset' AND parent_type IS DISTINCT FROM 'company' THEN
      RAISE EXCEPTION 'asset context parent must be a company context';
    END IF;
    IF NEW.context_type='project' AND parent_type IS DISTINCT FROM 'asset' THEN
      RAISE EXCEPTION 'project context parent must be an asset context';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enterprise_context_hierarchy ON rdl.enterprise_context;
CREATE TRIGGER trg_enterprise_context_hierarchy
BEFORE INSERT OR UPDATE OF context_type,parent_context_id ON rdl.enterprise_context
FOR EACH ROW EXECUTE FUNCTION rdl.enforce_enterprise_context_hierarchy();

CREATE TABLE IF NOT EXISTS rdl.context_package_pin (
  context_package_pin_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  context_id bigint NOT NULL REFERENCES rdl.enterprise_context(context_id) ON DELETE CASCADE,
  layer_type text NOT NULL CHECK (layer_type IN ('industry','company','asset','project')),
  package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  precedence integer NOT NULL CHECK (precedence BETWEEN 1 AND 400),
  pin_reason text,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(context_id,layer_type),
  UNIQUE(context_id,precedence)
);

CREATE INDEX IF NOT EXISTS idx_context_package_pin_context ON rdl.context_package_pin(context_id,precedence);

CREATE TABLE IF NOT EXISTS rdl.context_extension_change (
  extension_change_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  context_id bigint NOT NULL REFERENCES rdl.enterprise_context(context_id) ON DELETE CASCADE,
  change_kind text NOT NULL CHECK (change_kind IN ('add','override','retire')),
  entity_type_code text NOT NULL REFERENCES rdl.entity_type(entity_type_code) ON DELETE RESTRICT,
  native_identifier text NOT NULL,
  base_entity_id bigint REFERENCES rdl.rdl_entity(entity_id) ON DELETE RESTRICT,
  proposed_name text,
  proposed_definition text,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','approved','rejected','retired')),
  rationale text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_by text,
  approved_by text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CHECK (length(btrim(rationale)) > 0),
  CHECK ((change_kind='add' AND base_entity_id IS NULL) OR (change_kind IN ('override','retire') AND base_entity_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_context_extension_change_context ON rdl.context_extension_change(context_id,status,entity_type_code);

CREATE TABLE IF NOT EXISTS rdl.effective_context_publication (
  effective_context_publication_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  context_id bigint NOT NULL REFERENCES rdl.enterprise_context(context_id) ON DELETE RESTRICT,
  effective_package_id bigint NOT NULL REFERENCES rdl.rdl_package(package_id) ON DELETE RESTRICT,
  composition_sha256 text NOT NULL CHECK (composition_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  composition_manifest jsonb NOT NULL,
  published_by text NOT NULL CHECK (length(btrim(published_by)) > 0),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(context_id,effective_package_id),
  UNIQUE(context_id,composition_sha256)
);

CREATE OR REPLACE FUNCTION rdl.prevent_effective_publication_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'effective context publications are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_effective_context_publication_immutable ON rdl.effective_context_publication;
CREATE TRIGGER trg_effective_context_publication_immutable
BEFORE UPDATE OR DELETE ON rdl.effective_context_publication
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_effective_publication_mutation();

CREATE OR REPLACE FUNCTION rdl.prevent_active_context_pin_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_context_id bigint; v_status text;
BEGIN
  IF TG_OP='DELETE' THEN v_context_id := OLD.context_id; ELSE v_context_id := NEW.context_id; END IF;
  SELECT status INTO v_status FROM rdl.enterprise_context WHERE context_id=v_context_id;
  IF v_status='active' THEN
    RAISE EXCEPTION 'package pins for active contexts are immutable; create a new context/version instead';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_context_package_pin_immutable ON rdl.context_package_pin;
CREATE TRIGGER trg_context_package_pin_immutable
BEFORE UPDATE OR DELETE ON rdl.context_package_pin
FOR EACH ROW EXECUTE FUNCTION rdl.prevent_active_context_pin_mutation();

CREATE OR REPLACE FUNCTION rdl.context_lineage(p_context_id bigint)
RETURNS TABLE(depth integer,context_id bigint,context_key text,context_type text,name text,status text)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE lineage AS (
    SELECT 0 AS depth,c.context_id,c.context_key,c.context_type,c.name,c.status,c.parent_context_id
    FROM rdl.enterprise_context c WHERE c.context_id=p_context_id
    UNION ALL
    SELECT l.depth+1,p.context_id,p.context_key,p.context_type,p.name,p.status,p.parent_context_id
    FROM lineage l JOIN rdl.enterprise_context p ON p.context_id=l.parent_context_id
  )
  SELECT depth,context_id,context_key,context_type,name,status
  FROM lineage ORDER BY depth DESC;
$$;

CREATE OR REPLACE VIEW rdl.enterprise_context_summary AS
SELECT c.context_id,c.context_key,c.context_type,c.name,c.status,
       p.context_key AS parent_context_key,
       count(DISTINCT pin.context_package_pin_id)::integer AS package_pin_count,
       count(DISTINCT ch.extension_change_id) FILTER (WHERE ch.status='approved')::integer AS approved_extension_count
FROM rdl.enterprise_context c
LEFT JOIN rdl.enterprise_context p ON p.context_id=c.parent_context_id
LEFT JOIN rdl.context_package_pin pin ON pin.context_id=c.context_id
LEFT JOIN rdl.context_extension_change ch ON ch.context_id=c.context_id
GROUP BY c.context_id,c.context_key,c.context_type,c.name,c.status,p.context_key;

COMMENT ON TABLE rdl.enterprise_context IS 'Governed Company, Asset or Project/CIS context. Context lineage encodes L2-L4 enterprise layering.';
COMMENT ON TABLE rdl.context_package_pin IS 'Exact immutable package pins used to compose a governed enterprise context.';
COMMENT ON TABLE rdl.context_extension_change IS 'Explicit add/override/retire proposal at an enterprise layer; never mutates the upstream package.';
COMMENT ON TABLE rdl.effective_context_publication IS 'Immutable record of a published effective package and exact composition manifest for one context version.';
