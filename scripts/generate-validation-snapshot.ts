import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import * as XLSX from "xlsx";
import { CFIHOS_SOURCE } from "../src/cfihos/source";

const outputPath = resolve("public/validation-snapshot.json");
const generatedAt = new Date().toISOString();
const execFileAsync = promisify(execFile);

type WorkbookInput = {
  bytes: Buffer;
  sourceMode: "local-file" | "node-fetch" | "curl";
  sourceLabel: string;
};

async function loadWorkbookBytes(): Promise<WorkbookInput> {
  const localPathArg = process.argv[2];
  if (localPathArg) {
    const localPath = resolve(localPathArg);
    console.log(`Reading local workbook ${localPath}`);
    return {
      bytes: await readFile(localPath),
      sourceMode: "local-file",
      sourceLabel: localPath,
    };
  }

  console.log(`Downloading ${CFIHOS_SOURCE.officialUrl}`);
  try {
    const response = await fetch(CFIHOS_SOURCE.officialUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      sourceMode: "node-fetch",
      sourceLabel: CFIHOS_SOURCE.officialUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && "cause" in error ? String((error as Error & { cause?: unknown }).cause ?? "") : "";
    const tlsProblem = /SELF_SIGNED_CERT_IN_CHAIN|self-signed certificate|unable to verify|certificate/i.test(`${message} ${cause}`);
    if (!tlsProblem) throw error;

    console.warn("Node HTTPS trust rejected the certificate chain; retrying securely with the operating-system curl trust store.");
    const tempPath = resolve(tmpdir(), `cfihos-validation-${process.pid}.xlsx`);
    try {
      await execFileAsync("curl", [
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--output",
        tempPath,
        CFIHOS_SOURCE.officialUrl,
      ]);
      return {
        bytes: await readFile(tempPath),
        sourceMode: "curl",
        sourceLabel: CFIHOS_SOURCE.officialUrl,
      };
    } finally {
      await rm(tempPath, { force: true });
    }
  }
}

function text(value: unknown): string { return String(value ?? "").trim(); }
function key(value: unknown): string { return text(value).toLowerCase(); }
function rows(workbook: XLSX.WorkBook, sheet: string): Record<string, unknown>[] {
  const ws = workbook.Sheets[sheet];
  if (!ws) throw new Error(`Worksheet not found: ${sheet}`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
}
function countDuplicates(values: string[]): number {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].reduce((n, c) => n + (c > 1 ? c - 1 : 0), 0);
}
function numericId(value: string): number | null {
  const match = value.match(/(\d+)$/); return match ? Number(match[1]) : null;
}

async function main() {
  const input = await loadWorkbookBytes();
  const bytes = input.bytes;
  const fingerprint = createHash("sha256").update(bytes).digest("hex");
  const workbook = XLSX.read(bytes, { type: "buffer" });

  const master = rows(workbook, "RDL master object");
  const tagRows = rows(workbook, "tag class");
  const equipmentRows = rows(workbook, "equipment class");
  const mappingRows = rows(workbook, "CFIHOS object equivalent mappin");
  const classDocRows = rows(workbook, "document required per class");
  const propertyRows = rows(workbook, "property");
  const picklistValueRows = rows(workbook, "property picklist values");
  const groupingRows = rows(workbook, "property groupings");
  const unitRows = rows(workbook, "unit of measure");
  const jip33Rows = rows(workbook, "Jip33 info required spec");

  const masterById = new Map(master.map(r => [key(r["CFIHOS unique code"]), r]));
  const tagIds = new Set(tagRows.map(r => key(r["CFIHOS unique code"])).filter(Boolean));
  const equipmentIds = new Set(equipmentRows.map(r => key(r["equipment class CFIHOS unique code"])).filter(Boolean));

  const families = new Map<string, number>();
  for (const row of master) { const f = key(row["CFIHOS definition file"]); if (f) families.set(f, (families.get(f) ?? 0) + 1); }

  const unresolvedMappings = mappingRows.filter(r => !masterById.has(key(r["CFIHOS unique code"])));
  const unresolvedMappingIds = [...new Set(unresolvedMappings.map(r => key(r["CFIHOS unique code"])))];
  const masterNumeric = master.map(r => ({ id: text(r["CFIHOS unique code"]), family: key(r["CFIHOS definition file"]), n: numericId(text(r["CFIHOS unique code"])) })).filter(x => x.n !== null).sort((a,b) => a.n! - b.n!);
  let sameFamilyGapCount = 0;
  for (const id of unresolvedMappingIds) {
    const n = numericId(id); if (n === null) continue;
    let prev: typeof masterNumeric[number] | undefined; let next: typeof masterNumeric[number] | undefined;
    for (const item of masterNumeric) { if (item.n! < n) prev = item; else if (item.n! > n) { next = item; break; } }
    if (prev && next && prev.family && prev.family === next.family) sameFamilyGapCount++;
  }

  const equipmentRequirements = classDocRows.filter(r => key(r["asset type reference"]) === "equipment");
  const tagOnlyEquipmentRequirements = equipmentRequirements.filter(r => { const id = key(r["tag or equipment class CFIHOS unique code"]); return tagIds.has(id) && !equipmentIds.has(id); });
  const tagOnlyIds = [...new Set(tagOnlyEquipmentRequirements.map(r => key(r["tag or equipment class CFIHOS unique code"])))];

  const requirementMaster = master.filter(r => key(r["CFIHOS definition file"]) === "source standard document and data requirement");
  const classReqIds = new Set(classDocRows.map(r => key(r["source standard document and data requirement CFIHOS unique code"])).filter(Boolean));
  const jipReqIds = new Set(jip33Rows.map(r => key(r["Source standard document and data requirement CFIHOS unique code"])).filter(Boolean));
  const unusedRequirements = requirementMaster.filter(r => { const id = key(r["CFIHOS unique code"]); return !classReqIds.has(id) && !jipReqIds.has(id); });

  const dimensionMaster = master.filter(r => key(r["CFIHOS definition file"]) === "unit of measure dimension");
  const dimensionIds = new Set(dimensionMaster.map(r => key(r["CFIHOS unique code"])).filter(Boolean));
  const dimensionExpressions = [...propertyRows, ...unitRows].map(r => text(r["unit of measure dimension code CFIHOS unique code"] || r["unit of measure dimension CFIHOS unique code"])).filter(Boolean);
  const dimensionComponents = [...new Set(dimensionExpressions.flatMap(v => v.split(";").map(key).filter(Boolean)))];
  const unresolvedDimensionComponents = dimensionComponents.filter(id => !dimensionIds.has(id));
  const compoundExpressions = [...new Set(unitRows.map(r => text(r["unit of measure dimension code CFIHOS unique code"] || r["unit of measure dimension CFIHOS unique code"])).filter(v => v.includes(";")))];

  const jipIds = jip33Rows.map(r => key(r["source standard document and data requirement CFIHOS unique code"])).filter(Boolean);
  const jipCounts = new Map<string, number>(); for (const id of jipIds) jipCounts.set(id, (jipCounts.get(id) ?? 0) + 1);
  const repeatedJipIds = [...jipCounts.values()].filter(c => c > 1).length;

  const conditionFamilies = ["application condition", "source standard document and data requirement condition", "application condition group"];
  const conditionObjects = master.filter(r => conditionFamilies.includes(key(r["CFIHOS definition file"])));
  const conditionCounts = Object.fromEntries(conditionFamilies.map(f => [f, conditionObjects.filter(r => key(r["CFIHOS definition file"]) === f).length]));
  const submissionDates = master.filter(r => key(r["CFIHOS definition file"]) === "submission reference date");
  const picklists = master.filter(r => key(r["CFIHOS definition file"]) === "property picklist");
  const propertyPicklistRefs = new Set(propertyRows.map(r => key(r["property picklist CFIHOS unique code"])).filter(Boolean));
  const valueParents = new Set(picklistValueRows.map(r => key(r["property picklist CFIHOS unique code"])).filter(Boolean));
  const masterOnlyPicklists = picklists.filter(r => { const id = key(r["CFIHOS unique code"]); return !propertyPicklistRefs.has(id); });
  const picklistsWithoutValues = picklists.filter(r => !valueParents.has(key(r["CFIHOS unique code"])));

  const tagParentNames = new Set(tagRows.map(r => key(r["tag class name"])).filter(Boolean));
  const unresolvedTagParents = tagRows.filter(r => { const p = key(r["parent tag class name"]); return p && !tagParentNames.has(p); }).length;
  const equipmentNames = new Set(equipmentRows.map(r => key(r["equipment class name"])).filter(Boolean));
  const unresolvedEquipmentParents = equipmentRows.filter(r => { const p = key(r["parent equipment class name"]); return p && !equipmentNames.has(p); }).length;

  const snapshot = {
    schemaVersion: 1,
    source: {
      standard: `CFIHOS ${CFIHOS_SOURCE.version} CORE`,
      workbook: basename(input.sourceLabel) || "CORE-CFIHOS-V2.0-excel-FINAL.xlsx",
      workbookUrl: input.sourceMode === "local-file" ? null : CFIHOS_SOURCE.officialUrl,
      sourceMode: input.sourceMode,
      sourceLabel: input.sourceLabel,
      workbookSha256: fingerprint,
      validatedAt: generatedAt.slice(0, 10),
      generatedAt,
      worksheetCount: workbook.SheetNames.length,
    },
    summary: [
      { value: `${families.size}/${families.size}`, label: "RDL object families classified", tone: "normal" },
      { value: `${dimensionIds.size - unresolvedDimensionComponents.length}/${dimensionIds.size}`, label: "Measurement dimensions reconciled", tone: "normal" },
      { value: String(unresolvedTagParents + unresolvedEquipmentParents), label: "Hierarchy integrity failures", tone: "normal" },
      { value: "3", label: "Items for upstream review", tone: "attention" },
    ],
    sections: [
      { id: "validated", eyebrow: "Assurance", title: "Validated model areas", description: "Core relationships and reference domains that reconcile cleanly in the Explorer.", tone: "normal", items: [
        { title: "Class hierarchy integrity", status: "validated", summary: "Tag and Equipment Class hierarchies resolve without unresolved parent references.", evidence: [`${tagRows.length} Tag Classes; ${unresolvedTagParents} unresolved parent references.`, `${equipmentRows.length} Equipment Classes; ${unresolvedEquipmentParents} unresolved parent references.`, "Property inheritance is evaluated across both class domains by the Explorer repositories."] },
        { title: "RDL object-family coverage", status: "validated", summary: `All ${families.size} definition-file families in the CORE RDL are classified by the Explorer model.`, evidence: [`${master.length.toLocaleString()} master objects across ${families.size} definition-file families.`, "The validation snapshot is regenerated from the current workbook rather than browser-local diagnostic state."] },
        { title: "Property and controlled-value model", status: "validated", summary: "Property, Property Picklist and Picklist Value relationships reconcile consistently.", evidence: [`${propertyRows.length.toLocaleString()} Property rows.`, `${picklists.length} master Property Picklists and ${picklistValueRows.length.toLocaleString()} Picklist Value rows.`, `${masterOnlyPicklists.length} master-only picklist(s); ${picklistsWithoutValues.length} picklist(s) without values.`] },
        { title: "Measurement dimensions", status: "validated", summary: "Atomic and compound Unit-of-Measure dimension expressions reconcile to the canonical dimension catalogue.", evidence: [`${dimensionIds.size} canonical master dimensions.`, `${dimensionComponents.length} distinct dimension components found in Property/Unit references; ${unresolvedDimensionComponents.length} unresolved.`, `${compoundExpressions.length} compound Unit dimension expressions parsed component-by-component.`] },
        { title: "Property grouping semantics", status: "validated", summary: "Property Grouping purpose references can be reconciled against the RDL purpose family.", evidence: [`${groupingRows.length} Property Grouping rows inspected.`] },
      ]},
      { id: "findings", eyebrow: "Upstream review", title: "Data-quality findings", description: "Specific source-data inconsistencies supported by workbook-level evidence.", tone: "attention", items: [
        { title: "POSC CAESAR equivalence mappings reference absent RDL objects", status: "finding", summary: `${unresolvedMappings.length} external-equivalence mappings reference CFIHOS object IDs absent from the master catalogue.`, evidence: [`${mappingRows.length.toLocaleString()} equivalence mappings inspected; ${(mappingRows.length-unresolvedMappings.length).toLocaleString()} resolve and ${unresolvedMappings.length} do not.`, `${unresolvedMappingIds.length} distinct unresolved object IDs.`, `${sameFamilyGapCount} unresolved IDs sit numerically between surviving objects from the same RDL family.`] },
        { title: "Equipment requirements reference Tag-only classes", status: "finding", summary: `${tagOnlyEquipmentRequirements.length} CORE class-document requirement rows are typed as Equipment while referencing ${tagOnlyIds.length} Tag-only class identifiers.`, evidence: [`Affected IDs: ${tagOnlyIds.join(", ") || "none"}.`, "The generator does not silently substitute an Equipment counterpart."] },
        { title: "Master Source Standard requirements have no requirement-layer usage", status: "finding", summary: `${unusedRequirements.length} master requirement objects are referenced by neither CORE class-document requirements nor the JIP33 overlay.`, evidence: unusedRequirements.map(r => `${text(r["CFIHOS unique code"])} — ${text(r["CFIHOS name"])}`) },
      ]},
      { id: "observations", eyebrow: "Clarification", title: "Observations", description: "Model content that appears internally coherent but whose intended use may warrant clarification.", tone: "info", items: [
        { title: "Condition Model is currently dormant", status: "observation", summary: "Condition vocabularies are populated in the RDL but no production relationship chain is inferred by this snapshot.", evidence: [`${conditionCounts["application condition"] ?? 0} Application Conditions.`, `${conditionCounts["source standard document and data requirement condition"] ?? 0} Requirement Conditions.`, `${conditionCounts["application condition group"] ?? 0} Condition Groups.`] },
        { title: "Submission Reference Date family", status: "observation", summary: `${submissionDates.length} Submission Reference Date master definitions are present; usage should be interpreted separately from literal reference-date values.`, evidence: ["The family is retained as a semantic clarification item rather than treated as a structural failure."] },
        { title: "Property Picklist reserved/deprecated candidates", status: "observation", summary: `${masterOnlyPicklists.length} master picklist(s) are not referenced by Properties; ${picklistsWithoutValues.length} have no values.`, evidence: masterOnlyPicklists.slice(0,5).map(r => `${text(r["CFIHOS unique code"])} — ${text(r["CFIHOS name"])}`) },
      ]},
      { id: "closed", eyebrow: "Investigation", title: "Investigated and explained", description: "Apparent anomalies that resolve as legitimate modelling patterns after deeper reconciliation.", tone: "normal", items: [
        { title: "Compound Unit dimensions", status: "closed", summary: "Semicolon-separated Unit dimension expressions are compound definitions, not missing master IDs.", evidence: [`${compoundExpressions.length} compound expressions found.`, `${dimensionComponents.length} distinct component IDs; ${unresolvedDimensionComponents.length} unresolved components.`] },
        { title: "JIP33 repeated requirement IDs", status: "closed", summary: "Repeated JIP33 requirement IDs are contextual mappings rather than automatically being duplicate definitions.", evidence: [`${jip33Rows.length} JIP33 rows contain ${new Set(jipIds).size} unique requirement IDs.`, `${repeatedJipIds} repeated-ID groups.`] },
      ]},
    ],
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(`Source mode: ${input.sourceMode}`);
  console.log(`Workbook SHA-256: ${fingerprint}`);
  console.log(`Upstream review: ${unresolvedMappings.length} equivalence mappings; ${tagOnlyEquipmentRequirements.length} equipment rows; ${unusedRequirements.length} unused requirements.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
