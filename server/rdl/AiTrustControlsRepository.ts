import { createHash, randomUUID } from "node:crypto";
import type { SqlJsonClient } from "../db/PsqlJsonClient.ts";
import { sqlLiteral } from "../db/PsqlJsonClient.ts";

export type AiFeedbackClassification = "helpful" | "incorrect" | "incomplete";

export class AiTrustControlsRepository {
  constructor(private readonly client: SqlJsonClient) {}

  async summary() {
    const metrics = (await this.client.query<any>(`SELECT * FROM rdl.ai_trust_metrics`))[0] ?? {};
    const recentRuns = await this.client.query<any>(`
      SELECT advisory_key,actor_key,intent,model_key,prompt_version,evidence_item_count,created_at,
             feedback_count,helpful_count,incorrect_count,incomplete_count
      FROM rdl.ai_advisory_trust_summary
      ORDER BY created_at DESC LIMIT 12
    `);
    const recentEvaluations = await this.client.query<any>(`
      SELECT r.result_key,c.case_key,c.case_version,r.model_key,r.prompt_version,
             r.groundedness_score,r.evidence_coverage_score,r.unsupported_claim_count,
             r.verdict,r.evaluated_at
      FROM rdl.ai_evaluation_result r
      JOIN rdl.ai_evaluation_case c ON c.ai_evaluation_case_id=r.ai_evaluation_case_id
      ORDER BY r.evaluated_at DESC LIMIT 12
    `);
    return { metrics, recentRuns, recentEvaluations };
  }

  async recordFeedback(input: { advisoryKey: string; actor: string; classification: AiFeedbackClassification; comment?: string; evidenceConcern?: boolean }) {
    const feedbackKey = `feedback-${randomUUID()}`;
    const rows = await this.client.query<any>(`
      INSERT INTO rdl.ai_feedback(feedback_key,advisory_key,actor_key,classification,comment,evidence_concern)
      VALUES(${sqlLiteral(feedbackKey)},${sqlLiteral(input.advisoryKey)},${sqlLiteral(input.actor)},${sqlLiteral(input.classification)},${sqlLiteral(input.comment ?? "")},${input.evidenceConcern ? "true" : "false"})
      RETURNING feedback_key,advisory_key,classification,evidence_concern,created_at
    `);
    return rows[0] ?? null;
  }

  async recordEvaluation(input: { caseId: number; model: string; promptVersion: string; groundednessScore: number; evidenceCoverageScore: number; unsupportedClaimCount: number; verdict: "pass"|"review"|"fail"; detail: unknown; actor: string }) {
    const resultKey = `eval-${randomUUID()}`;
    const detail = JSON.stringify(input.detail ?? {});
    const fingerprint = createHash("sha256").update(JSON.stringify({ resultKey, ...input, detail }), "utf8").digest("hex");
    const rows = await this.client.query<any>(`
      INSERT INTO rdl.ai_evaluation_result(result_key,ai_evaluation_case_id,model_key,prompt_version,groundedness_score,evidence_coverage_score,unsupported_claim_count,verdict,result_detail,result_sha256,evaluated_by)
      VALUES(${sqlLiteral(resultKey)},${Math.trunc(input.caseId)},${sqlLiteral(input.model)},${sqlLiteral(input.promptVersion)},${input.groundednessScore},${input.evidenceCoverageScore},${Math.trunc(input.unsupportedClaimCount)},${sqlLiteral(input.verdict)},${sqlLiteral(detail)}::jsonb,${sqlLiteral(fingerprint)},${sqlLiteral(input.actor)})
      RETURNING result_key,result_sha256,verdict,evaluated_at
    `);
    return rows[0] ?? null;
  }
}
