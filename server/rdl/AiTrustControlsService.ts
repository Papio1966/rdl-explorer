import type { AiFeedbackClassification, AiTrustControlsRepository } from "./AiTrustControlsRepository.ts";

export class AiTrustControlsService {
  constructor(private readonly repository: AiTrustControlsRepository) {}

  summary() { return this.repository.summary(); }

  feedback(input: { advisoryKey: string; actor: string; classification: AiFeedbackClassification; comment?: string; evidenceConcern?: boolean }) {
    const advisoryKey = required(input.advisoryKey, "advisoryKey");
    const actor = required(input.actor, "actor");
    if (!["helpful","incorrect","incomplete"].includes(input.classification)) throw new Error("classification is invalid.");
    const comment = String(input.comment ?? "").trim();
    if (comment.length > 1200) throw new Error("comment is too long.");
    return this.repository.recordFeedback({ ...input, advisoryKey, actor, comment });
  }
}

function required(value:string,name:string){const t=String(value??"").trim();if(!t)throw new Error(`${name} is required.`);return t;}
