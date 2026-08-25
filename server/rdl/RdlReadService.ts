import type { RdlReadRepository } from "./RdlReadRepository.ts";

/**
 * Server-side application boundary for normalized RDL reads.
 * RDL-005 keeps this parallel to the browser's CFIHOS snapshot repositories.
 */
export class RdlReadService {
  constructor(private readonly repository: RdlReadRepository) {}

  getPackage() {
    return this.repository.getPackage();
  }

  getEntity(entityType: string, nativeIdentifier: string) {
    return this.repository.getEntity(entityType, nativeIdentifier);
  }

  getChildren(entityType: string, nativeIdentifier: string) {
    return this.repository.getChildren(entityType, nativeIdentifier);
  }

  getParent(entityType: string, nativeIdentifier: string) {
    return this.repository.getParent(entityType, nativeIdentifier);
  }
}
