import type { RdlWorkbookMappingProfile } from "./RdlWorkbookMappingProfile.ts";
import { CCUS_CFIHOS_FORMAT_PROFILE } from "./CcusCfihosFormatProfile.ts";

export const CCUS_V2_CFIHOS_FORMAT_PROFILE: RdlWorkbookMappingProfile = {
  ...CCUS_CFIHOS_FORMAT_PROFILE,
  profileKey: "ccus-cfihos-format-v2-release-safe",
  adapterVersion: "2.0.0",
  sourceDescription: "CCUS Reference Data Library v2.0 candidate, release-safe and normalized through the CFIHOS-format mapping layer.",
  releaseKey: "ccus-2.0-candidate",
  versionLabel: "2.0 candidate",
  releaseStatus: "candidate",
  workbookPath: "data/rdl/ccus/releases/CCUS_RDL_Extension_CFIHOS_Format_v2.0_Candidate_ReleaseSafe.xlsx",
  sourceUri: "repo://data/rdl/ccus/releases/CCUS_RDL_Extension_CFIHOS_Format_v2.0_Candidate_ReleaseSafe.xlsx",
  identityAudit: {
    fromReleaseKey: "ccus-0.1-draft",
    auditPath: "data/rdl/audits/RDL-030_release_safety_audit.json",
  },
};
