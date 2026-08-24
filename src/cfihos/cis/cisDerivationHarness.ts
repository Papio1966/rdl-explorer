import {
  CisDerivationService,
  type CisDerivationDataSource,
} from "./CisDerivationService";
import {
  createEmptyProjectInformationProfile,
  type ProjectInformationProfile,
} from "./projectInformationProfile";

/**
 * Lightweight deterministic harness for the CIS derivation rules.
 * It uses in-memory data, so it never downloads the CFIHOS workbook.
 * This is intentionally framework-free and can later be migrated into Vitest.
 */
export async function runCisDerivationHarness(): Promise<void> {
  const dataSource = createHarnessDataSource();
  const service = new CisDerivationService(dataSource);
  const profile = createHarnessProfile();
  const result = await service.derive(profile);

  assert(result.warnings.length === 0, "Expected no derivation warnings");
  assert(result.profile.derived.properties.length === 2, "Expected 2 properties");
  assert(
    result.profile.derived.properties.some(
      (property) =>
        property.propertyId === "CFIHOS-40000002" &&
        property.provenance.some(
          (entry) =>
            entry.assignmentType === "inherited" && entry.inheritanceDepth === 1,
        ),
    ),
    "Expected inherited-property provenance",
  );
  assert(
    result.profile.derived.documentRequirements.length === 2,
    "Expected 2 raw document-requirement rows",
  );
  assert(
    result.profile.derived.documentTypes.length === 2,
    "Expected 2 unique derived document types",
  );
  assert(
    result.profile.derived.documentRequirements.some(
      (item) => item.assetContext === "Plant",
    ),
    "Expected Plant asset context to be preserved",
  );
  assert(
    result.profile.derived.sourceStandards.length === 3,
    "Expected multi-value Source Standards to be split and deduplicated",
  );
  assert(
    result.profile.derived.lifecycleRequirements.length === 2,
    "Expected 2 lifecycle requirements",
  );
}

function createHarnessProfile(): ProjectInformationProfile {
  const profile = createEmptyProjectInformationProfile({
    id: "cis-harness",
    name: "CIS derivation harness",
    projectName: "Example project",
    cfihosVersion: "2.0",
    now: "2026-08-17T00:00:00Z",
  });

  profile.scope.classes.push({
    domain: "equipment",
    classId: "CFIHOS-30000801",
    className: "adaptor connector",
  });
  profile.scope.disciplines.push({
    disciplineId: "CFIHOS-20000001",
    disciplineName: "Mechanical",
  });
  profile.scope.sourceStandards.push({
    sourceStandardId: "CFIHOS-90000002",
    sourceStandardCode: "PROJECT-STD",
  });

  return profile;
}

function createHarnessDataSource(): CisDerivationDataSource {
  return {
    async resolveClass(selection) {
      return { id: selection.classId, name: selection.className };
    },
    async getEffectiveProperties() {
      return [
        {
          property: {
            id: "CFIHOS-40000001",
            name: "rated pressure",
            definition: null,
            dataType: "number",
            dataTypeLength: null,
            unitOfMeasureDimensionId: null,
            unitOfMeasureDimensionCode: "pressure",
            picklistId: null,
            picklistName: null,
          },
          assignmentType: "direct",
          inheritanceDepth: 0,
          sourceClassId: "CFIHOS-30000801",
          sourceClassName: "adaptor connector",
          picklistValues: [],
        },
        {
          property: {
            id: "CFIHOS-40000002",
            name: "connection type",
            definition: null,
            dataType: "string",
            dataTypeLength: null,
            unitOfMeasureDimensionId: null,
            unitOfMeasureDimensionCode: null,
            picklistId: "CFIHOS-50000001",
            picklistName: "connection type",
          },
          assignmentType: "inherited",
          inheritanceDepth: 1,
          sourceClassId: "CFIHOS-30000001",
          sourceClassName: "connector",
          picklistValues: [
            {
              sourceStandardId: "CFIHOS-90000001",
              sourceStandardCode: "ISO-EXAMPLE",
            },
          ],
        },
      ];
    },
    async getClassDocumentRequirements() {
      return [
        {
          requirementId: "CFIHOS-68000001",
          referencedClassId: "CFIHOS-30000801",
          referencedClassName: "adaptor connector",
          assetContext: "Equipment",
          documentTypeId: "CFIHOS-10000001",
          documentTypeName: "equipment specification",
          sourceStandardId: "CFIHOS-90000001;CFIHOS-90000003",
          sourceStandardCode: "ISO-EXAMPLE;IEC-EXAMPLE",
        },
        {
          requirementId: "CFIHOS-68000002",
          referencedClassId: "CFIHOS-30000801",
          referencedClassName: "adaptor connector",
          assetContext: "Plant",
          documentTypeId: "CFIHOS-10000002",
          documentTypeName: "plant inspection report",
          sourceStandardId: "CFIHOS-90000001",
          sourceStandardCode: "ISO-EXAMPLE",
        },
      ];
    },
    async getClassStandards() {
      return [
        {
          sourceStandardId: "CFIHOS-90000001",
          sourceStandardCode: "ISO-EXAMPLE",
        },
      ];
    },
    async getPropertyStandardsForClass() {
      return [
        {
          propertyId: "CFIHOS-40000001",
          propertyName: "rated pressure",
          sourceStandardId: "CFIHOS-90000001",
          sourceStandardCode: "ISO-EXAMPLE",
          sourceStandardSection: "5.2",
        },
      ];
    },
    async getSourceStandard(id) {
      if (id === "CFIHOS-90000001") {
        return {
          id,
          code: "ISO-EXAMPLE",
          description: "Example technical standard",
        };
      }
      if (id === "CFIHOS-90000002") {
        return {
          id,
          code: "PROJECT-STD",
          description: "Explicit project standard",
        };
      }
      if (id === "CFIHOS-90000003") {
        return {
          id,
          code: "IEC-EXAMPLE",
          description: "Second standard from a multi-value reference",
        };
      }
      return null;
    },
    async getDisciplineDocumentRelationships() {
      return [
        {
          id: "CFIHOS-70000001",
          disciplineId: "CFIHOS-20000001",
          disciplineName: "Mechanical",
          documentTypeId: "CFIHOS-10000001",
          documentTypeName: "equipment specification",
          requiredStatusDetailedEngineering: "Issued for review",
          requiredStatusConstruction: null,
          requiredStatusCommissioning: null,
          requiredStatusStartup: null,
          requiredStatusOperations: "As-built",
        },
      ];
    },
  };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`CIS derivation harness failed: ${message}`);
}
