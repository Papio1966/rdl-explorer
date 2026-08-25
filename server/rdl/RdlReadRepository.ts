export type RdlPackageRecord = {
  sourceKey: string;
  releaseKey: string;
  versionLabel: string;
  packageKey: string;
  contentSha256: string | null;
  sourceUri: string | null;
};

export type RdlReadEntity = {
  entityId: number;
  packageKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition: string | null;
  lifecycleStatus: string;
  metadata: Record<string, unknown>;
  sourceLocator: Record<string, unknown>;
};

export interface RdlReadRepository {
  getPackage(): Promise<RdlPackageRecord | null>;
  countEntities(entityType: string): Promise<number>;
  getEntity(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity | null>;
  getChildren(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity[]>;
  getParent(entityType: string, nativeIdentifier: string): Promise<RdlReadEntity | null>;
}
