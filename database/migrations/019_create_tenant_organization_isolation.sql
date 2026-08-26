-- RDL-028: Tenant / Organization Isolation & Enterprise Configuration.
-- Public/industry RDL content may remain globally readable. Enterprise-private resources must be explicitly tenant-bound.

CREATE TABLE IF NOT EXISTS rdl.enterprise_organization (
  organization_key text PRIMARY KEY,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_organization_membership (
  organization_key text NOT NULL REFERENCES rdl.enterprise_organization(organization_key) ON DELETE CASCADE,
  subject_key text NOT NULL REFERENCES rdl.enterprise_identity_user(subject_key) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  membership_source text NOT NULL DEFAULT 'direct' CHECK (membership_source IN ('direct','group')),
  source_group_key text NOT NULL DEFAULT '',
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  PRIMARY KEY (organization_key,subject_key,membership_source,source_group_key)
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_tenant_role_assignment (
  tenant_role_assignment_id bigserial PRIMARY KEY,
  organization_key text NOT NULL REFERENCES rdl.enterprise_organization(organization_key) ON DELETE CASCADE,
  subject_key text NOT NULL REFERENCES rdl.enterprise_identity_user(subject_key) ON DELETE CASCADE,
  role_key text NOT NULL,
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  UNIQUE(organization_key,subject_key,role_key)
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_organization_configuration (
  organization_key text NOT NULL REFERENCES rdl.enterprise_organization(organization_key) ON DELETE CASCADE,
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_key,config_key)
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_tenant_resource_binding (
  tenant_resource_binding_id bigserial PRIMARY KEY,
  organization_key text NOT NULL REFERENCES rdl.enterprise_organization(organization_key) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('enterprise_context','extension','published_release','consumer','migration_plan','work_item','ai_advisory_run','ai_evaluation')),
  resource_key text NOT NULL,
  bound_by text NOT NULL,
  bound_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(resource_type,resource_key),
  UNIQUE(organization_key,resource_type,resource_key)
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_tenant_audit_event (
  tenant_audit_event_id bigserial PRIMARY KEY,
  organization_key text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('organization_created','organization_suspended','organization_reactivated','member_added','member_removed','tenant_role_assigned','tenant_role_revoked','configuration_changed','resource_bound')),
  actor_subject_key text NOT NULL,
  target_subject_key text,
  target_resource_type text,
  target_resource_key text,
  rationale text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_org_membership_subject_idx ON rdl.enterprise_organization_membership(subject_key,organization_key) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS enterprise_tenant_role_subject_idx ON rdl.enterprise_tenant_role_assignment(subject_key,organization_key) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS enterprise_tenant_binding_org_idx ON rdl.enterprise_tenant_resource_binding(organization_key,resource_type);

CREATE OR REPLACE FUNCTION rdl.prevent_tenant_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'enterprise tenant audit history is append-only'; END $$;
DROP TRIGGER IF EXISTS enterprise_tenant_audit_append_only_u ON rdl.enterprise_tenant_audit_event;
CREATE TRIGGER enterprise_tenant_audit_append_only_u BEFORE UPDATE OR DELETE ON rdl.enterprise_tenant_audit_event FOR EACH ROW EXECUTE FUNCTION rdl.prevent_tenant_audit_mutation();

CREATE OR REPLACE FUNCTION rdl.assert_tenant_resource_access(p_organization_key text,p_resource_type text,p_resource_key text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_owner text;
BEGIN
  SELECT organization_key INTO v_owner FROM rdl.enterprise_tenant_resource_binding WHERE resource_type=p_resource_type AND resource_key=p_resource_key;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'tenant resource is not bound'; END IF;
  IF v_owner <> p_organization_key THEN RAISE EXCEPTION 'cross-tenant access denied'; END IF;
END $$;

CREATE OR REPLACE VIEW rdl.enterprise_tenant_directory AS
SELECT o.organization_key,o.display_name,o.status,
       count(DISTINCT m.subject_key) FILTER (WHERE m.status='active' AND m.revoked_at IS NULL) AS active_members,
       count(DISTINCT b.tenant_resource_binding_id) AS bound_resources,
       o.created_at,o.updated_at
FROM rdl.enterprise_organization o
LEFT JOIN rdl.enterprise_organization_membership m ON m.organization_key=o.organization_key
LEFT JOIN rdl.enterprise_tenant_resource_binding b ON b.organization_key=o.organization_key
GROUP BY o.organization_key;

COMMENT ON TABLE rdl.enterprise_organization IS 'RDL-028 tenant/organization boundary for enterprise-private RDL configuration and governed resources.';
COMMENT ON TABLE rdl.enterprise_tenant_resource_binding IS 'RDL-028 one-owner tenant binding. A private resource cannot be bound to more than one organization.';
COMMENT ON FUNCTION rdl.assert_tenant_resource_access(text,text,text) IS 'RDL-028 fail-closed cross-tenant resource ownership assertion.';
