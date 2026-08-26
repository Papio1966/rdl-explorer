import { createHash } from "node:crypto";
export type ReleaseNotice={releaseId:number;compositionSha256:string;eventType:string};
export function verifyConsumerPackage(notice:ReleaseNotice,packageBody:unknown,reportedSha256:string){if(!Number.isSafeInteger(notice.releaseId)||notice.releaseId<=0)throw new Error("Invalid release notice.");if(!/^[0-9a-f]{64}$/i.test(reportedSha256))throw new Error("Invalid package integrity value.");const calculated=createHash("sha256").update(JSON.stringify(packageBody)).digest("hex");return {releaseId:notice.releaseId,verified:calculated===reportedSha256,calculatedSha256:calculated};}
export function referenceConsumerLifecycle(){return ["notify","pull","verify","stage","activate"] as const;}
