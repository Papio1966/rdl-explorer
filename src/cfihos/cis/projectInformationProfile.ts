/**
 * Contract Information Specification (CIS) domain model.
 *
 * Design principle:
 * - scope = what the project/contract explicitly selects
 * - derived = what CFIHOS implies from that scope
 * - overrides = explicit project decisions applied on top of the CFIHOS baseline
 * - provenance = why a derived item exists
 *
 * This file deliberately contains no UI or persistence concerns.
 */

export type CisProfileStatus = "draft" | "issued" | "superseded";
export type CisClassDomain = "tag" | "equipment";
export type CisOverrideAction = "include" | "exclude";
export type CisLifecyclePhaseKey =
  | "detailed-engineering"
  | "construction"
  | "commissioning"
  | "startup"
  | "operations";

/**
 * CFIHOS document requirements can be stated at different asset contexts.
 * Keep these contexts explicit rather than flattening them into the selected
 * Tag/Equipment browser domain.
 *
 * Semantic hierarchy used by the CIS:
 * Plant -> Process Unit -> Tag -> Equipment -> Model / Part
 */
export type CisAssetContextType =
  | "Plant"
  | "Process_Unit"
  | "Tag"
  | "Equipment"
  | "Model_Part"
  | "Unknown";

export const CIS_ASSET_CONTEXT_HIERARCHY: readonly CisAssetContextType[] = [
  "Plant",
  "Process_Unit",
  "Tag",
  "Equipment",
  "Model_Part",
];

export type CisRequirementKind =
  | "property"
  | "document-requirement"
  | "document-type"
  | "source-standard"
  | "lifecycle-requirement";

export type CisProfileIdentity = {
  id: string;
  name: string;
  projectName: string;
  contractName: string | null;
  description: string | null;
};

export type CisCfihosBaseline = {
  version: string;
  workbookUrl: string | null;
  workbookSha256: string | null;
  validationSnapshotGeneratedAt: string | null;
};

export type CisClassSelection = {
  domain: CisClassDomain;
  classId: string;
  className: string;
};

/**
 * Disciplines are explicit contract scope. The current CFIHOS model does not
 * establish a deterministic Class -> Discipline relationship, so the CIS must
 * never silently infer discipline scope from selected classes.
 */
export type CisDisciplineSelection = {
  disciplineId: string;
  disciplineName: string;
};

export type CisSourceStandardSelection = {
  sourceStandardId: string;
  sourceStandardCode: string;
};

export type CisSelectedScope = {
  disciplines: CisDisciplineSelection[];
  classes: CisClassSelection[];
  sourceStandards: CisSourceStandardSelection[];
};

export type CisRequirementProvenance = {
  /** Selected class that caused this item to enter the baseline. */
  selectedClass: CisClassSelection | null;

  /** Asset context supplied by the CFIHOS document-requirement row. */
  assetContext: CisAssetContextType | null;

  /** Direct or inherited class-property assignment, when applicable. */
  assignmentType: "direct" | "inherited" | null;
  inheritanceDepth: number | null;
  sourceClassId: string | null;
  sourceClassName: string | null;

  /** CFIHOS source-standard traceability, when supplied by the model. */
  sourceStandardId: string | null;
  sourceStandardCode: string | null;
  sourceStandardSection: string | null;

  /** Optional document/discipline context for contract traceability. */
  disciplineId: string | null;
  disciplineName: string | null;
  documentTypeId: string | null;
  documentTypeName: string | null;
  requirementId: string | null;

  /** Human-readable derivation explanation for audit/export. */
  reason: string;
};

export type CisDerivedProperty = {
  kind: "property";
  propertyId: string;
  propertyName: string;
  definition: string | null;
  dataType: string | null;
  dataTypeLength: string | null;
  unitOfMeasureDimensionId: string | null;
  unitOfMeasureDimensionCode: string | null;
  picklistId: string | null;
  picklistName: string | null;
  provenance: CisRequirementProvenance[];
};

/** One source row from `document required per class`, retained losslessly. */
export type CisDerivedDocumentRequirement = {
  kind: "document-requirement";
  requirementId: string;
  selectedClass: CisClassSelection;
  assetContext: CisAssetContextType;
  documentTypeId: string;
  documentTypeName: string;
  sourceStandardId: string | null;
  sourceStandardCode: string | null;
  provenance: CisRequirementProvenance[];
};

