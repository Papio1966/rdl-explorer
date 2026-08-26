export type EnterpriseLayer = {
  level: "L1" | "L2" | "L3" | "L4";
  kind: "industry" | "company" | "asset" | "project";
  title: string;
  subtitle: string;
  source: string;
  status: "authoritative" | "governed-extension" | "project-pinned";
  examples: string[];
};

export const ENTERPRISE_LAYER_DEMO: EnterpriseLayer[] = [
  { level:"L1", kind:"industry", title:"Industry RDL", subtitle:"Immutable upstream baseline", source:"CFIHOS 2.0 reviewed baseline", status:"authoritative", examples:["Classes and properties","Document requirements","Units and controlled values"] },
  { level:"L2", kind:"company", title:"Company RDL", subtitle:"Company-wide governed extensions", source:"Demonstration company layer", status:"governed-extension", examples:["Company naming conventions","Company maintenance classifications","Approved company additions"] },
  { level:"L3", kind:"asset", title:"Asset RDL", subtitle:"Asset-specific governed extensions", source:"Demonstration asset layer", status:"governed-extension", examples:["Asset-specific equipment variants","Local regulatory requirements","Asset property constraints"] },
  { level:"L4", kind:"project", title:"Project / CIS RDL", subtitle:"Frozen project execution context", source:"Demonstration project layer", status:"project-pinned", examples:["CIS requirements","Approved project extensions","Exact upstream package pins"] },
];

export const ENTERPRISE_COMPOSITION_RULES = [
  "Upstream packages remain immutable; extensions reference or override them explicitly.",
  "Company → Asset → Project is a governed parent chain. A project cannot skip its Asset and Company context.",
  "An active project pins exact package versions and does not auto-migrate when upstream standards change.",
  "Approved additions, overrides and retirements retain the layer and rationale that introduced them.",
  "Publishing an effective context records an immutable composition manifest and content hash for downstream consumers such as DataGate.",
] as const;
