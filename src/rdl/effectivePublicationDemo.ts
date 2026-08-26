import type { PublicationComparison } from "./effectivePublicationService";
export const EFFECTIVE_PUBLICATION_DEMO:PublicationComparison={
  contextId:0,contextKey:"DEMO-PROJECT-ALPHA",contextType:"project",contextName:"Demonstration Project Alpha",
  lineage:[{depth:2,contextKey:"DEMO-COMPANY",contextType:"company",name:"Demonstration Company RDL",status:"active"},{depth:1,contextKey:"DEMO-ASSET",contextType:"asset",name:"Demonstration Asset RDL",status:"active"},{depth:0,contextKey:"DEMO-PROJECT-ALPHA",contextType:"project",name:"Demonstration Project Alpha",status:"active"}],
  packagePins:[{contextKey:"DEMO-COMPANY",layerType:"industry",packageId:0,packageKey:"CFIHOS-2.0",precedence:100}],
  items:[
    {sourceLayer:"project",sourceContextKey:"DEMO-PROJECT-ALPHA",changeKind:"add",entityType:"equipment_class",nativeIdentifier:"DEMO-VACUUM-TOILET",effectiveName:"Vacuum toilet",rationale:"Dedicated maintainable equipment class required for the project."},
    {sourceLayer:"asset",sourceContextKey:"DEMO-ASSET",changeKind:"override",entityType:"property",nativeIdentifier:"DEMO-MAINT-CRIT",inheritedName:"Maintenance criticality",effectiveName:"Asset maintenance criticality",rationale:"Asset-specific controlled terminology."},
    {sourceLayer:"company",sourceContextKey:"DEMO-COMPANY",changeKind:"retire",entityType:"document_type",nativeIdentifier:"DEMO-LEGACY-DOC",inheritedName:"Legacy equipment schedule",rationale:"Superseded by the governed company document requirement."},
  ],
  summary:{inherited:1,added:1,overridden:1,retired:1,totalChanges:3},pendingCount:0,publishable:true,
};