/** Deduplicated document type view built from the raw requirement rows. */
export type CisDerivedDocumentType = {
  kind: "document-type";
  documentTypeId: string;
  documentTypeName: string;
  requirementIds: string[];
  assetContexts: CisAssetContextType[];
  provenance: CisRequirementProvenance[];
};

export type CisDerivedSourceStandard = {
  kind: "source-standard";
  sourceStandardId: string;
  sourceStandardCode: string;
  description: string | null;
  explicitlySelected: boolean;
  provenance: CisRequirementProvenance[];
};

export type CisDerivedLifecycleRequirement = {
  kind: "lifecycle-requirement";
  id: string;
  disciplineId: string;
  disciplineName: string;
  documentTypeId: string;
  documentTypeName: string;
  lifecyclePhase: CisLifecyclePhaseKey;
  lifecyclePhaseName: string;
  requiredStatus: string;
  disciplineDocumentTypeRelationshipId: string;
  provenance: CisRequirementProvenance[];
};

export type CisDerivedRequirements = {
  properties: CisDerivedProperty[];
  documentRequirements: CisDerivedDocumentRequirement[];
  documentTypes: CisDerivedDocumentType[];
  sourceStandards: CisDerivedSourceStandard[];
  lifecycleRequirements: CisDerivedLifecycleRequirement[];
};

/**
 * Overrides never mutate the CFIHOS baseline. They record the contractual
 * decision and preserve the baseline item for traceability.
 */
export type CisRequirementOverride = {
  id: string;
  action: CisOverrideAction;
  requirementKind: CisRequirementKind;
  requirementId: string;
  reason: string;
  note: string | null;
  createdAt: string;
};

export type CisProfileMetadata = {
  profileVersion: number;
  status: CisProfileStatus;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
};

export type ProjectInformationProfile = {
  identity: CisProfileIdentity;
  cfihosBaseline: CisCfihosBaseline;
  scope: CisSelectedScope;
  derived: CisDerivedRequirements;
  overrides: CisRequirementOverride[];
  metadata: CisProfileMetadata;
};

export type CisEffectiveRequirementState = "included" | "excluded";

export type CisEffectiveRequirement = {
  kind: CisRequirementKind;
  id: string;
  state: CisEffectiveRequirementState;
  override: CisRequirementOverride | null;
};

export function getEffectiveRequirementState(
  profile: ProjectInformationProfile,
  kind: CisRequirementKind,
  id: string,
): CisEffectiveRequirement {
  const matching = profile.overrides
    .filter(
      (override) =>
        override.requirementKind === kind && override.requirementId === id,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const override = matching.at(-1) ?? null;

  return {
    kind,
    id,
    state: override?.action === "exclude" ? "excluded" : "included",
    override,
  };
}

export function createEmptyProjectInformationProfile(args: {
  id: string;
  name: string;
  projectName: string;
  contractName?: string | null;
  description?: string | null;
  cfihosVersion: string;
  workbookUrl?: string | null;
  workbookSha256?: string | null;
  validationSnapshotGeneratedAt?: string | null;
  now: string;
}): ProjectInformationProfile {
  return {
    identity: {
      id: args.id,
      name: args.name,
      projectName: args.projectName,
      contractName: args.contractName ?? null,
      description: args.description ?? null,
    },
    cfihosBaseline: {
      version: args.cfihosVersion,
      workbookUrl: args.workbookUrl ?? null,
      workbookSha256: args.workbookSha256 ?? null,
      validationSnapshotGeneratedAt:
        args.validationSnapshotGeneratedAt ?? null,
    },
    scope: {
      disciplines: [],
      classes: [],
      sourceStandards: [],
    },
    derived: {
      properties: [],
      documentRequirements: [],
      documentTypes: [],
      sourceStandards: [],
      lifecycleRequirements: [],
    },
    overrides: [],
    metadata: {
      profileVersion: 1,
      status: "draft",
      createdAt: args.now,
      updatedAt: args.now,
      issuedAt: null,
    },
  };
}
