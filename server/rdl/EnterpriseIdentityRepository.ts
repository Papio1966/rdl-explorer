import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";
import type { EnterpriseSsoIdentity } from "../auth/EnterpriseIdentity.ts";

export class EnterpriseIdentityRepository {
  constructor(private readonly client:SqlJsonClient){}
  async upsertUser(identity:EnterpriseSsoIdentity){
    const rows=await this.client.query<any>(`INSERT INTO rdl.enterprise_identity_user(subject_key,email,display_name,last_authenticated_at)
      VALUES(${sqlLiteral(identity.subject)},${sqlLiteral(identity.email)},${sqlLiteral(identity.displayName)},${sqlLiteral(identity.authenticatedAt)}::timestamptz)
      ON CONFLICT(subject_key) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,last_authenticated_at=excluded.last_authenticated_at,updated_at=now()
      RETURNING *`); return rows[0];
  }
  directory(){return this.client.query<any>(`SELECT * FROM rdl.enterprise_identity_directory ORDER BY display_name,email`)}
  groupMappings(){return this.client.query<any>(`SELECT * FROM rdl.enterprise_group_role_mapping ORDER BY group_key,role_key`)}
  directRoles(subject:string){return this.client.query<any>(`SELECT role_key FROM rdl.enterprise_role_assignment WHERE subject_key=${sqlLiteral(subject)} AND assignment_source='direct' AND revoked_at IS NULL ORDER BY role_key`)}
  async effectiveRoles(subject:string,groups:string[]){
    const direct=await this.directRoles(subject); const groupList=groups.length?groups.map(sqlLiteral).join(","):"NULL";
    const mapped=groups.length?await this.client.query<any>(`SELECT DISTINCT role_key FROM rdl.enterprise_group_role_mapping WHERE status='active' AND group_key IN (${groupList})`):[];
    return [...new Set([...direct,...mapped].map(r=>String(r.role_key)))].sort();
  }
  async assignRole(subject:string,role:string,actor:string,rationale:string){
    const rows=await this.client.query<any>(`INSERT INTO rdl.enterprise_role_assignment(subject_key,role_key,assigned_by) VALUES(${sqlLiteral(subject)},${sqlLiteral(role)},${sqlLiteral(actor)}) ON CONFLICT(subject_key,role_key,assignment_source,source_group_key) DO UPDATE SET revoked_at=NULL,revoked_by=NULL,revoke_reason=NULL,assigned_by=excluded.assigned_by,assigned_at=now() RETURNING *`);
    await this.audit("role_assigned",actor,subject,role,null,rationale);return rows[0];
  }
  async revokeRole(subject:string,role:string,actor:string,rationale:string){
    const rows=await this.client.query<any>(`UPDATE rdl.enterprise_role_assignment SET revoked_at=now(),revoked_by=${sqlLiteral(actor)},revoke_reason=${sqlLiteral(rationale)} WHERE subject_key=${sqlLiteral(subject)} AND role_key=${sqlLiteral(role)} AND assignment_source='direct' AND revoked_at IS NULL RETURNING *`);
    if(!rows[0])throw new Error("Active direct role assignment not found.");await this.audit("role_revoked",actor,subject,role,null,rationale);return rows[0];
  }
  async setUserStatus(subject:string,status:"active"|"disabled",actor:string,rationale:string){const rows=await this.client.query<any>(`UPDATE rdl.enterprise_identity_user SET status=${sqlLiteral(status)},updated_at=now() WHERE subject_key=${sqlLiteral(subject)} RETURNING *`);if(!rows[0])throw new Error("Identity user not found.");await this.audit(status==="disabled"?"user_disabled":"user_reenabled",actor,subject,null,null,rationale);return rows[0]}
  async createGroupMapping(group:string,role:string,actor:string,rationale:string){const rows=await this.client.query<any>(`INSERT INTO rdl.enterprise_group_role_mapping(group_key,role_key,created_by) VALUES(${sqlLiteral(group)},${sqlLiteral(role)},${sqlLiteral(actor)}) ON CONFLICT(group_key,role_key) DO UPDATE SET status='active',updated_at=now() RETURNING *`);await this.audit("group_mapping_created",actor,null,role,group,rationale);return rows[0]}
  async disableGroupMapping(group:string,role:string,actor:string,rationale:string){const rows=await this.client.query<any>(`UPDATE rdl.enterprise_group_role_mapping SET status='disabled',updated_at=now() WHERE group_key=${sqlLiteral(group)} AND role_key=${sqlLiteral(role)} AND status='active' RETURNING *`);if(!rows[0])throw new Error("Active group mapping not found.");await this.audit("group_mapping_disabled",actor,null,role,group,rationale);return rows[0]}
  async audit(event:string,actor:string,subject:string|null,role:string|null,group:string|null,rationale:string){await this.client.query(`INSERT INTO rdl.enterprise_identity_audit_event(event_type,actor_subject_key,target_subject_key,target_role_key,target_group_key,rationale) VALUES(${sqlLiteral(event)},${sqlLiteral(actor)},${subject?sqlLiteral(subject):"NULL"},${role?sqlLiteral(role):"NULL"},${group?sqlLiteral(group):"NULL"},${sqlLiteral(rationale)}) RETURNING identity_audit_event_id`)}
}
