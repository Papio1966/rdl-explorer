export type MappingGovernanceDecisionId =
  | "confirm_same_concept"
  | "keep_separate_concepts"
  | "reject_match"
  | "retire_or_supersede"
  | "request_further_analysis";

export type MappingGovernanceDecisionOption = {
  id: MappingGovernanceDecisionId;
  label: string;
  meaning: string;
  reviewerPrompt: string;
  consequence: string;
  reversibility: string;
};

export type MappingGovernanceEvidenceDimension = {
  id: string;
  label: string;
  question: string;
};

export type MappingGovernanceConsequenceTopic = {
  topic: string;
  preview: string;
};

export type MappingGovernanceAuditField = {
  field: string;
  purpose: string;
};

export const MAPPING_GOVERNANCE_DECISION_OPTIONS: MappingGovernanceDecisionOption[] = [
  {
    id: "confirm_same_concept",
    label: "Confirm same concept / merge candidate",
    meaning: "The candidate records represent the same governed engineering or standards concept after evidence comparison.",
    reviewerPrompt: "Confirm only after checking names, definitions, properties, relationships, documents, units, controlled values and source evidence.",
    consequence: "The concept can progress as an equivalence or merge candidate for governed publication and consumer mapping review.",
    reversibility: "Reviewable before publication; publication requires separate governed release control.",
  },
  {
    id: "keep_separate_concepts",
    label: "Keep as separate concepts",
    meaning: "The records look similar but represent different meanings, contexts or usage rules.",
    reviewerPrompt: "Document the distinguishing evidence so future reviewers and consumers understand why both concepts remain valid.",
    consequence: "Both concepts remain governed separately and consumer guidance must make the distinction clear.",
    reversibility: "Can be reconsidered if new evidence later proves the concepts are equivalent.",
  },
  {
    id: "reject_match",
    label: "Reject match",
    meaning: "The proposed mapping is not supported by the evidence and should not progress as an equivalence candidate.",
    reviewerPrompt: "State which evidence disproves the match or why the candidate was generated incorrectly.",
    consequence: "The candidate link is rejected while the underlying source records remain independently available for governance.",
    reversibility: "A new candidate can be submitted if better evidence is later provided.",
  },
  {
    id: "retire_or_supersede",
    label: "Retire / supersede one concept",
    meaning: "One governed concept should stop being used, or should be replaced by another explicit retained concept.",
    reviewerPrompt: "Identify the retained concept, migration need, consumer impact and publication timing before confirming.",
    consequence: "Downstream consumers may require migration guidance before the retirement or supersession becomes effective.",
    reversibility: "Potentially high impact after publication; requires explicit follow-up and release governance.",
  },
  {
    id: "request_further_analysis",
    label: "Request further analysis",
    meaning: "The available evidence is insufficient to make a governed decision safely.",
    reviewerPrompt: "Specify the missing evidence, steward role or comparison dimension needed before a decision can be recorded.",
    consequence: "No governed mapping decision is recorded until the requested analysis is supplied.",
    reversibility: "Not a final decision; it keeps the candidate open for evidence completion.",
  },
];

export const MAPPING_GOVERNANCE_EVIDENCE_DIMENSIONS: MappingGovernanceEvidenceDimension[] = [
  { id: "name", label: "Concept / class name", question: "Do the names describe the same governed concept, or only look similar?" },
  { id: "definition", label: "Description / definition", question: "Do the definitions align in engineering meaning and intended use?" },
  { id: "properties", label: "Properties", question: "Are required properties, metadata and controlled fields compatible?" },
  { id: "relationships", label: "Relationships", question: "Do parent, child, dependency and association relationships support the same concept?" },
  { id: "documents", label: "Documents", question: "Do document requirements or deliverables point to the same governed scope?" },
  { id: "units", label: "Units and controlled values", question: "Are units of measure, picklists and allowed values consistent or intentionally different?" },
  { id: "source", label: "Source standard and envelope level", question: "Which source standard, envelope level and governance owner are authoritative?" },
];

export const MAPPING_GOVERNANCE_CONSEQUENCE_PREVIEW: MappingGovernanceConsequenceTopic[] = [
  { topic: "Proposed standards change", preview: "Shows the governed mapping, separation, rejection, retirement or analysis request before it is recorded." },
  { topic: "Unchanged items", preview: "Clarifies which source records, definitions or relationships remain unchanged by this decision." },
  { topic: "Downstream consumer impact", preview: "Highlights publication, distribution, integration and consumer mapping effects that need review." },
  { topic: "DataGate / project-validation impact", preview: "Confirms that RDL Explorer records the standards decision while DataGate consumes published standards for project validation." },
  { topic: "Reversibility and follow-up checks", preview: "Identifies whether the decision is easy to revisit or requires migration / publication governance before effectivity." },
];

export const MAPPING_GOVERNANCE_AUDIT_READBACK_FIELDS: MappingGovernanceAuditField[] = [
  { field: "Decision type", purpose: "Stores the governed decision option selected by the reviewer." },
  { field: "Rationale", purpose: "Captures why the decision is justified, including engineering and standards reasoning." },
  { field: "Evidence basis", purpose: "Records which comparison dimensions supported or blocked the decision." },
  { field: "Reviewer role", purpose: "Distinguishes standards owner, engineering data steward, discipline reviewer and product-owner accountability." },
  { field: "Timestamp", purpose: "Provides audit traceability for when the decision was recorded or returned for analysis." },
  { field: "Reversibility status", purpose: "Flags whether the decision is reviewable, publication-sensitive or migration-sensitive." },
  { field: "Related publication or follow-up state", purpose: "Links the decision to publication readiness, consumer impact review or additional analysis." },
];

export const RDL_EXPLORER_DATAGATE_MAPPING_BOUNDARY =
  "RDL Explorer governs mapping decisions, standards publication and consumer contracts. DataGate consumes governed standards and validates project data; RDL Explorer must not mutate DataGate project validation state.";
