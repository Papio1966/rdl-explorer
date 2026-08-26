import type { GovernanceIdentity } from "../auth/GovernanceIdentity.ts";
import type { EnterpriseExtensionAction, EnterpriseExtensionRepository } from "./EnterpriseExtensionRepository.ts";

export type CreateExtensionCommand = {
  contextKey: string;
  changeKind: "add" | "override" | "retire";
  entityType: string;
  nativeIdentifier: string;
  baseEntityId?: number;
  proposedName?: string;
  proposedDefinition?: string;
  rationale: string;
  provenance?: Record<string, unknown>;
};

export class EnterpriseExtensionService {
  constructor(private readonly repository: EnterpriseExtensionRepository) {}
  list(status:string, contextKey:string, limit:number) { return this.repository.list(status, contextKey, limit); }
  preview(extensionChangeId:number) { validateId(extensionChangeId); return this.repository.preview(extensionChangeId); }
  async create(identity:GovernanceIdentity, command:CreateExtensionCommand) {
    validateCreate(command);
    return this.repository.create({ ...command, contextKey:command.contextKey.trim(), entityType:command.entityType.trim(), nativeIdentifier:command.nativeIdentifier.trim(), rationale:command.rationale.trim(), proposedBy:identity.reviewer });
  }
  async publish(identity:GovernanceIdentity, command:{contextKey:string;effectivePackageId:number}) {
    if (!command.contextKey?.trim()) throw new Error("A valid enterprise context is required.");
    if (!Number.isSafeInteger(command.effectivePackageId) || command.effectivePackageId <= 0) throw new Error("A valid effectivePackageId is required.");
    return this.repository.publish(command.contextKey.trim(),command.effectivePackageId,identity.reviewer);
  }
  async promote(identity:GovernanceIdentity, command:{extensionChangeId:number;targetContextKey:string;rationale:string}) {
    validateId(command.extensionChangeId);
    if (!command.targetContextKey?.trim()) throw new Error("A valid target enterprise context is required.");
    const rationale=command.rationale?.trim() ?? "";
    if (rationale.length < 10 || rationale.length > 2000) throw new Error("Promotion rationale must be between 10 and 2000 characters.");
    return this.repository.promote(command.extensionChangeId,command.targetContextKey.trim(),identity.reviewer,rationale);
  }
  async review(identity:GovernanceIdentity, command:{extensionChangeId:number;action:EnterpriseExtensionAction;rationale:string;expectedVersion:number;evidence?:Record<string,unknown>}) {
    validateId(command.extensionChangeId);
    if (!(["submit","approve","reject","retire"] as string[]).includes(command.action)) throw new Error("Unsupported extension governance action.");
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0) throw new Error("A valid expectedVersion is required.");
    if ((command.rationale?.trim() ?? "").length < 10 || command.rationale.trim().length > 2000) throw new Error("Review rationale must be between 10 and 2000 characters.");
    if (command.action === "approve") {
      const preview = await this.repository.preview(command.extensionChangeId);
      if (preview.conflicts.length > 0) throw new Error("Extension conflict must be resolved before approval.");
    }
    return this.repository.review(command.extensionChangeId,command.action,identity.reviewer,command.rationale.trim(),command.expectedVersion,command.evidence ?? {});
  }
}

function validateId(value:number) { if (!Number.isSafeInteger(value) || value <= 0) throw new Error("A valid extensionChangeId is required."); }
function validateCreate(command:CreateExtensionCommand) {
  if (!command.contextKey?.trim()) throw new Error("A valid enterprise context is required.");
  if (!(["add","override","retire"] as string[]).includes(command.changeKind)) throw new Error("Unsupported extension change kind.");
  if (!command.entityType?.trim() || !command.nativeIdentifier?.trim()) throw new Error("Entity type and native identifier are required.");
  const rationale=command.rationale?.trim() ?? "";
  if (rationale.length < 10 || rationale.length > 2000) throw new Error("Extension rationale must be between 10 and 2000 characters.");
  if (command.changeKind === "add" && command.baseEntityId != null) throw new Error("Add extensions cannot reference a base entity.");
  if (command.changeKind !== "add" && (!Number.isSafeInteger(command.baseEntityId) || (command.baseEntityId ?? 0) <= 0)) throw new Error("Override and retire extensions require a valid baseEntityId.");
  if (command.changeKind !== "retire" && !command.proposedName?.trim()) throw new Error("A proposed name is required for add or override extensions.");
}
