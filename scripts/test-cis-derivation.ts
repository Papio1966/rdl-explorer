import {
  CisDerivationService,
  type CisClassDocumentRecord,
  type CisDerivationDataSource,
  type CisDisciplineDocumentRecord,
} from "../src/cfihos/cis/CisDerivationService";
import {
  createEmptyProjectInformationProfile,
  type CisAssetContextType,
  type CisClassSelection,
  type ProjectInformationProfile,
} from "../src/cfihos/cis/projectInformationProfile";

async function main(): Promise<void> {
  await testCentrifugeAssetContexts();
  await testIntercomProcessUnitContext();
  await testMultiValueSourceStandards();

  console.log("\nCIS derivation regression tests passed.");
}

async function testCentrifugeAssetContexts(): Promise<void> {
  const selectedClass: CisClassSelection = {
    domain: "tag",
    classId: "CFIHOS-30000522",
    className: "centrifuge",
  };

  const rows: CisClassDocumentRecord[] = [
    row("CFIHOS-68000536", "Tag", "CFIHOS-70000153", "general arrangement diagram"),
    row("CFIHOS-68000537", "Tag", "CFIHOS-70000206", "maintenance manual"),
    row("CFIHOS-68000538", "Tag", "CFIHOS-70000228", "operating manual"),
    row("CFIHOS-68000539", "Equipment", "CFIHOS-70000079", "regulatory compliance certificate"),
    row("CFIHOS-68000540", "Model_Part", "CFIHOS-70000374", "spare part list"),
    row("CFIHOS-68000541", "Tag", "CFIHOS-70000408", "welding procedure specification"),
    row("CFIHOS-68000542", "Tag", "CFIHOS-70000268", "wiring diagram"),
    row("CFIHOS-68001393", "Model_Part", "CFIHOS-70000028", "bill of materials"),
    row("CFIHOS-68001394", "Tag", "CFIHOS-70000117", "design datasheet"),
    row("CFIHOS-68001395", "Tag", "CFIHOS-70000181", "installation manual"),
    row("CFIHOS-68001396", "Model_Part", "CFIHOS-70000416", "manufacturer datasheet"),
    row("CFIHOS-68001397", "Plant", "CFIHOS-70000351", "vibration analysis"),
  ];

  const lifecycle: CisDisciplineDocumentRecord[] = [
    {
      id: "MR|CFIHOS-70000117",
      disciplineId: "MR",
      disciplineName: "mechanical rotating engineering",
      documentTypeId: "CFIHOS-70000117",
      documentTypeName: "design datasheet",
      requiredStatusDetailedEngineering: "IFD",
      requiredStatusConstruction: "IFD",
      requiredStatusCommissioning: "IFD",
      requiredStatusStartup: "not specified",
      requiredStatusOperations: "IAB",
    },
  ];

  const result = await derive(selectedClass, rows, lifecycle, "MR");
  const derived = result.derived;

  assertEqual(derived.documentRequirements.length, 12, "centrifuge requirement row count");
  assertEqual(derived.documentTypes.length, 12, "centrifuge unique document type count");

  assertContextCounts(derived.documentRequirements.map((item) => item.assetContext), {
    Plant: 1,
    Process_Unit: 0,
    Tag: 7,
    Equipment: 1,
    Model_Part: 3,
  });

  assertDocumentRow(derived.documentRequirements, "CFIHOS-68001397", "Plant", "vibration analysis");
  assertDocumentRow(
    derived.documentRequirements,
    "CFIHOS-68000539",
    "Equipment",
    "regulatory compliance certificate",
  );
  assertDocumentRow(
    derived.documentRequirements,
    "CFIHOS-68001393",
    "Model_Part",
    "bill of materials",
  );

  const lifecyclePhases = derived.lifecycleRequirements
    .filter((item) => item.documentTypeId === "CFIHOS-70000117")
    .map((item) => item.lifecyclePhaseName);

  assertArrayEqual(
    lifecyclePhases,
    ["Detailed Engineering", "Construction", "Commissioning", "Startup", "Operations"],
    "lifecycle phase engineering order",
  );

  console.log("PASS centrifuge: 12 rows / 12 documents across Plant, Tag, Equipment and Model / Part.");
}

