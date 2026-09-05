import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { readWorkbook, worksheetHeaders, worksheetRows } from "./rdl-ingestion/workbookReader.ts";
import { CFIHOS_SOURCE } from "../src/cfihos/source";

const execFileAsync = promisify(execFile);
const COMMITTED_SNAPSHOT_PATH = resolve("public/cfihos-workbook.json");
const DEFAULT_REPORT_PATH = resolve("reports/cfihos-upstream-change-report.json");

type WorksheetRow = Record<string, unknown>;
type SnapshotSheet = { headers: string[]; rows: WorksheetRow[] };
type WorkbookSnapshot = {
  schema: "cfihos-workbook-snapshot-v1";
  source: { url: string; generatedAt: string; sha256: string };
  sheetNames: string[];
  sheets: Record<string, SnapshotSheet>;
};

type DomainDefinition = {
  label: string;
  sheet: string;
  key: string;
  name?: string;
};

type ChangedRecord = {
  key: string;
  name: string | null;
  changedFields: string[];
};

type DomainChange = {
  sheet: string;
  before: number;
  after: number;
  added: Array<{ key: string; name: string | null }>;
  removed: Array<{ key: string; name: string | null }>;
  changed: ChangedRecord[];
};

const DOMAINS: DomainDefinition[] = [
  { label: "Tag Classes", sheet: "tag class", key: "CFIHOS unique code", name: "tag class name" },
  { label: "Equipment Classes", sheet: "equipment class", key: "equipment class CFIHOS unique code", name: "equipment class name" },
  { label: "Document Types", sheet: "document type", key: "CFIHOS unique code", name: "document type name" },
  { label: "Properties", sheet: "property", key: "CFIHOS unique code", name: "property name" },
  { label: "Document requirements", sheet: "document required per class", key: "source standard document and data requirement CFIHOS unique code", name: "document type name" },
  { label: "Tag–Equipment relationships", sheet: "tag equipment class relationshi", key: "tag class CFIHOS unique code", name: "tag class name" },
  { label: "Source Standards", sheet: "source standard", key: "CFIHOS unique code", name: "source standard code" },
  { label: "Disciplines", sheet: "discipline", key: "CFIHOS unique code", name: "discipline name" },
  { label: "Discipline document types", sheet: "discipline document type", key: "discipline document type CFIHOS unique code", name: "document type name" },
];

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function downloadWithFetch(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

async function downloadWithCurl(url: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "cfihos-update-check-"));
  const target = join(directory, "source.xlsx");
  try {
    await execFileAsync("curl", ["-L", "--fail", "--silent", "--show-error", "--output", target, url]);
    return await readFile(target);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function downloadWorkbook(url: string): Promise<{ bytes: Buffer; mode: "fetch" | "curl" }> {
  try {
    return { bytes: await downloadWithFetch(url), mode: "fetch" };
  } catch (error) {
    console.warn(`Node HTTPS could not download the workbook (${error instanceof Error ? error.message : "unknown error"}); retrying with operating-system curl trust.`);
    return { bytes: await downloadWithCurl(url), mode: "curl" };
  }
}

async function snapshotFromBytes(bytes: Buffer, sha256: string): Promise<WorkbookSnapshot> {
  const workbook = await readWorkbook(bytes);
  const sheets: WorkbookSnapshot["sheets"] = {};
  for (const sheetName of workbook.sheetNames) {
    const worksheet = workbook.sheets[sheetName];
    if (!worksheet) continue;
    sheets[sheetName] = {
      headers: worksheetHeaders(worksheet),
      rows: worksheetRows<WorksheetRow>(worksheet),
    };
  }
  return {
    schema: "cfihos-workbook-snapshot-v1",
    source: { url: CFIHOS_SOURCE.officialUrl, generatedAt: new Date().toISOString(), sha256 },
    sheetNames: workbook.sheetNames,
    sheets,
  };
}

function clean(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "string") return value.trim();
  return value;
}

function stableRow(row: WorksheetRow): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(row)
      .sort()
      .filter((key) => !key.startsWith("__EMPTY"))
      .map((key) => [key, clean(row[key])]),
  );
}

function recordLabel(row: WorksheetRow, field?: string): string | null {
  if (!field) return null;
  const value = row[field];
  return value === null || value === undefined ? null : String(value);
}

