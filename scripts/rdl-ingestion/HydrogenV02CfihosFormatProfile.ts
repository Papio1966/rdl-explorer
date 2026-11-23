import type { RdlWorkbookMappingProfile } from "./RdlWorkbookMappingProfile.ts";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./CcusCfihosFormatProfile.ts";

export const HYDROGEN_V02_CFIHOS_FORMAT_PROFILE: RdlWorkbookMappingProfile = {
  ...CCUS_CFIHOS_FORMAT_PROFILE,
  profileKey: "hydrogen-cfihos-format-v0.2-candidate",
  adapterVersion: "1.0.0",
  sourceKey: "hydrogen",
  sourceName: "Hydrogen RDL Extension",
  sourceDescription:
    "Hydrogen RDL Extension v0.2 candidate using the CFIHOS workbook structure. Identifiers and requirements remain subject to governance approval.",
  publisher: "RDL Explorer candidate source",
  releaseKey: "hydrogen-0.2-candidate",
  versionLabel: "0.2 candidate",
  releaseStatus: "candidate",
  workbookPath:
    "data/rdl/hydrogen/releases/Hydrogen_RDL_Extension_CFIHOS_Format_v0.2_Candidate.xlsx",
  sourceUri:
    "repo://data/rdl/hydrogen/releases/Hydrogen_RDL_Extension_CFIHOS_Format_v0.2_Candidate.xlsx",
  sheetNames: {
    tagClass: "tag class",
    equipmentClass: "equipment class",
    property: "property",
    documentType: "document type",
    discipline: "discipline",
    unit: "unit of measure",
    sourceStandard: "source standard",
    handoverEvent: "handover event",
    controlledValue: "property picklist values",
    informationRequirement: "Jip33 info required spec",
    tagClassProperty: "tag class property",
    equipmentClassProperty: "equipment class property",
    disciplineDocument: "discipline document type",
    tagEquipment: "tag equipment class relationshi",
    classDocument: "document required per class",
    classSourceStandard: "tag or equip class src standard",
    sourceMapping: "tag equip class prop src std",
  },
  fields: {
    ...CCUS_CFIHOS_FORMAT_PROFILE.fields,
    sourceStandardName: ["source standard code"],
  },
};
