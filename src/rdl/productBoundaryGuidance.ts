export type WorkflowGuide = {
  title: string;
  summary: string;
  workflowPosition: string;
  primaryUsers: string[];
  howTo: string[];
  decisionGuidance: string[];
  consequences: string[];
};

export const CIS_BOUNDARY_DECISION = {
  title: "RDL Explorer / DataGate boundary",
  rdlExplorerOwns: [
    "governed standards and RDL hierarchy",
    "external proposal intake and governance decisions",
    "effective publication and package distribution",
    "consumer integration contracts for controlled downstream use",
  ],
  dataGateOwns: [
    "project CIS authoring and tailoring",
    "expected information baseline assembly for a project",
    "EPC submission validation, findings, correction and resubmission",
    "project execution state and owner-operator stewardship data capture",
  ],
  statement:
    "Project CIS authoring, tailoring and validation belongs to DataGate. RDL Explorer provides governed standards, publication and contract boundaries only.",
} as const;

export const MAPPING_GOVERNANCE_DECISIONS = [
  {
    action: "Confirm same concept / merge candidate",
    meaning:
      "Use only when the concepts are genuinely the same after reviewing names, definitions, properties, relationships, documents, units and source evidence.",
    consequence:
      "A downstream merge or equivalence decision may affect publication and consumer mappings. A rationale and evidence are required.",
  },
  {
    action: "Keep as separate concepts",
    meaning:
      "Use when similar names refer to different business or engineering meanings. Names and definitions must make the distinction clear.",
    consequence:
      "Both concepts remain governed and consumers must understand which one to use.",
  },
  {
    action: "Reject this match",
    meaning:
      "Use when the proposed match is not valid and should not progress as an equivalence or merge candidate.",
    consequence:
      "The candidate match is rejected while both source records remain available for independent governance.",
  },
  {
    action: "Retire or supersede one concept",
    meaning:
      "Use only when one concept should no longer be used and a replacement or retained concept is explicit.",
    consequence:
      "Consumers may need migration guidance and publication impact review before the change becomes effective.",
  },
  {
    action: "Request further analysis",
    meaning:
      "Use when evidence is insufficient to decide, especially when properties, relationships, documents or units differ.",
    consequence:
      "No governed decision is recorded until additional analysis is provided.",
  },
] as const;

export const ROUTE_WORKFLOW_GUIDES: Array<{ paths: string[]; guide: WorkflowGuide }> = [
  {
    paths: ["/control-tower"],
    guide: {
      title: "Standards Control Tower guide",
      summary: "Use this page to understand standards governance health, not to execute project CIS validation.",
      workflowPosition: "Operate: monitor governed RDL readiness and publication status before consumers such as DataGate use the standards.",
      primaryUsers: ["standards owner", "governance lead", "RDL product owner"],
      howTo: ["Review status indicators.", "Open exceptions or work items for investigation.", "Use publication/distribution pages for downstream release actions."],
      decisionGuidance: ["Do not use this page for EPC submission acceptance.", "Escalate unresolved standards quality issues to governance work queue."],
      consequences: ["Control Tower signals may block publication or require governance review before downstream consumers adopt a release."],
    },
  },
  {
    paths: ["/work-queue"],
    guide: {
      title: "Governance work queue guide",
      summary: "Use this page to manage RDL governance tasks and reviews.",
      workflowPosition: "Operate: triage RDL governance work before formal decision or publication.",
      primaryUsers: ["standards reviewer", "standards owner"],
      howTo: ["Filter to your assigned items.", "Open the detail page before deciding.", "Record rationale and evidence for any governed action."],
      decisionGuidance: ["Do not approve ambiguous changes without evidence.", "Request analysis when downstream impact is unclear."],
      consequences: ["Work queue actions can feed governed decisions and publication readiness."],
    },
  },
  {
    paths: ["/governance"],
    guide: {
      title: "Mapping governance decision guide",
      summary: "Use this page to decide whether candidate matches represent the same concept, separate concepts, invalid matches, or retirement/supersession cases.",
      workflowPosition: "Govern: review candidate cross-RDL mappings before governed publication or consumer use.",
      primaryUsers: ["standards owner", "engineering data steward", "discipline reviewer"],
      howTo: [
        "Compare names and definitions first.",
        "Check properties, relationships, documents, units of measure, controlled values and source evidence.",
        "Choose the decision that reflects the governance outcome, not merely the name similarity.",
        "Enter rationale before recording the decision.",
      ],
      decisionGuidance: MAPPING_GOVERNANCE_DECISIONS.map((decision) => `${decision.action}: ${decision.meaning}`),
      consequences: MAPPING_GOVERNANCE_DECISIONS.map((decision) => `${decision.action}: ${decision.consequence}`),
    },
  },
  {
    paths: ["/intelligence", "/hierarchy", "/extensions"],
    guide: {
      title: "Governance analysis guide",
      summary: "Use these pages to understand governed RDL relationships and extension candidates before decisions are made.",
      workflowPosition: "Govern: assess standards structure and extension impact.",
      primaryUsers: ["standards owner", "enterprise data architect", "discipline reviewer"],
      howTo: ["Review the candidate relationship or extension.", "Check whether dependencies are complete.", "Escalate unclear cases to formal governance."],
      decisionGuidance: ["Do not treat analysis output as an automatic approval.", "Use formal decision pages when the outcome changes governed state."],
      consequences: ["Incorrect extension or hierarchy decisions can affect published standards and downstream validation."],
    },
  },
  {
    paths: ["/publication", "/distribution", "/integration"],
    guide: {
      title: "Publication and consumer contract guide",
      summary: "Use these pages to publish governed RDL outputs and expose controlled packages to consumers such as DataGate.",
      workflowPosition: "Govern: publish and distribute approved standards after governance decisions are complete.",
      primaryUsers: ["standards owner", "consumer integration owner", "RDL product owner"],
      howTo: ["Confirm the governed release is ready.", "Review package composition and integrity.", "Use integration contracts for downstream consumers."],
      decisionGuidance: ["Publication is separate from proposal acceptance.", "Do not publish incomplete or unresolved governance outcomes."],
      consequences: ["Published packages can change downstream consumer behavior and must be traceable."],
    },
  },
  {
    paths: ["/impact", "/migration"],
    guide: {
      title: "Impact and migration planning guide",
      summary: "Use these pages to understand downstream impact before consumers adopt a new governed release.",
      workflowPosition: "Govern: plan controlled adoption and migration after standards changes.",
      primaryUsers: ["standards owner", "consumer owner", "data migration lead"],
      howTo: ["Review breaking and review-required changes.", "Identify affected consumers.", "Prepare migration guidance before adoption."],
      decisionGuidance: ["Do not force adoption when consumer impact is unresolved."],
      consequences: ["Migration decisions can affect DataGate and other consumers, but execution remains with the consuming product."],
    },
  },
];

export function guideForPath(pathname: string): WorkflowGuide | null {
  return ROUTE_WORKFLOW_GUIDES.find((entry) =>
    entry.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  )?.guide ?? null;
}
