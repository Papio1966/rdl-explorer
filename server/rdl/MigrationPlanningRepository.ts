import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type MigrationPlanStatus="draft"|"in_review"|"approved"|"staged"|"activated"|"rejected"|"cancelled";
export type MigrationReadiness="not_ready"|"in_progress"|"ready"|"blocked";
export type MigrationActionStatus="open"|"in_progress"|"completed"|"waived";

export class MigrationPlanningRepository {
  constructor(private readonly client:SqlJsonClient) {}

  plans(subjectKey:string,limit=100){
    return this.client.query<any>(`SELECT * FROM rdl.release_migration_plan_summary WHERE subject_key=${sqlLiteral(subjectKey)} ORDER BY updated_at DESC LIMIT ${Math.max(1,Math.min(500,Math.trunc(limit)))}`);
  }

  async plan(planId:number){
    const plans=await this.client.query<any>(`SELECT * FROM rdl.release_migration_plan_summary WHERE migration_plan_id=${planId}`);
    if(!plans[0]) return null;
    const [actions,history]=await Promise.all([
      this.client.query<any>(`SELECT * FROM rdl.release_migration_action WHERE migration_plan_id=${planId} ORDER BY breaking DESC,migration_action_id`),
      this.client.query<any>(`SELECT * FROM rdl.release_migration_history WHERE migration_plan_id=${planId} ORDER BY migration_history_id`),
    ]);
    return {plan:plans[0],actions,history};
  }

  async create(input:{subjectType:"consumer"|"project";subjectKey:string;fromReleaseId:number;toReleaseId:number;title:string;rationale:string;ownerKey:string;dueDate?:string;createdBy:string}){
    const rows=await this.client.query<any>(`INSERT INTO rdl.release_migration_plan(subject_type,subject_key,from_release_id,to_release_id,title,rationale,owner_key,due_date,created_by)
      VALUES(${sqlLiteral(input.subjectType)},${sqlLiteral(input.subjectKey)},${input.fromReleaseId},${input.toReleaseId},${sqlLiteral(input.title)},${sqlLiteral(input.rationale)},${sqlLiteral(input.ownerKey)},${input.dueDate?sqlLiteral(input.dueDate):"NULL"}::date,${sqlLiteral(input.createdBy)})
      RETURNING migration_plan_id,expected_version,lifecycle_status,readiness_status`);
    const row=rows[0];
    await this.client.query(`INSERT INTO rdl.release_migration_history(migration_plan_id,event_type,actor,rationale) VALUES(${Number(row.migration_plan_id)},'created',${sqlLiteral(input.createdBy)},${sqlLiteral(input.rationale)}) RETURNING migration_history_id`);
    return row;
  }

  addAction(planId:number,input:{actionKey:string;entityType?:string;nativeIdentifier?:string;changeKind?:string;breaking?:boolean;actionText:string;ownerKey?:string;dueDate?:string}){
    return this.client.query<any>(`INSERT INTO rdl.release_migration_action(migration_plan_id,action_key,entity_type,native_identifier,change_kind,breaking,action_text,owner_key,due_date)
      VALUES(${planId},${sqlLiteral(input.actionKey)},${input.entityType?sqlLiteral(input.entityType):"NULL"},${input.nativeIdentifier?sqlLiteral(input.nativeIdentifier):"NULL"},${input.changeKind?sqlLiteral(input.changeKind):"NULL"},${input.breaking?"true":"false"},${sqlLiteral(input.actionText)},${input.ownerKey?sqlLiteral(input.ownerKey):"NULL"},${input.dueDate?sqlLiteral(input.dueDate):"NULL"}::date)
      RETURNING *`);
  }

  async updateAction(planId:number,actionId:number,status:MigrationActionStatus,evidence:string|undefined,actor:string){
    const done=status==="completed"||status==="waived";
    const rows=await this.client.query<any>(`UPDATE rdl.release_migration_action SET action_status=${sqlLiteral(status)},evidence_text=${evidence?sqlLiteral(evidence):"NULL"},completed_at=${done?"COALESCE(completed_at,now())":"NULL"},updated_at=now() WHERE migration_plan_id=${planId} AND migration_action_id=${actionId} RETURNING *`);
    if(!rows[0]) return null;
    await this.client.query(`INSERT INTO rdl.release_migration_history(migration_plan_id,event_type,actor,event_payload) VALUES(${planId},'action_changed',${sqlLiteral(actor)},${sqlLiteral(JSON.stringify({actionId,status}))}::jsonb) RETURNING migration_history_id`);
    return rows[0];
  }

  transition(planId:number,action:"submit"|"approve"|"reject"|"stage"|"activate"|"cancel",actor:string,rationale:string,expectedVersion:number){
    return this.client.query<any>(`SELECT * FROM rdl.transition_release_migration_plan(${planId},${sqlLiteral(action)},${sqlLiteral(actor)},${sqlLiteral(rationale)},${expectedVersion})`);
  }

  readiness(planId:number,readiness:MigrationReadiness,actor:string,rationale:string,expectedVersion:number){
    return this.client.query<any>(`SELECT * FROM rdl.set_release_migration_readiness(${planId},${sqlLiteral(readiness)},${sqlLiteral(actor)},${sqlLiteral(rationale)},${expectedVersion})`);
  }
}
