import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { EffectiveStandardPublicationRepository } from "./EffectiveStandardPublicationRepository.ts";

export class EffectiveStandardPublicationService {
  constructor(private readonly repository:EffectiveStandardPublicationRepository) {}
  compare(contextKey:string){return this.repository.compare(requireText(contextKey,"A valid enterprise context is required."));}
  list(contextKey:string,limit:number){return this.repository.list(contextKey.trim(),limit);}
  get(releaseId:number){validateId(releaseId);return this.repository.get(releaseId);}
  publish(identity:GovernanceIdentity,command:{contextKey:string;releaseKey:string;releaseVersion:string}){
    const contextKey=requireText(command.contextKey,"A valid enterprise context is required.");
    const releaseKey=requireText(command.releaseKey,"A release key is required.");
    const releaseVersion=requireText(command.releaseVersion,"A release version is required.");
    if(!/^[A-Za-z0-9._-]{1,80}$/.test(releaseKey)) throw new Error("Release key contains unsupported characters.");
    if(!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(releaseVersion)) throw new Error("Release version contains unsupported characters.");
    return this.repository.publish(contextKey,releaseKey,releaseVersion,identity.reviewer);
  }
}
function requireText(value:string,message:string){const text=value?.trim()??"";if(!text)throw new Error(message);return text;}
function validateId(value:number){if(!Number.isSafeInteger(value)||value<=0)throw new Error("A valid releaseId is required.");}
