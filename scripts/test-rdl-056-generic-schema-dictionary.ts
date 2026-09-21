import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRdlDatabaseClient, closeRdlDatabaseClient } from "../server/db/runtime.ts";
import { RdlSchemaDictionaryRepository } from "../server/rdl/RdlSchemaDictionaryRepository.ts";
import { RdlSchemaDictionaryService } from "../server/rdl/RdlSchemaDictionaryService.ts";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const migration = read("database/migrations/030_create_generic_schema_dictionary.sql");
const backfill = read("database/sql/backfill_rdl_056_generic_schema_dictionary.sql");
const app = read("src/App.tsx");
const shell = read("src/components/AppShell.tsx");
const api = read("api/rdl-runtime/schema-dictionary.ts");
const page = read("src/pages/SchemaDictionaryPage.tsx");

assert.ok(migration.includes("rdl.schema_definition") && migration.includes("rdl.schema_constraint"));
assert.ok(migration.includes("REFERENCES rdl.rdl_source_record(source_record_id, package_id)"));
assert.ok(backfill.includes("LOWER(BTRIM(ss.sheet_name))='data dictionary'"));
assert.ok(!migration.includes("INSERT INTO rdl.rdl_entity") && !backfill.includes("INSERT INTO rdl.rdl_entity"));
assert.ok(api.includes('"rdl-schema-dictionary/v1"'));
assert.ok(app.includes('path="/schema"') && app.includes("SchemaDictionaryPage"));
assert.ok(shell.includes('label: "Schema Dictionary"') && shell.includes('to: "/schema"'));
assert.ok(page.includes("Information-model semantics are projected from immutable source records"));

const client = getRdlDatabaseClient();
try {
  const service = new RdlSchemaDictionaryService(new RdlSchemaDictionaryRepository(client));
  const result = await service.list({ sourceKey: "cfihos", releaseKey: "cfihos-2.0", limit: 500 });
  assert.ok(result.total > 0, "CFIHOS schema dictionary must contain normalized definitions");
  const anchor = result.items.find((item) => item.nativeIdentifier === "CFIHOS-10000240");
  assert.ok(anchor, "known measurement-system schema anchor must exist");
  assert.equal(anchor?.conceptKind, "attribute");
  assert.equal(anchor?.entityName, "site");
  assert.equal(anchor?.propertyName, "measurement system code");
  assert.equal(anchor?.requirementStatus, "Mandatory");
  assert.equal(anchor?.dataTypeHint, "text");
  assert.equal(anchor?.presenceConstraint, "measurement system");
  assert.equal(anchor?.relationshipVerb, "is used by default at");

  const rows = await client.query<{ source_count: number; schema_count: number; flattened_count: number }>(`
    SELECT
      (SELECT count(*)::int FROM rdl.rdl_source_record sr JOIN rdl.rdl_source_sheet ss ON ss.source_sheet_id=sr.source_sheet_id AND ss.package_id=sr.package_id WHERE lower(btrim(ss.sheet_name))='data dictionary') AS source_count,
      (SELECT count(*)::int FROM rdl.schema_definition) AS schema_count,
      (SELECT count(*)::int FROM rdl.rdl_entity WHERE entity_type_code IN ('schema_definition','schema_constraint','schema_attribute','schema_field')) AS flattened_count
  `);
  assert.equal(Number(rows[0]?.schema_count), Number(rows[0]?.source_count));
  assert.equal(Number(rows[0]?.flattened_count), 0);
} finally {
  await closeRdlDatabaseClient();
}

console.log("PASS_RDL056_GENERIC_SCHEMA_DICTIONARY_RUNTIME_CONTRACT");
