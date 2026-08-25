import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { DualReadRdlRepository, type DualReadDiagnostics } from "./DualReadRdlRepository.ts";
import { PostgresRdlRepository } from "./PostgresRdlRepository.ts";
import { SnapshotRdlReadRepository } from "./SnapshotRdlReadRepository.ts";
import type { RdlCutoverSelection, RdlReadMode } from "./RdlCutoverRepository.ts";

type Snapshot = ConstructorParameters<typeof SnapshotRdlReadRepository>[0];

export function parseRdlReadMode(value = process.env.RDL_READ_MODE): RdlReadMode {
  const mode = (value ?? "snapshot").trim().toLowerCase();
  if (mode === "snapshot" || mode === "postgresql" || mode === "dual") return mode;
  throw new Error(`Invalid RDL_READ_MODE '${value}'. Expected snapshot, postgresql or dual.`);
}

export function selectRdlRepository(options: { snapshot: Snapshot; client: SqlJsonClient; mode?: RdlReadMode; diagnostics?: DualReadDiagnostics }): RdlCutoverSelection {
  const mode = options.mode ?? parseRdlReadMode();
  const snapshotRepository = new SnapshotRdlReadRepository(options.snapshot);
  const postgresRepository = new PostgresRdlRepository(options.client);

  if (mode === "snapshot") return { mode, repository: snapshotRepository, referenceRepository: snapshotRepository, candidateRepository: postgresRepository };
  if (mode === "postgresql") return { mode, repository: postgresRepository, referenceRepository: snapshotRepository, candidateRepository: postgresRepository };
  return { mode, repository: new DualReadRdlRepository(snapshotRepository, postgresRepository, options.diagnostics), referenceRepository: snapshotRepository, candidateRepository: postgresRepository };
}
