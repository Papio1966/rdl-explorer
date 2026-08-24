import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const workbookSource = await readFile(resolve("src/cfihos/workbook.ts"), "utf8");
if (/from\s+["']xlsx["']|require\(["']xlsx["']\)/.test(workbookSource)) {
  throw new Error("FAIL runtime isolation: src/cfihos/workbook.ts still imports xlsx.");
}

const snapshotPath = resolve("public/cfihos-workbook.json");
await stat(snapshotPath).catch(() => {
  throw new Error(
    "FAIL runtime isolation: public/cfihos-workbook.json is missing. Run `npx tsx scripts/generate-workbook-snapshot.ts`.",
  );
});

const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as {
  schema?: string;
  source?: { url?: string; sha256?: string };
  sheetNames?: unknown[];
  sheets?: Record<string, unknown>;
};

if (snapshot.schema !== "cfihos-workbook-snapshot-v1") {
  throw new Error("FAIL runtime isolation: unexpected snapshot schema.");
}
if (!snapshot.source?.url || !/^[a-f0-9]{64}$/i.test(snapshot.source.sha256 ?? "")) {
  throw new Error("FAIL runtime isolation: snapshot source URL/SHA-256 metadata is incomplete.");
}
if (!Array.isArray(snapshot.sheetNames) || snapshot.sheetNames.length === 0 || !snapshot.sheets) {
  throw new Error("FAIL runtime isolation: snapshot sheet data is missing.");
}

console.log(`PASS runtime isolation: browser workbook loader is JSON-only; snapshot contains ${snapshot.sheetNames.length} worksheets.`);
