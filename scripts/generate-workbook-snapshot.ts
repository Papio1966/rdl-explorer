import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import * as XLSX from "xlsx";
import { CFIHOS_SOURCE } from "../src/cfihos/source";

const execFileAsync = promisify(execFile);
const OUTPUT_PATH = resolve("public/cfihos-workbook.json");

type WorksheetRow = Record<string, unknown>;

type WorkbookSnapshot = {
  schema: "cfihos-workbook-snapshot-v1";
  source: {
    url: string;
    generatedAt: string;
    sha256: string;
  };
  sheetNames: string[];
  sheets: Record<
    string,
    {
      headers: string[];
      rows: WorksheetRow[];
    }
  >;
};

async function downloadWithFetch(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function downloadWithCurl(url: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "cfihos-workbook-"));
  const target = join(directory, "source.xlsx");
  try {
    await execFileAsync("curl", [
      "-L",
      "--fail",
      "--silent",
      "--show-error",
      "--output",
      target,
      url,
    ]);
    return await readFile(target);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function downloadWorkbook(url: string): Promise<{ bytes: Buffer; mode: "fetch" | "curl" }> {
  try {
    return { bytes: await downloadWithFetch(url), mode: "fetch" };
  } catch (error) {
    console.warn(
      `Node HTTPS could not download the workbook (${error instanceof Error ? error.message : "unknown error"}); retrying with operating-system curl trust.`,
    );
    return { bytes: await downloadWithCurl(url), mode: "curl" };
  }
}

function worksheetHeaders(worksheet: XLSX.WorkSheet): string[] {
  const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headerRow = values[0];
  if (!Array.isArray(headerRow)) return [];

  return headerRow
    .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .filter((value) => value.length > 0);
}

async function main() {
  console.log(`Downloading ${CFIHOS_SOURCE.officialUrl}`);
  const { bytes, mode } = await downloadWorkbook(CFIHOS_SOURCE.officialUrl);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const workbook = XLSX.read(bytes, { type: "buffer" });

  const sheets: WorkbookSnapshot["sheets"] = {};
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    sheets[sheetName] = {
      headers: worksheetHeaders(worksheet),
      rows: XLSX.utils.sheet_to_json<WorksheetRow>(worksheet, {
        defval: null,
        raw: false,
      }),
    };
  }

  const snapshot: WorkbookSnapshot = {
    schema: "cfihos-workbook-snapshot-v1",
    source: {
      url: CFIHOS_SOURCE.officialUrl,
      generatedAt: new Date().toISOString(),
      sha256,
    },
    sheetNames: workbook.SheetNames,
    sheets,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot));
  const size = Buffer.byteLength(JSON.stringify(snapshot));

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Source mode: ${mode}`);
  console.log(`Workbook SHA-256: ${sha256}`);
  console.log(`Worksheets: ${snapshot.sheetNames.length}`);
  console.log(`Snapshot size: ${(size / 1024 / 1024).toFixed(2)} MiB`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
