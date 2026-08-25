export type RdlRepositoryKind = "cfihos-snapshot" | "postgresql";

export type RdlRepositoryHealth = {
  kind: RdlRepositoryKind;
  ok: boolean;
  message?: string;
};

/**
 * Stable application-facing repository boundary for RDL data.
 *
 * RDL-002 introduces the boundary only. The current CFIHOS snapshot path remains
 * active until the PostgreSQL implementation reaches parity in RDL-004.
 */
export interface RdlRepository {
  readonly kind: RdlRepositoryKind;
  health(): Promise<RdlRepositoryHealth>;
}
