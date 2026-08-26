BEGIN;
DO $$
DECLARE
  stamp text := txid_current()::text;
  actor text := 'rdl028:admin:'||stamp;
  other text := 'rdl028:other:'||stamp;
  org_a text := 'rdl028-a-'||stamp;
  org_b text := 'rdl028-b-'||stamp;
  resource text := 'private-resource-'||stamp;
  denied boolean := false;
BEGIN
  INSERT INTO rdl.enterprise_identity_user(subject_key,email,display_name) VALUES(actor,actor||'@example.invalid','RDL028 Admin'),(other,other||'@example.invalid','RDL028 Other');
  INSERT INTO rdl.enterprise_organization(organization_key,display_name,created_by) VALUES(org_a,'RDL028 Organization A',actor),(org_b,'RDL028 Organization B',actor);
  INSERT INTO rdl.enterprise_organization_membership(organization_key,subject_key,assigned_by) VALUES(org_a,actor,actor),(org_b,other,actor);
  INSERT INTO rdl.enterprise_tenant_role_assignment(organization_key,subject_key,role_key,assigned_by) VALUES(org_a,actor,'rdl-tenant-admin',actor);
  INSERT INTO rdl.enterprise_organization_configuration(organization_key,config_key,config_value,updated_by) VALUES(org_a,'release_channel','"controlled"'::jsonb,actor);
  INSERT INTO rdl.enterprise_tenant_resource_binding(organization_key,resource_type,resource_key,bound_by) VALUES(org_a,'extension',resource,actor);
  PERFORM rdl.assert_tenant_resource_access(org_a,'extension',resource);
  BEGIN
    PERFORM rdl.assert_tenant_resource_access(org_b,'extension',resource);
  EXCEPTION WHEN OTHERS THEN
    IF position('cross-tenant access denied' in SQLERRM)>0 THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'RDL-028 cross-tenant denial did not fail closed'; END IF;
  BEGIN
    INSERT INTO rdl.enterprise_tenant_resource_binding(organization_key,resource_type,resource_key,bound_by) VALUES(org_b,'extension',resource,actor);
    RAISE EXCEPTION 'RDL-028 duplicate tenant ownership was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM rdl.enterprise_organization_configuration WHERE organization_key=org_a AND config_key='release_channel') THEN RAISE EXCEPTION 'RDL-028 tenant configuration missing'; END IF;
  RAISE NOTICE 'PASS RDL-028 tenant organization isolation and enterprise configuration';
END $$;
ROLLBACK;
