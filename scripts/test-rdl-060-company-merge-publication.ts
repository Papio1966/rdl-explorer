import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  COMPANY_MERGE_CLOSURE_SCHEMA_VERSION,
  materializeCompanyMergeRelationships,
} from "../server/rdl/CompanyMergePublication.ts";


const contributors=[
  {
    contributionRole:"primary",
    packageId:10,
    packageKey:"source-a-v1",
    entityId:101,
    entityType:"tag_class",
    nativeIdentifier:"SOURCE-A",
  },
  {
    contributionRole:"contributor",
    packageId:11,
    packageKey:"source-b-v1",
    entityId:202,
    entityType:"tag_class",
    nativeIdentifier:"SOURCE-B",
  },
];


const mergeItem={
  changeKind:"add",
  entityType:"tag_class",
  nativeIdentifier:"COMPANY-MERGED-001",

  derivation:{
    compositionId:77,
    compositionKind:"multi_source_merge",

    contributors,

    componentDecisions:[
      {
        componentKind:"definition",
        componentKey:"definition",
        resolution:"target_override",
        resolvedPayload:{
          value:"Company governed definition",
        },
      },

      {
        componentKind:"other",
        componentKey:"merge_component_closure",
        resolution:"target_override",

        resolvedPayload:{
          schemaVersion:
            COMPANY_MERGE_CLOSURE_SCHEMA_VERSION,

          resolvedComponents:{
            definition:"target_override",
            properties:"combine",
          },

          materializedRelationships:[
            {
              relationshipType:
                "mapping_class_property",

              sourceEntityType:
                "tag_class",

              sourceNativeIdentifier:
                "COMPANY-MERGED-001",

              targetEntityType:
                "property",

              targetNativeIdentifier:
                "PROP-001",

              relationshipStatus:"active",

              attributes:{
                requirementLevel:"required",
              },
            },
          ],
        },
      },
    ],
  },
};


const retireA={
  changeKind:"retire",
  entityType:"tag_class",
  nativeIdentifier:"SOURCE-A",
  baseEntityId:101,
};


const retireB={
  changeKind:"retire",
  entityType:"tag_class",
  nativeIdentifier:"SOURCE-B",
  baseEntityId:202,
};


assert.throws(
  ()=>materializeCompanyMergeRelationships(
    [],
    [mergeItem,retireA],
    [{packageId:10},{packageId:11}]
  ),
  /must be explicitly retired/
);


assert.throws(
  ()=>materializeCompanyMergeRelationships(
    [],
    [
      {
        ...mergeItem,
        derivation:{
          ...mergeItem.derivation,
          componentDecisions:
            mergeItem.derivation.componentDecisions
              .filter(
                decision=>
                  decision.componentKey!==
                    "merge_component_closure"
              ),
        },
      },
      retireA,
      retireB,
    ],
    [{packageId:10},{packageId:11}]
  ),
  /no resolved merge component closure/
);


const relationships=
  materializeCompanyMergeRelationships(
    [],
    [mergeItem,retireA,retireB],
    [{packageId:10},{packageId:11}]
  );


assert.equal(
  relationships.length,
  1
);

assert.equal(
  relationships[0].relationshipType,
  "mapping_class_property"
);

assert.equal(
  relationships[0].sourceNativeIdentifier,
  "COMPANY-MERGED-001"
);

assert.equal(
  relationships[0].targetNativeIdentifier,
  "PROP-001"
);

assert.ok(
  relationships[0].relationshipId<0,
  "Derived Company relationships must use a deterministic synthetic publication identity."
);

assert.deepEqual(
  (
    relationships[0].attributes
      .companyMerge as Record<string,unknown>
  ).exactContributorEntityIds,
  [101,202]
);


const publication=
  readFileSync(
    "server/rdl/EffectiveStandardPublicationRepository.ts",
    "utf8"
  );

assert.ok(
  publication.includes(
    "materializeCompanyMergeRelationships"
  ),
  "Effective publication must materialize governed Company merge relationships."
);

assert.ok(
  publication.indexOf(
    "materializeCompanyMergeRelationships"
  )<
  publication.indexOf(
    "relationshipClosure:"
  ),
  "Merge relationship materialization must occur before immutable release closure is fingerprinted."
);

console.log(
  "PASS - RDL-060 Company merge publication: multi-source merges fail closed unless pinned contributors are explicitly suppressed and a governed component closure is present; resolved Company relationships are materialized into effectiveRelationships with exact merge provenance"
);
