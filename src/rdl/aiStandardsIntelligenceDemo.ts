import type { AiEvidenceItem } from "./aiStandardsIntelligenceService";
export const aiStandardsDemoEvidence:AiEvidenceItem[]=[
{id:"demo:release-impact",kind:"Release impact analysis",title:"Published release change intelligence",detail:"RDL Explorer can explain release deltas and why a change is potentially breaking when governed impact evidence is available.",source:"application",authority:"derived",route:"/impact"},
{id:"demo:migration",kind:"Migration planning",title:"Controlled adoption remains authoritative",detail:"AI may summarize remediation and readiness evidence, but cannot approve, stage, activate or migrate a project or consumer.",source:"application",authority:"direct",route:"/migration"},
{id:"demo:provenance",kind:"Provenance",title:"Evidence-backed explanations",detail:"Answers retain explicit evidence identifiers and links back to authoritative RDL or governance workflows.",source:"application",authority:"direct",route:"/rdls"}
];
