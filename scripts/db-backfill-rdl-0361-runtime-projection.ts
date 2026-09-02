import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient, sqlLiteral } from "../server/db/PsqlJsonClient.ts";

type SearchIdentity = {
  sourceKey: string;
  releaseKey: string;
  packageKey: string;
};

type PackageRow = {
  package_key: string;
  source_key: string;
  release_key: string;
};

const config = getRdlDatabaseConfig();
const client = new PsqlJsonClient(config.connectionString);
const oracle = JSON.parse(readFileSync("public/rdl-search-index.json", "utf8")) as SearchIdentity[];
const packages = [...new Map(oracle.map((record) => [record.packageKey, record])).values()]
  .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.releaseKey.localeCompare(b.releaseKey));

assert.equal(packages.length, 5, `RDL-036.1 expects five governed browser packages; found ${packages.length}`);

const packageList = packages.map((item) => sqlLiteral(item.packageKey)).join(", ");
const existing = await client.query<PackageRow>(`
  SELECT p.package_key, s.source_key, r.release_key
  FROM rdl.rdl_package p
  JOIN rdl.rdl_release r ON r.release_id = p.release_id
  JOIN rdl.rdl_source s ON s.source_id = r.source_id
  WHERE p.package_key IN (${packageList})
  ORDER BY s.source_key, r.release_key
`);

assert.deepEqual(
  existing.map((row) => `${row.source_key}|${row.release_key}|${row.package_key}`),
  packages.map((row) => `${row.sourceKey}|${row.releaseKey}|${row.packageKey}`),
  "RDL-036.1 backfill requires the exact five governed package identities already present in PostgreSQL",
);

const generatorScripts = [
  "scripts/generate-cfihos-ingestion-sql.ts",
  "scripts/generate-ccus-ingestion-sql.ts",
  "scripts/generate-water-desalination-ingestion-sql.ts",
  "scripts/generate-ccus-v2-ingestion-sql.ts",
  "scripts/generate-water-desalination-v2-ingestion-sql.ts",
];

const statements: string[] = [];
let entityStatements = 0;
let relationshipStatements = 0;

for (const generator of generatorScripts) {
  const generated = execFileSync("npx", ["tsx", generator], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  for (const rawLine of generated.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("INSERT INTO rdl.rdl_entity ")) {
      const metadataOnly = line.replace(
        /ON CONFLICT \(package_id, entity_type_code, native_identifier\) DO UPDATE SET name=EXCLUDED\.name, definition=EXCLUDED\.definition, normalized_metadata=EXCLUDED\.normalized_metadata, source_locator=EXCLUDED\.source_locator;$/,
        "ON CONFLICT (package_id, entity_type_code, native_identifier) DO UPDATE SET normalized_metadata=EXCLUDED.normalized_metadata, source_locator=EXCLUDED.source_locator;",
      );
      assert.notEqual(metadataOnly, line, `Unable to make entity upsert metadata-only for ${generator}`);
      statements.push(metadataOnly);
      entityStatements += 1;
    } else if (line.startsWith("INSERT INTO rdl.rdl_relationship ")) {
      statements.push(line);
      relationshipStatements += 1;
    }
  }
}

assert.ok(entityStatements > 0, "No entity enrichment statements generated");
assert.ok(relationshipStatements > 0, "No relationship enrichment statements generated");

const sql = [
  "\\set ON_ERROR_STOP on",
  "BEGIN;",
  `CREATE TEMP TABLE rdl0361_entity_identity_before ON COMMIT DROP AS
     SELECT e.package_id, e.entity_type_code, e.native_identifier, e.name, e.definition
     FROM rdl.rdl_entity e
     JOIN rdl.rdl_package p ON p.package_id = e.package_id
     WHERE p.package_key IN (${packageList});`,
  ...statements,
  `DO $rdl0361$
   BEGIN
     IF EXISTS (
       (SELECT e.package_id, e.entity_type_code, e.native_identifier, e.name, e.definition
          FROM rdl.rdl_entity e
          JOIN rdl.rdl_package p ON p.package_id = e.package_id
         WHERE p.package_key IN (${packageList})
        EXCEPT
        SELECT package_id, entity_type_code, native_identifier, name, definition
          FROM rdl0361_entity_identity_before)
       UNION ALL
       (SELECT package_id, entity_type_code, native_identifier, name, definition
          FROM rdl0361_entity_identity_before
        EXCEPT
        SELECT e.package_id, e.entity_type_code, e.native_identifier, e.name, e.definition
          FROM rdl.rdl_entity e
          JOIN rdl.rdl_package p ON p.package_id = e.package_id
         WHERE p.package_key IN (${packageList}))
     ) THEN
       RAISE EXCEPTION 'RDL-036.1 backfill attempted to change governed entity identity; transaction rolled back.';
     END IF;
   END
   $rdl0361$;`,
  "COMMIT;",
  "",
].join("\n");

const result = spawnSync(
  "psql",
  [config.connectionString, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
  { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

if (result.status !== 0) {
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  throw new Error(`RDL-036.1 non-destructive backfill failed with psql exit code ${result.status ?? "unknown"}`);
}

console.log(`PASS RDL-036.1 non-destructive enrichment: ${entityStatements} entity metadata upserts, ${relationshipStatements} governed relationship upserts`);
console.log("PASS RDL-036.1 governed entity identity remained unchanged inside the enrichment transaction");
console.log("PASS RDL-036.1 historical releases were enriched without replaying the release-identity gate");