async function testIntercomProcessUnitContext(): Promise<void> {
  const selectedClass: CisClassSelection = {
    domain: "tag",
    classId: "CFIHOS-30000100",
    className: "intercom",
  };

  const rows: CisClassDocumentRecord[] = [
    rowForClass(selectedClass, "CFIHOS-68001288", "Process_Unit", "CFIHOS-70000237", "block diagram"),
    rowForClass(selectedClass, "CFIHOS-68001289", "Tag", "CFIHOS-70000055", "connection diagram"),
    rowForClass(selectedClass, "CFIHOS-68001290", "Tag", "CFIHOS-70000117", "design datasheet"),
    rowForClass(selectedClass, "CFIHOS-68001291", "Tag", "CFIHOS-70000406", "purchase order"),
    rowForClass(selectedClass, "CFIHOS-68001292", "Tag", "CFIHOS-70000268", "wiring diagram"),
    rowForClass(selectedClass, "CFIHOS-68001287", "Model_Part", "CFIHOS-70000028", "bill of materials"),
    rowForClass(selectedClass, "CFIHOS-68000859", "Model_Part", "CFIHOS-70000374", "spare part list"),
  ];

  const result = await derive(selectedClass, rows, [], null);
  const derived = result.derived;

  assertEqual(derived.documentRequirements.length, 7, "intercom requirement row count");
  assertEqual(derived.documentTypes.length, 7, "intercom unique document type count");

  assertContextCounts(derived.documentRequirements.map((item) => item.assetContext), {
    Plant: 0,
    Process_Unit: 1,
    Tag: 4,
    Equipment: 0,
    Model_Part: 2,
  });

  assertDocumentRow(
    derived.documentRequirements,
    "CFIHOS-68001288",
    "Process_Unit",
    "block diagram",
  );

  console.log("PASS intercom: Process Unit -> block diagram is preserved with 7 total rows.");
}

async function testMultiValueSourceStandards(): Promise<void> {
  const selectedClass: CisClassSelection = {
    domain: "equipment",
    classId: "CFIHOS-30009999",
    className: "source-standard regression fixture",
  };

  const rows: CisClassDocumentRecord[] = [
    {
      requirementId: "CFIHOS-68999999",
      referencedClassId: selectedClass.classId,
      referencedClassName: selectedClass.className,
      assetContext: "Equipment",
      documentTypeId: "CFIHOS-70999999",
      documentTypeName: "fixture document",
      sourceStandardId: "CFIHOS-900000129;CFIHOS-900000130",
      sourceStandardCode: "EN 60079-0:2018;NFPA 70:2020",
    },
  ];

  const dataSource = createDataSource(selectedClass, rows, [], new Map([
    ["CFIHOS-900000129", "EN 60079-0:2018"],
    ["CFIHOS-900000130", "NFPA 70:2020"],
  ]));

  const service = new CisDerivationService(dataSource);
  const profile = createProfile(selectedClass, null);
  const result = await service.derive(profile);

  assertEqual(result.warnings.length, 0, "multi-value Source Standard warnings");
  assertEqual(result.profile.derived.sourceStandards.length, 2, "split Source Standard count");
  assertSetEqual(
    result.profile.derived.sourceStandards.map((item) => item.sourceStandardId),
    ["CFIHOS-900000129", "CFIHOS-900000130"],
    "split Source Standard IDs",
  );

  console.log("PASS Source Standards: semicolon-separated references split and resolve independently.");
}

async function derive(
  selectedClass: CisClassSelection,
  rows: CisClassDocumentRecord[],
  lifecycle: CisDisciplineDocumentRecord[],
  disciplineId: string | null,
): Promise<ProjectInformationProfile> {
  const standards = new Map<string, string>([["CFIHOS-90000177", "CFIHOS"]]);
  const dataSource = createDataSource(selectedClass, rows, lifecycle, standards);
  const service = new CisDerivationService(dataSource);
  const result = await service.derive(createProfile(selectedClass, disciplineId));

  assertEqual(result.warnings.length, 0, `${selectedClass.className} derivation warnings`);
  return result.profile;
}

