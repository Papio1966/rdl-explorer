import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type ConsumerSubscription = {
  subscriptionId:number; consumerKey:string; contextKey?:string; contractVersion:string;
  notificationMode:"pull"|"webhook-contract"; callbackReference?:string; enabled:boolean;
};
export type ConsumerNotification = {
  notificationId:number; eventType:"release.published"|"release.deprecated"|"release.superseded";
  changeClassification:"compatible"|"review_required"|"breaking"|"unknown";
  createdAt:string; acknowledgedAt?:string; acknowledgedBy?:string;
  subscriptionId:number; consumerKey:string; releaseId:number; releaseKey:string; releaseVersion:string;
  compositionSha256:string; contextName:string; consumerLifecycleStatus:"discovered"|"staged"|"activated"|"rejected";
};

export class ConsumerIntegrationRepository {
  constructor(private readonly client:SqlJsonClient) {}

  async subscriptions(consumerKey:string):Promise<ConsumerSubscription[]> {
    const rows=await this.client.query<any>(`SELECT * FROM rdl.consumer_subscription WHERE consumer_key=${sqlLiteral(consumerKey)} AND enabled ORDER BY subscription_id`);
    return rows.map(mapSubscription);
  }

  async inbox(consumerKey:string,limit=100):Promise<ConsumerNotification[]> {
    const safeLimit=Math.max(1,Math.min(limit,250));
    const rows=await this.client.query<any>(`SELECT * FROM rdl.consumer_release_inbox WHERE consumer_key=${sqlLiteral(consumerKey)} ORDER BY created_at DESC,notification_id DESC LIMIT ${safeLimit}`);
    return rows.map(mapNotification);
  }

  async acknowledge(consumerKey:string,notificationId:number,actor:string){
    const rows=await this.client.query<any>(`UPDATE rdl.release_notification n SET acknowledged_at=COALESCE(n.acknowledged_at,now()),acknowledged_by=COALESCE(n.acknowledged_by,${sqlLiteral(actor)}) FROM rdl.consumer_subscription s WHERE n.subscription_id=s.subscription_id AND s.consumer_key=${sqlLiteral(consumerKey)} AND n.notification_id=${Number(notificationId)} RETURNING n.notification_id,n.acknowledged_at,n.acknowledged_by`);
    return rows[0];
  }

  async stage(consumerKey:string,subscriptionId:number,releaseId:number,packageSha256:string,requestKey:string){
    const owned=await this.client.query<any>(`SELECT 1 FROM rdl.consumer_subscription WHERE subscription_id=${Number(subscriptionId)} AND consumer_key=${sqlLiteral(consumerKey)} AND enabled LIMIT 1`);
    if(!owned.length) return undefined;
    await this.client.query<any>(`INSERT INTO rdl.consumer_pull_receipt(subscription_id,effective_standard_release_id,request_key,package_sha256) VALUES(${Number(subscriptionId)},${Number(releaseId)},${sqlLiteral(requestKey)},${sqlLiteral(packageSha256)}) ON CONFLICT (subscription_id,request_key) DO NOTHING`);
    const rows=await this.client.query<any>(`UPDATE rdl.consumer_release_state SET lifecycle_status='staged',package_sha256=${sqlLiteral(packageSha256)},staged_at=COALESCE(staged_at,now()) WHERE subscription_id=${Number(subscriptionId)} AND effective_standard_release_id=${Number(releaseId)} AND lifecycle_status IN ('discovered','staged') RETURNING *`);
    return rows[0];
  }

  async activate(consumerKey:string,subscriptionId:number,releaseId:number){
    const rows=await this.client.query<any>(`UPDATE rdl.consumer_release_state st SET lifecycle_status='activated',activated_at=COALESCE(activated_at,now()) FROM rdl.consumer_subscription s WHERE st.subscription_id=s.subscription_id AND s.consumer_key=${sqlLiteral(consumerKey)} AND s.enabled AND st.subscription_id=${Number(subscriptionId)} AND st.effective_standard_release_id=${Number(releaseId)} AND st.lifecycle_status='staged' RETURNING st.*`);
    return rows[0];
  }
}

function mapSubscription(row:any):ConsumerSubscription{return {subscriptionId:Number(row.subscription_id),consumerKey:String(row.consumer_key),contextKey:row.context_key??undefined,contractVersion:String(row.contract_version),notificationMode:row.notification_mode,callbackReference:row.callback_reference??undefined,enabled:Boolean(row.enabled)};}
function mapNotification(row:any):ConsumerNotification{return {notificationId:Number(row.notification_id),eventType:row.event_type,changeClassification:row.change_classification,createdAt:row.created_at,acknowledgedAt:row.acknowledged_at??undefined,acknowledgedBy:row.acknowledged_by??undefined,subscriptionId:Number(row.subscription_id),consumerKey:String(row.consumer_key),releaseId:Number(row.release_id),releaseKey:String(row.release_key),releaseVersion:String(row.release_version),compositionSha256:String(row.composition_sha256),contextName:String(row.context_name),consumerLifecycleStatus:row.consumer_lifecycle_status??"discovered"};}
