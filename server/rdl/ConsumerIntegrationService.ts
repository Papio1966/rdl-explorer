import type { ConsumerIntegrationRepository } from "./ConsumerIntegrationRepository.ts";

export class ConsumerIntegrationService {
  constructor(private readonly repository:ConsumerIntegrationRepository) {}
  subscriptions(consumerKey:string){return this.repository.subscriptions(requiredText(consumerKey,"consumerKey"));}
  inbox(consumerKey:string,limit:number){return this.repository.inbox(requiredText(consumerKey,"consumerKey"),Number.isFinite(limit)?limit:100);}
  acknowledge(consumerKey:string,notificationId:number,actor:string){validId(notificationId,"notificationId");return this.repository.acknowledge(requiredText(consumerKey,"consumerKey"),notificationId,requiredText(actor,"actor"));}
  stage(consumerKey:string,subscriptionId:number,releaseId:number,packageSha256:string,requestKey:string){validId(subscriptionId,"subscriptionId");validId(releaseId,"releaseId");if(!/^[0-9a-f]{64}$/i.test(packageSha256))throw new Error("A valid packageSha256 is required.");return this.repository.stage(requiredText(consumerKey,"consumerKey"),subscriptionId,releaseId,packageSha256,requiredText(requestKey,"requestKey"));}
  activate(consumerKey:string,subscriptionId:number,releaseId:number){validId(subscriptionId,"subscriptionId");validId(releaseId,"releaseId");return this.repository.activate(requiredText(consumerKey,"consumerKey"),subscriptionId,releaseId);}
}
function validId(value:number,name:string){if(!Number.isSafeInteger(value)||value<=0)throw new Error(`A valid ${name} is required.`);}
function requiredText(value:string,name:string){const normalized=value.trim();if(!normalized)throw new Error(`${name} is required.`);return normalized;}