function compareDomain(before: SnapshotSheet | undefined, after: SnapshotSheet | undefined, definition: DomainDefinition): DomainChange {
  const beforeRows = before?.rows ?? [];
  const afterRows = after?.rows ?? [];
  const beforeMap = new Map(beforeRows.map((row) => [String(row[definition.key] ?? ""), row]).filter(([key]) => key));
  const afterMap = new Map(afterRows.map((row) => [String(row[definition.key] ?? ""), row]).filter(([key]) => key));

  const added = [...afterMap.entries()]
    .filter(([key]) => !beforeMap.has(key))
    .map(([key, row]) => ({ key, name: recordLabel(row, definition.name) }));
  const removed = [...beforeMap.entries()]
    .filter(([key]) => !afterMap.has(key))
    .map(([key, row]) => ({ key, name: recordLabel(row, definition.name) }));
  const changed: ChangedRecord[] = [];

  for (const [key, afterRow] of afterMap) {
    const beforeRow = beforeMap.get(key);
    if (!beforeRow) continue;
    const a = stableRow(afterRow);
    const b = stableRow(beforeRow);
    const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
      (field) => JSON.stringify(a[field] ?? null) !== JSON.stringify(b[field] ?? null),
    );
    if (fields.length) changed.push({ key, name: recordLabel(afterRow, definition.name), changedFields: fields });
  }

  return { sheet: definition.sheet, before: beforeRows.length, after: afterRows.length, added, removed, changed };
}

function printDomain(label: string, change: DomainChange) {
  console.log(`${label}`);
  console.log(`  Rows             ${change.before} → ${change.after}`);
  console.log(`  Added            ${change.added.length}`);
  console.log(`  Removed          ${change.removed.length}`);
  console.log(`  Changed          ${change.changed.length}`);
  for (const item of change.added.slice(0, 5)) console.log(`    + ${item.key}${item.name ? ` · ${item.name}` : ""}`);
  for (const item of change.removed.slice(0, 5)) console.log(`    - ${item.key}${item.name ? ` · ${item.name}` : ""}`);
  for (const item of change.changed.slice(0, 5)) console.log(`    ~ ${item.key}${item.name ? ` · ${item.name}` : ""} [${item.changedFields.join(", ")}]`);
  const hidden = Math.max(0, change.added.length - 5) + Math.max(0, change.removed.length - 5) + Math.max(0, change.changed.length - 5);
  if (hidden) console.log(`    … ${hidden} additional changes in JSON report`);
}

async function main() {
  const reportPath = resolve(argValue("--report") ?? DEFAULT_REPORT_PATH);
  const failOnChange = hasFlag("--fail-on-change");
  const committed = JSON.parse(await readFile(COMMITTED_SNAPSHOT_PATH, "utf8")) as WorkbookSnapshot;

  console.log(`Checking ${CFIHOS_SOURCE.officialUrl}`);
  console.log(`Committed SHA-256: ${committed.source.sha256}`);
  const { bytes, mode } = await downloadWorkbook(CFIHOS_SOURCE.officialUrl);
  const upstreamSha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`Upstream SHA-256:  ${upstreamSha256}`);
  console.log(`Source mode: ${mode}`);

  if (upstreamSha256 === committed.source.sha256) {
    console.log("\nCFIHOS upstream workbook is unchanged. No refresh is required.");
    return;
  }

  const upstream = await snapshotFromBytes(bytes, upstreamSha256);
  const addedSheets = upstream.sheetNames.filter((name) => !committed.sheetNames.includes(name));
  const removedSheets = committed.sheetNames.filter((name) => !upstream.sheetNames.includes(name));
  const domains = Object.fromEntries(
    DOMAINS.map((definition) => [definition.label, compareDomain(committed.sheets[definition.sheet], upstream.sheets[definition.sheet], definition)]),
  );

  const report = {
    schema: "cfihos-upstream-change-report-v1",
    checkedAt: new Date().toISOString(),
    sourceUrl: CFIHOS_SOURCE.officialUrl,
    previous: { sha256: committed.source.sha256, generatedAt: committed.source.generatedAt, worksheetCount: committed.sheetNames.length },
    upstream: { sha256: upstreamSha256, worksheetCount: upstream.sheetNames.length },
    worksheets: {
      added: addedSheets,
      removed: removedSheets,
      rowCounts: Object.fromEntries(
        [...new Set([...committed.sheetNames, ...upstream.sheetNames])].sort().map((name) => [name, { before: committed.sheets[name]?.rows.length ?? 0, after: upstream.sheets[name]?.rows.length ?? 0 }]),
      ),
    },
    domains,
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\nCFIHOS upstream change detected");
  console.log(`Worksheets       ${committed.sheetNames.length} → ${upstream.sheetNames.length}`);
  console.log(`Added sheets     ${addedSheets.length}`);
  console.log(`Removed sheets   ${removedSheets.length}`);
  console.log("");
  for (const definition of DOMAINS) {
    printDomain(definition.label, domains[definition.label]);
    console.log("");
  }
  console.log(`Detailed report: ${reportPath}`);
  console.log("The committed runtime snapshot has NOT been modified.");
  console.log("Review the report, then regenerate snapshots and validation in a separate refresh change.");

  if (failOnChange) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
