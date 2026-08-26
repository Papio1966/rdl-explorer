import type { PublishedPackageDistributionRepository } from "./PublishedPackageDistributionRepository.ts";
export class PublishedPackageDistributionService{
  constructor(private readonly repository:PublishedPackageDistributionRepository){}
  catalogue(contextKey:string,limit:number){return this.repository.catalogue(contextKey.trim(),Number.isFinite(limit)?limit:100);}
  manifest(releaseId:number){validateId(releaseId);return this.repository.manifest(releaseId);}
  entities(releaseId:number,entityType:string,query:string){validateId(releaseId);return this.repository.entities(releaseId,entityType.trim(),query.trim());}
  package(releaseId:number){validateId(releaseId);return this.repository.consumerPackage(releaseId);}
}
function validateId(value:number){if(!Number.isSafeInteger(value)||value<=0)throw new Error("A valid releaseId is required.");}
