-- RDL-027: enterprise SSO, user identity and role administration.
-- Identity provider authentication is performed at the enterprise gateway/OIDC boundary.
-- RDL Explorer stores normalized user/role/group state and an append-only audit trail.

CREATE TABLE IF NOT EXISTS rdl.enterprise_identity_user (
  identity_user_id bigserial PRIMARY KEY,
  subject_key text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL,
  identity_provider text NOT NULL DEFAULT 'oidc',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_authenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_role_assignment (
  role_assignment_id bigserial PRIMARY KEY,
  subject_key text NOT NULL REFERENCES rdl.enterprise_identity_user(subject_key) ON DELETE CASCADE,
  role_key text NOT NULL,
  assignment_source text NOT NULL DEFAULT 'direct' CHECK (assignment_source IN ('direct','group')),
  source_group_key text NOT NULL DEFAULT '',
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  UNIQUE(subject_key,role_key,assignment_source,source_group_key)
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_group_role_mapping (
  group_role_mapping_id bigserial PRIMARY KEY,
  group_key text NOT NULL,
  role_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_key,role_key)
);

CREATE TABLE IF NOT EXISTS rdl.enterprise_identity_audit_event (
  identity_audit_event_id bigserial PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('user_seen','user_disabled','user_reenabled','role_assigned','role_revoked','group_mapping_created','group_mapping_disabled')),
  actor_subject_key text NOT NULL,
  target_subject_key text,
  target_role_key text,
  target_group_key text,
  rationale text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_role_assignment_subject_idx ON rdl.enterprise_role_assignment(subject_key,revoked_at);
CREATE INDEX IF NOT EXISTS enterprise_identity_audit_target_idx ON rdl.enterprise_identity_audit_event(target_subject_key,identity_audit_event_id);

CREATE OR REPLACE FUNCTION rdl.prevent_identity_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'enterprise identity audit history is append-only'; END $$;
DROP TRIGGER IF EXISTS enterprise_identity_audit_append_only_u ON rdl.enterprise_identity_audit_event;
CREATE TRIGGER enterprise_identity_audit_append_only_u BEFORE UPDATE OR DELETE ON rdl.enterprise_identity_audit_event FOR EACH ROW EXECUTE FUNCTION rdl.prevent_identity_audit_mutation();

CREATE OR REPLACE VIEW rdl.enterprise_identity_directory AS
SELECT u.subject_key,u.email,u.display_name,u.identity_provider,u.status,u.last_authenticated_at,u.created_at,u.updated_at,
       COALESCE(array_agg(DISTINCT a.role_key) FILTER (WHERE a.revoked_at IS NULL),ARRAY[]::text[]) AS direct_roles
FROM rdl.enterprise_identity_user u
LEFT JOIN rdl.enterprise_role_assignment a ON a.subject_key=u.subject_key AND a.assignment_source='direct'
GROUP BY u.identity_user_id;

COMMENT ON TABLE rdl.enterprise_identity_user IS 'RDL-027 normalized enterprise identity profile sourced from the trusted SSO/OIDC boundary.';
COMMENT ON TABLE rdl.enterprise_role_assignment IS 'RDL-027 explicit role assignments. Existing workflow authorization remains authoritative while services migrate to centralized role resolution.';
COMMENT ON TABLE rdl.enterprise_group_role_mapping IS 'RDL-027 group-to-role mappings used to resolve enterprise roles from trusted OIDC group claims.';
COMMENT ON TABLE rdl.enterprise_identity_audit_event IS 'RDL-027 append-only audit trail for identity and role-administration changes.';