function createProfile(
  selectedClass: CisClassSelection,
  disciplineId: string | null,
): ProjectInformationProfile {
  const profile = createEmptyProjectInformationProfile({
    id: `regression-${selectedClass.classId}`,
    name: `Regression ${selectedClass.className}`,
    projectName: "CFIHOS CIS regression",
    cfihosVersion: "2.0",
    now: "2026-08-17T00:00:00Z",
  });

  profile.scope.classes.push(selectedClass);

  if (disciplineId) {
    profile.scope.disciplines.push({
      disciplineId,
      disciplineName: "mechanical rotating engineering",
    });
  }

  return profile;
}

function createDataSource(
  selectedClass: CisClassSelection,
  rows: CisClassDocumentRecord[],
  lifecycle: CisDisciplineDocumentRecord[],
  standards: Map<string, string>,
): CisDerivationDataSource {
  return {
    async resolveClass(selection) {
      return selection.classId === selectedClass.classId
        ? { id: selectedClass.classId, name: selectedClass.className }
        : null;
    },
    async getEffectiveProperties() {
      return [];
    },
    async getClassDocumentRequirements() {
      return rows;
    },
    async getClassStandards() {
      return [];
    },
    async getPropertyStandardsForClass() {
      return [];
    },
    async getSourceStandard(id) {
      const code = standards.get(id);
      return code ? { id, code, description: null } : null;
    },
    async getDisciplineDocumentRelationships() {
      return lifecycle;
    },
  };
}

function row(
  requirementId: string,
  assetContext: CisAssetContextType,
  documentTypeId: string,
  documentTypeName: string,
): CisClassDocumentRecord {
  return {
    requirementId,
    referencedClassId: "CFIHOS-30000522",
    referencedClassName: "centrifuge",
    assetContext,
    sourceStandardId: "CFIHOS-90000177",
    sourceStandardCode: "CFIHOS",
    documentTypeId,
    documentTypeName,
  };
}

function rowForClass(
  selectedClass: CisClassSelection,
  requirementId: string,
  assetContext: CisAssetContextType,
  documentTypeId: string,
  documentTypeName: string,
): CisClassDocumentRecord {
  return {
    requirementId,
    referencedClassId: selectedClass.classId,
    referencedClassName: selectedClass.className,
    assetContext,
    sourceStandardId: "CFIHOS-90000177",
    sourceStandardCode: "CFIHOS",
    documentTypeId,
    documentTypeName,
  };
}

function assertDocumentRow(
  rows: ProjectInformationProfile["derived"]["documentRequirements"],
  requirementId: string,
  assetContext: CisAssetContextType,
  documentTypeName: string,
): void {
  assert(
    rows.some(
      (item) =>
        item.requirementId === requirementId &&
        item.assetContext === assetContext &&
        item.documentTypeName === documentTypeName,
    ),
    `Expected ${requirementId} -> ${assetContext} -> ${documentTypeName}`,
  );
}

function assertContextCounts(
  contexts: CisAssetContextType[],
  expected: Partial<Record<CisAssetContextType, number>>,
): void {
  for (const [context, expectedCount] of Object.entries(expected)) {
    const actual = contexts.filter((item) => item === context).length;
    assertEqual(actual, expectedCount ?? 0, `${context} requirement count`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${String(expected)}, received ${String(actual)}`,
  );
}

function assertArrayEqual(actual: string[], expected: string[], label: string): void {
  assert(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `${label}: expected [${expected.join(", ")}], received [${actual.join(", ")}]`,
  );
}

function assertSetEqual(actual: string[], expected: string[], label: string): void {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assertArrayEqual(actualSorted, expectedSorted, label);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`CIS regression failed: ${message}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
