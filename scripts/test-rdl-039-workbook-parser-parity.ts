import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { readWorkbook, worksheetRows } from "./rdl-ingestion/workbookReader.ts";

const EXPECTED_SHEETS = [
  "Cover and Index",
  "Guidance",
  "RDL master object",
  "data dictionary",
  "CFIHOS object equivalent mappin",
  "discipline",
  "document type",
  "discipline document type",
  "equipment class",
  "equipment class property",
  "handover event",
  "property",
  "property picklist values",
  "property groupings",
  "source standard",
  "Jip33 info required spec",
  "document required per class",
  "tag class",
  "tag class property",
  "tag equipment class relationshi",
  "tag or equip class src standard",
  "tag equip class prop src std",
  "unit of measure",
] as const;

type WorkbookExpectation = {
  path: string;
  matrixRows: Record<string, number>;
};

const EXPECTATIONS: WorkbookExpectation[] = [
  {
    path: "data/rdl/ccus/CCUS_RDL_Extension_CFIHOS_Format.xlsx",
    matrixRows: { "RDL master object": 202, "discipline": 15, "document type": 31, "equipment class": 46, "property": 56, "tag class": 12, "unit of measure": 21 },
  },
  {
    path: "data/rdl/ccus/releases/CCUS_RDL_Extension_CFIHOS_Format_v2.0_Candidate_ReleaseSafe.xlsx",
    matrixRows: { "RDL master object": 1521, "discipline": 21, "document type": 43, "equipment class": 62, "property": 97, "tag class": 19, "unit of measure": 33 },
  },
  {
    path: "data/rdl/water-desalination/Water_Desalination_RDL_Extension_CFIHOS_Format.xlsx",
    matrixRows: { "RDL master object": 168, "discipline": 14, "document type": 29, "equipment class": 51, "property": 50, "tag class": 31, "unit of measure": 23 },
  },
  {
    path: "data/rdl/water-desalination/releases/Water_Desalination_RDL_Extension_CFIHOS_Format_v2.0_Candidate_ReleaseSafe.xlsx",
    matrixRows: { "RDL master object": 891, "discipline": 16, "document type": 29, "equipment class": 51, "property": 64, "tag class": 32, "unit of measure": 26 },
  },
];

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  devDependencies?: Record<string, string>;
};
assert.equal(packageJson.devDependencies?.xlsx, undefined, "legacy xlsx dependency must be removed");
assert.equal(packageJson.devDependencies?.["read-excel-file"], "9.3.10", "read-excel-file must be pinned to the validated version");

async function sourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) result.push(path);
  }
  return result;
}

const parserImport = /from\s+["'](?:xlsx|read-excel-file(?:\/[^"']+)*)["']|require\(["'](?:xlsx|read-excel-file(?:\/[^"']+)*)["']\)/;
for (const root of [resolve("src"), resolve("api")]) {
  for (const file of await sourceFiles(root)) {
    const source = await readFile(file, "utf8");
    assert.ok(!parserImport.test(source), `runtime parser import is forbidden: ${file}`);
  }
}
console.log("PASS RDL-039 runtime isolation: no XLSX parser import under src/ or api/");

for (const expectation of EXPECTATIONS) {
  const workbook = await readWorkbook(resolve(expectation.path));
  assert.deepEqual(workbook.sheetNames, [...EXPECTED_SHEETS], `${expectation.path}: sheet names/order changed`);

  for (const [sheetName, expectedRows] of Object.entries(expectation.matrixRows)) {
    const worksheet = workbook.sheets[sheetName];
    assert.ok(worksheet, `${expectation.path}: missing ${sheetName}`);
    assert.equal(worksheet.matrix.length, expectedRows, `${expectation.path}: ${sheetName} matrix row count changed`);
    const objects = worksheetRows<Record<string, unknown>>(worksheet);
    assert.equal(objects.length, expectedRows - 1, `${expectation.path}: ${sheetName} object row count changed`);
  }

  console.log(`PASS RDL-039 workbook contract: ${expectation.path} (${workbook.sheetNames.length} sheets)`);
}

const directImportRoots = [resolve("scripts")];
const legacyImports: string[] = [];
for (const root of directImportRoots) {
  for (const file of await sourceFiles(root)) {
    if (file.endsWith("workbookReader.ts")) continue;
    const source = await readFile(file, "utf8");
    if (/from\s+["']xlsx["']|require\(["']xlsx["']\)/.test(source)) legacyImports.push(file);
  }
}
assert.deepEqual(legacyImports, [], `legacy xlsx imports remain: ${legacyImports.join(", ")}`);
console.log("PASS RDL-039 dependency cutover: all development callers use the shared workbook reader");
console.log("PASS RDL-039 development-time workbook parser hardening contract");
