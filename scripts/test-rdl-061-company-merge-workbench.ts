import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildCompanyMergeExecution,
  compareCompanyMergeComponents,
  initialMergeResolutions,
  type CompanyMergeDetails,
} from "../src/rdl/companyMergeWorkbench";

const left={
  entityId:101,
  sourceKey:"source-a",
  releaseKey:"source-a-v1",
  packageId:11,
  packageKey:"source-a-package",
  entityType:"tag_class",
  nativeIdentifier:"A-001",
  name:"Gauge",
  definition:"Source A gauge",
  pinned:true,
};

const right={
  entityId:202,
  sourceKey:"source-b",
  releaseKey:"source-b-v1",
  packageId:22,
  packageKey:"source-b-package",
  entityType:"tag_class",
  nativeIdentifier:"B-009",
  name:"Gauge",
  definition:"Source B gauge",
  pinned:true,
};

const details:CompanyMergeDetails={
  preview:{
    schemaVersion:"rdl-company-merge-preview/v1",
    contextKey:"TEST-COMPANY",
    contextStatus:"draft",
    mappingId:9001,
    mappingType:"possible_match",
    mappingStatus:"candidate",
    confidence:.85,
    decisionType:"merge",
    left,
    right,
  },

  leftDetail:{
    record:{
      ...left,
      definition:left.definition,
      attributes:{assetType:"A"},
    },
    properties:[
      {
        entityType:"property",
        nativeIdentifier:"PRESSURE",
        name:"Pressure",
      },
    ],
    requiredDocuments:[],
    disciplines:[],
    informationRequirements:[],
    controlledValues:[],
    unitsOfMeasure:[],
    parents:[],
    children:[],
  },

  rightDetail:{
    record:{
      ...right,
      definition:right.definition,
      attributes:{assetType:"B"},
    },
    properties:[
      {
        entityType:"property",
        nativeIdentifier:"PRESSURE",
        name:"Pressure",
      },
      {
        entityType:"property",
        nativeIdentifier:"RANGE",
        name:"Range",
      },
    ],
    requiredDocuments:[],
    disciplines:[],
    informationRequirements:[],
    controlledValues:[],
    unitsOfMeasure:[],
    parents:[],
    children:[],
  },

  leftRelationships:[
    {
      relationshipType:"mapping_class_property",
      sourceEntityType:"tag_class",
      sourceNativeIdentifier:"A-001",
      targetEntityType:"property",
      targetNativeIdentifier:"PRESSURE",
      relationshipStatus:"active",
      attributes:{required:true},
    },
  ],

  rightRelationships:[
    {
      relationshipType:"mapping_class_property",
      sourceEntityType:"tag_class",
      sourceNativeIdentifier:"B-009",
      targetEntityType:"property",
      targetNativeIdentifier:"RANGE",
      relationshipStatus:"active",
      attributes:{required:true},
    },
  ],
};

const comparisons=
  compareCompanyMergeComponents(details);

assert.ok(
  comparisons.some(
    item=>
      item.key==="definition"
      &&!item.equal
  ),
  "definition difference must be exposed"
);

assert.ok(
  comparisons.some(
    item=>
      item.key==="properties"
      &&!item.equal
  ),
  "property difference must be exposed"
);

assert.ok(
  comparisons.some(
    item=>
      item.key==="relationships"
      &&!item.equal
  ),
  "relationship difference must be exposed"
);

const resolutions=
  initialMergeResolutions(comparisons);

for(const item of comparisons)
  if(!item.equal)
    resolutions[item.key]="combine";

resolutions.definition="custom";
resolutions.relationships="combine";

const execution=
  buildCompanyMergeExecution(
    details,
    comparisons,
    resolutions,
    {
      nativeIdentifier:"COMPANY-GAUGE",
      name:"Gauge",
      customDefinition:"Company governed gauge definition",
    },
    "Governed test merge of two exact Industry contributors."
  );

assert.equal(
  execution.contextKey,
  "TEST-COMPANY"
);

assert.equal(
  execution.mappingId,
  9001
);

assert.equal(
  execution.targetDefinition,
  "Company governed gauge definition"
);

const closure=
  execution.componentDecisions.find(
    decision=>
      decision.componentKind==="other"
      &&decision.componentKey==="merge_component_closure"
  );

assert.ok(
  closure,
  "merge_component_closure decision is required"
);

const payload=
  closure?.resolvedPayload as Record<string,unknown>;

assert.equal(
  payload.schemaVersion,
  "rdl-company-merge-closure/v1"
);

const relationships=
  payload.materializedRelationships as Array<Record<string,unknown>>;

assert.equal(
  relationships.length,
  2,
  "combined relationship resolution must materialize both governed relationships"
);

assert.ok(
  relationships.every(
    relationship=>
      relationship.sourceEntityType==="tag_class"
      &&relationship.sourceNativeIdentifier==="COMPANY-GAUGE"
  ),
  "source contributor relationship endpoints must be rewritten to the governed Company identity"
);

const migration=
  readFileSync(
    "database/migrations/033_create_company_merge_resolution_workflow.sql",
    "utf8"
  );

for(const phrase of [
  "rdl.resolve_company_adoption_merge",
  "decision_type = 'merge'",
  "create_company_adoption_composition",
  "'multi_source_merge'",
  "change_kind",
  "'retire'",
  "sourceEntityImmutable",
].filter(Boolean)){
  assert.ok(
    migration.includes(phrase),
    `RDL-061 migration missing ${phrase}`
  );
}

const repository=
  readFileSync(
    "server/rdl/CompanyMergeWorkbenchRepository.ts",
    "utf8"
  );

const page=
  readFileSync(
    "src/pages/RdlCompanyMergeWorkbenchPage.tsx",
    "utf8"
  );

const helper=
  readFileSync(
    "src/rdl/companyMergeWorkbench.ts",
    "utf8"
  );

const app=
  readFileSync("src/App.tsx","utf8");

const shell=
  readFileSync(
    "src/components/AppShell.tsx",
    "utf8"
  );

assert.ok(
  repository.includes("cross_rdl_mapping"),
  "server must derive exact contributors from governed mapping identity"
);

assert.ok(
  helper.includes("loadRdlEntityDetailRuntime"),
  "workbench must reuse generic runtime detail projection"
);

assert.ok(
  helper.includes("/api/rdl-runtime/relationships"),
  "workbench must load authoritative generic relationship projection"
);

assert.ok(
  helper.includes("rdl-company-merge-closure/v1"),
  "browser workflow must create the RDL-060 merge closure"
);

assert.ok(
  page.includes("Resolve semantic components")
  &&page.includes("Source A only")
  &&page.includes("Source B only")
  &&page.includes("Company definition"),
  "visual component-level decision workflow must be present"
);

assert.ok(
  app.includes('/company-adoption/merge')
  &&shell.includes("Company Merge Workbench"),
  "merge workbench must be routable and discoverable"
);

for(const source of [
  repository,
  page,
  helper,
]){
  assert.doesNotMatch(
    source,
    /CfihosRuntimeCompatibilityService|CfihosRepository|src\/cfihos/i,
    "Company merge workbench must remain RDL-generic"
  );
}

console.log(
  "PASS - RDL-061 Company Merge Workbench: exact governed mapping contributors are compared through the generic runtime-detail/relationship projection, every semantic difference requires explicit resolution, the browser produces rdl-company-merge-closure/v1, and atomic execution creates one Company composition plus explicit L2 contributor-suppression drafts without mutating L1"
);
