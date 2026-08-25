import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { CrossRdlGovernanceRepository, MappingReviewAction } from "./CrossRdlGovernanceRepository.ts";

export type GovernanceReviewCommand = {
  mappingId: number;
  action: MappingReviewAction;
  rationale: string;
  expectedVersion: number;
  evidence?: Record<string, unknown>;
  successorMappingId?: number;
};

export class GovernanceService {
  constructor(private readonly repository: CrossRdlGovernanceRepository) {}

  listQueue(status: string, limit: number) {
    return this.repository.listReviewQueue(status, limit);
  }

  getHistory(mappingId: number) {
    return this.repository.getHistory(mappingId);
  }

  async review(identity: GovernanceIdentity, command: GovernanceReviewCommand) {
    validateCommand(command);
    return this.repository.review(
      command.mappingId,
      command.action,
      identity.reviewer,
      command.rationale.trim(),
      command.expectedVersion,
      command.evidence ?? {},
      command.successorMappingId,
    );
  }
}

function validateCommand(command: GovernanceReviewCommand) {
  if (!Number.isSafeInteger(command.mappingId) || command.mappingId <= 0) throw new Error("A valid mappingId is required.");
  if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0) throw new Error("A valid expectedVersion is required.");
  if (!(["approve", "reject", "supersede"] as string[]).includes(command.action)) throw new Error("Unsupported governance action.");
  const rationale = command.rationale?.trim() ?? "";
  if (rationale.length < 10 || rationale.length > 2000) throw new Error("Review rationale must be between 10 and 2000 characters.");
  if (command.action === "supersede" && (!Number.isSafeInteger(command.successorMappingId) || (command.successorMappingId ?? 0) <= 0)) {
    throw new Error("Supersede requires a valid successorMappingId.");
  }
}
