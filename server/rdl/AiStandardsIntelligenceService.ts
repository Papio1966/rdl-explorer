import type { AiEvidenceItem, AiStandardsIntelligenceRepository } from "./AiStandardsIntelligenceRepository.ts";

export type AiIntent = "explain_entity"|"release_change"|"impact_summary"|"mapping_suggestion"|"extension_review"|"migration_plan"|"work_queue"|"provenance"|"general";

export class AiStandardsIntelligenceService {
  constructor(private readonly repository: AiStandardsIntelligenceRepository) {}

  async evidence(question: string, actor: string) {
    const clean = required(question, "question");
    if (clean.length > 1800) throw new Error("question is too long.");
    return { intent: inferIntent(clean), items: await this.repository.collectEvidence(clean, required(actor,"actor")) };
  }

  record(input: { actor: string; intent: AiIntent; question: string; evidence: AiEvidenceItem[]; answer: string; model: string }) {
    if (!input.evidence.length) throw new Error("Evidence is required before recording an advisory answer.");
    return this.repository.recordAdvisory({ ...input, actor: required(input.actor,"actor"), question: required(input.question,"question"), answer: required(input.answer,"answer"), model: required(input.model,"model") });
  }
}

export function inferIntent(question: string): AiIntent {
  const q=question.toLowerCase();
  if (/provenance|source|origin|where.*come/.test(q)) return "provenance";
  if (/mapping|map|equivalent|cross-rdl/.test(q)) return "mapping_suggestion";
  if (/extension|approve|review.*extension/.test(q)) return "extension_review";
  if (/migration|adopt|readiness|remediation/.test(q)) return "migration_plan";
  if (/work queue|priority|overdue|sla|assignment/.test(q)) return "work_queue";
  if (/breaking|impact/.test(q)) return "impact_summary";
  if (/release|change|delta|version/.test(q)) return "release_change";
  if (/class|property|document|unit|entity|standard/.test(q)) return "explain_entity";
  return "general";
}
function required(value:string,name:string){const t=String(value??"").trim();if(!t)throw new Error(`${name} is required.`);return t;}
