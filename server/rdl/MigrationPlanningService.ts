import type { MigrationActionStatus,MigrationPlanningRepository,MigrationReadiness } from "./MigrationPlanningRepository.ts";

export class MigrationPlanningService {
  constructor(private readonly repository:MigrationPlanningRepository) {}
  plans(subjectKey:string,limit:number){return this.repository.plans(requiredText(subjectKey,"subjectKey"),Number.isFinite(limit)?limit:100);}
  plan(planId:number){validId(planId,"planId");return this.repository.plan(planId);}
  create(input:{subjectType:"consumer"|"project";subjectKey:string;fromReleaseId:number;toReleaseId:number;title:string;rationale:string;ownerKey:string;dueDate?:string;createdBy:string}){
    if(input.subjectType!=="consumer"&&input.subjectType!=="project")throw new Error("subjectType must be consumer or project.");
    validId(input.fromReleaseId,"fromReleaseId");validId(input.toReleaseId,"toReleaseId");if(input.fromReleaseId===input.toReleaseId)throw new Error("Source and target releases must differ.");
    return this.repository.create({...input,subjectKey:requiredText(input.subjectKey,"subjectKey"),title:requiredText(input.title,"title"),rationale:requiredText(input.rationale,"rationale"),ownerKey:requiredText(input.ownerKey,"ownerKey"),createdBy:requiredText(input.createdBy,"createdBy")});
  }
  addAction(planId:number,input:{actionKey:string;entityType?:string;nativeIdentifier?:string;changeKind?:string;breaking?:boolean;actionText:string;ownerKey?:string;dueDate?:string}){validId(planId,"planId");return this.repository.addAction(planId,{...input,actionKey:requiredText(input.actionKey,"actionKey"),actionText:requiredText(input.actionText,"actionText")});}
  updateAction(planId:number,actionId:number,status:MigrationActionStatus,evidence:string|undefined,actor:string){validId(planId,"planId");validId(actionId,"actionId");if(!["open","in_progress","completed","waived"].includes(status))throw new Error("Invalid migration action status.");return this.repository.updateAction(planId,actionId,status,evidence,requiredText(actor,"actor"));}
  transition(planId:number,action:"submit"|"approve"|"reject"|"stage"|"activate"|"cancel",actor:string,rationale:string,expectedVersion:number){validId(planId,"planId");validVersion(expectedVersion);return this.repository.transition(planId,action,requiredText(actor,"actor"),requiredText(rationale,"rationale"),expectedVersion).then(rows=>rows[0]??null);}
  readiness(planId:number,readiness:MigrationReadiness,actor:string,rationale:string,expectedVersion:number){validId(planId,"planId");validVersion(expectedVersion);if(!["not_ready","in_progress","ready","blocked"].includes(readiness))throw new Error("Invalid readiness status.");return this.repository.readiness(planId,readiness,requiredText(actor,"actor"),requiredText(rationale,"rationale"),expectedVersion).then(rows=>rows[0]??null);}
}
function requiredText(v:string,name:string){const t=String(v??"").trim();if(!t)throw new Error(`${name} is required.`);return t;}function validId(v:number,name:string){if(!Number.isSafeInteger(v)||v<=0)throw new Error(`A valid ${name} is required.`);}function validVersion(v:number){if(!Number.isSafeInteger(v)||v<=0)throw new Error("A valid expectedVersion is required.");}
