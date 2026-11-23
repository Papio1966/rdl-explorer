import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { CompanyRdlAdoptionRepository } from "./CompanyRdlAdoptionRepository.ts";

export class CompanyRdlAdoptionService {
  constructor(private readonly repository:CompanyRdlAdoptionRepository) {}

  listPublishedIndustryPackages() {
    return this.repository.listPublishedIndustryPackages();
  }

  createCompanyContext(
    identity:GovernanceIdentity,
    input:{contextKey:string;name:string;ownerReference?:string}
  ) {
    const contextKey=requireText(input.contextKey,"Company context key is required.");
    const name=requireText(input.name,"Company context name is required.");

    return this.repository.createCompanyContext({
      contextKey,
      name,
      ownerReference:input.ownerReference?.trim() || identity.reviewer,
    });
  }

  pinIndustryPackage(
    identity:GovernanceIdentity,
    input:{contextKey:string;packageId:number;precedence:number;reason:string}
  ) {
    void identity;

    const contextKey=requireText(input.contextKey,"Company context key is required.");
    const reason=requireRationale(input.reason);

    if(!Number.isSafeInteger(input.packageId) || input.packageId<=0)
      throw new Error("A valid packageId is required.");

    if(!Number.isSafeInteger(input.precedence) ||
       input.precedence<1 ||
       input.precedence>400)
      throw new Error("Package precedence must be between 1 and 400.");

    return this.repository.pinIndustryPackage({
      contextKey,
      packageId:input.packageId,
      precedence:input.precedence,
      reason,
    });
  }

  createComposition(
    identity:GovernanceIdentity,
    input:{
      contextKey:string;
      compositionKind:"multi_source_merge"|"derived_copy"|"promotion";
      targetEntityType:string;
      targetNativeIdentifier:string;
      targetName:string;
      targetDefinition?:string;
      rationale:string;
      contributors:Array<{
        sourceEntityId:number;
        contributionRole:"primary"|"contributor"|"reference";
      }>;
      componentDecisions:Array<{
        componentKind:string;
        componentKey:string;
        resolution:string;
        selectedSourceEntityId?:number;
        resolvedPayload?:Record<string,unknown>;
        rationale:string;
      }>;
    }
  ) {
    const contextKey=requireText(input.contextKey,"Company context key is required.");
    const targetEntityType=requireText(input.targetEntityType,"Target entity type is required.");
    const targetNativeIdentifier=requireText(input.targetNativeIdentifier,"Target native identifier is required.");
    const targetName=requireText(input.targetName,"Target name is required.");
    const rationale=requireRationale(input.rationale);

    if(!["multi_source_merge","derived_copy","promotion"].includes(input.compositionKind))
      throw new Error("Unsupported composition kind.");

    if(!Array.isArray(input.contributors) || input.contributors.length===0)
      throw new Error("At least one exact L1 contributor is required.");

    for(const contributor of input.contributors) {
      if(!Number.isSafeInteger(contributor.sourceEntityId) || contributor.sourceEntityId<=0)
        throw new Error("Every contributor requires a valid sourceEntityId.");

      if(!["primary","contributor","reference"].includes(contributor.contributionRole))
        throw new Error("Unsupported contributor role.");
    }

    for(const decision of input.componentDecisions ?? []) {
      requireText(decision.componentKind,"Component kind is required.");
      requireText(decision.componentKey,"Component key is required.");
      requireText(decision.resolution,"Component resolution is required.");
      requireRationale(decision.rationale);
    }

    return this.repository.createComposition({
      ...input,
      contextKey,
      targetEntityType,
      targetNativeIdentifier,
      targetName,
      rationale,
      createdBy:identity.reviewer,
      componentDecisions:input.componentDecisions ?? [],
    });
  }
  listPublishedPackageEntities(
    packageId:number,
    query:string,
    limit:number
  ) {
    if(!Number.isSafeInteger(packageId)||packageId<=0)
      throw new Error("A valid packageId is required.");

    return this.repository.listPublishedPackageEntities(
      packageId,
      query?.trim()??"",
      limit
    );
  }


  listCollisionCandidates(
    contextKey:string,
    entityId:number,
    limit:number
  ) {
    const context=requireText(
      contextKey,
      "Company context key is required."
    );

    if(!Number.isSafeInteger(entityId)||entityId<=0)
      throw new Error("A valid entityId is required.");

    return this.repository.listCollisionCandidates(
      context,
      entityId,
      limit
    );
  }


  recordCollisionDecision(
    identity:GovernanceIdentity,
    input:{
      contextKey:string;
      mappingId:number;
      decisionType:
        |"merge"
        |"keep_separate"
        |"rename"
        |"exclude"
        |"defer";
      subjectEntityId?:number;
      targetName?:string;
      rationale:string;
      expectedVersion:number;
    }
  ) {
    const contextKey=requireText(
      input.contextKey,
      "Company context key is required."
    );

    if(
      !Number.isSafeInteger(input.mappingId)
      ||input.mappingId<=0
    )
      throw new Error("A valid mappingId is required.");

    if(![
      "merge",
      "keep_separate",
      "rename",
      "exclude",
      "defer",
    ].includes(input.decisionType))
      throw new Error(
        "Unsupported Company adoption collision decision."
      );

    if(
      !Number.isSafeInteger(input.expectedVersion)
      ||input.expectedVersion<0
    )
      throw new Error(
        "A valid expectedVersion is required."
      );

    const rationale=requireRationale(input.rationale);

    if(
      ["rename","exclude"].includes(input.decisionType)
      &&(
        !Number.isSafeInteger(input.subjectEntityId)
        ||(input.subjectEntityId??0)<=0
      )
    )
      throw new Error(
        "Rename and Exclude require the exact subject entity."
      );

    if(
      input.decisionType==="rename"
      &&!(input.targetName?.trim())
    )
      throw new Error(
        "Rename requires a governed target name."
      );

    return this.repository.recordCollisionDecision({
      contextKey,
      mappingId:input.mappingId,
      decisionType:input.decisionType,
      subjectEntityId:
        input.subjectEntityId==null
          ?undefined
          :input.subjectEntityId,
      targetName:input.targetName?.trim()||undefined,
      rationale,
      decidedBy:identity.reviewer,
      expectedVersion:input.expectedVersion,
    });
  }

}

function requireText(value:string,message:string) {
  const result=value?.trim() ?? "";
  if(!result) throw new Error(message);
  return result;
}

function requireRationale(value:string) {
  const result=value?.trim() ?? "";
  if(result.length<10 || result.length>2000)
    throw new Error("Rationale must be between 10 and 2000 characters.");
  return result;
}
