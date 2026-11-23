import {
  CompanyContextActivationRepository,
  type CompanyContextActivation,
} from "./CompanyContextActivationRepository.ts";


type ReviewerIdentity = {
  reviewer:string;
};


export class CompanyContextActivationService {
  constructor(
    private readonly repository:
      CompanyContextActivationRepository
  ) {}


  activate(
    identity:ReviewerIdentity,
    input:{
      contextKey:string;
      effectiveStandardReleaseId:number;
      rationale:string;
    }
  ):Promise<CompanyContextActivation> {
    const contextKey=
      String(input.contextKey??"").trim();

    const rationale=
      String(input.rationale??"").trim();

    const actor=
      String(identity.reviewer??"").trim();

    if(!contextKey)
      throw new Error(
        "Company context key is required."
      );

    if(
      !Number.isSafeInteger(
        input.effectiveStandardReleaseId
      )
      ||
      input.effectiveStandardReleaseId<=0
    ){
      throw new Error(
        "A valid effectiveStandardReleaseId is required."
      );
    }

    if(
      rationale.length<10
      ||rationale.length>2000
    ){
      throw new Error(
        "Activation rationale must be between 10 and 2000 characters."
      );
    }

    if(!actor)
      throw new Error(
        "Authenticated reviewer identity is required."
      );

    return this.repository.activate({
      contextKey,
      effectiveStandardReleaseId:
        input.effectiveStandardReleaseId,
      rationale,
      actor,
    });
  }
}
