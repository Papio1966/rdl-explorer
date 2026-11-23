import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { CompanyMergeWorkbenchRepository } from "./CompanyMergeWorkbenchRepository.ts";

export class CompanyMergeWorkbenchService {
  constructor(
    private readonly repository:CompanyMergeWorkbenchRepository
  ){}

  preview(contextKey:string,mappingId:number){
    return this.repository.preview(
      required(contextKey,"A Company context key is required."),
      validId(mappingId,"A valid mapping id is required.")
    );
  }

  async execute(
    identity:GovernanceIdentity,
    command:{
      contextKey:string;
      mappingId:number;
      targetNativeIdentifier:string;
      targetName:string;
      targetDefinition?:string;
      rationale:string;
      componentDecisions:Array<Record<string,unknown>>;
    }
  ){
    const contextKey=
      required(command.contextKey,"A Company context key is required.");

    const mappingId=
      validId(command.mappingId,"A valid mapping id is required.");

    const targetNativeIdentifier=
      required(
        command.targetNativeIdentifier,
        "A Company target native identifier is required."
      );

    const targetName=
      required(
        command.targetName,
        "A Company target name is required."
      );

    const rationale=
      required(
        command.rationale,
        "A merge rationale is required."
      );

    if(rationale.length<10||rationale.length>2000)
      throw new Error(
        "Merge rationale must be between 10 and 2000 characters."
      );

    if(
      !Array.isArray(command.componentDecisions)
      ||command.componentDecisions.length===0
    )
      throw new Error(
        "Explicit component decisions are required."
      );

    const closure=
      command.componentDecisions.find(
        decision=>
          decision.componentKind==="other"
          &&decision.componentKey==="merge_component_closure"
          &&decision.resolution==="target_override"
      );

    if(
      !closure
      ||!closure.resolvedPayload
      ||typeof closure.resolvedPayload!=="object"
      ||(
        closure.resolvedPayload as Record<string,unknown>
      ).schemaVersion!=="rdl-company-merge-closure/v1"
    )
      throw new Error(
        "The governed merge component closure is required."
      );

    /*
     * Re-read the mapping/context immediately before mutation.
     * Browser contributor identities are never accepted as inputs.
     */
    const preview=
      await this.repository.preview(contextKey,mappingId);

    if(preview.contextStatus!=="draft")
      throw new Error(
        "Component merge execution requires a draft Company context."
      );

    if(preview.decisionType!=="merge")
      throw new Error(
        "A governed Merge decision must be recorded before component resolution."
      );

    if(
      !preview.left.pinned
      ||!preview.right.pinned
    )
      throw new Error(
        "Both exact contributor packages must be pinned into the draft Company context before merge."
      );

    if(
      preview.left.entityType!==preview.right.entityType
    )
      throw new Error(
        "Merge contributors must have the same entity type."
      );

    return this.repository.execute({
      contextKey,
      mappingId,
      targetNativeIdentifier,
      targetName,
      targetDefinition:command.targetDefinition?.trim()||undefined,
      rationale,
      actor:identity.reviewer,
      componentDecisions:command.componentDecisions,
    });
  }
}

function required(value:string,message:string){
  const result=value?.trim()??"";
  if(!result)throw new Error(message);
  return result;
}

function validId(value:number,message:string){
  if(!Number.isSafeInteger(value)||value<=0)
    throw new Error(message);

  return value;
}
