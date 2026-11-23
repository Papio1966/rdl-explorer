import assert from "node:assert/strict";

import { getRdlDatabaseConfig } from "../server/db/config.ts";
import { PsqlJsonClient } from "../server/db/PsqlJsonClient.ts";

const client =
  new PsqlJsonClient(
    getRdlDatabaseConfig().connectionString
  );

const functionRows =
  await client.query<{ signature:string|null }>(`
    SELECT
      to_regprocedure(
        'rdl.resolve_company_adoption_merge(text,bigint,text,text,text,text,text,jsonb)'
      )::text AS signature
  `);

assert.ok(
  functionRows[0]?.signature,
  "RDL-061 merge-resolution database function must exist"
);

console.log(
  `PASS migration function: ${functionRows[0].signature}`
);

const mappings =
  await client.query<{ mapping_id:number|string }>(`
    SELECT mapping_id
    FROM rdl.cross_rdl_mapping
    ORDER BY mapping_id
    LIMIT 1
  `);

assert.ok(
  mappings[0],
  "RDL-061 acceptance requires at least one cross-RDL mapping"
);

const mappingId =
  Number(mappings[0].mapping_id);

assert.ok(
  Number.isSafeInteger(mappingId)
  && mappingId > 0,
  "RDL-061 acceptance returned an invalid mapping id"
);

let failedClosed = false;

try {
  await client.query(`
    SELECT *
    FROM rdl.resolve_company_adoption_merge(
      'RDL061-NONEXISTENT-CONTEXT',
      ${mappingId},
      'RDL061-COMPANY-TARGET',
      'RDL-061 test target',
      'Rollback-only test definition',
      'Rollback-only merge workflow validation.',
      'rdl061-test',
      jsonb_build_array(
        jsonb_build_object(
          'componentKind','other',
          'componentKey','merge_component_closure',
          'resolution','target_override',
          'resolvedPayload',
            jsonb_build_object(
              'schemaVersion','rdl-company-merge-closure/v1',
              'resolvedComponents',
                jsonb_build_object(
                  'definition',
                  jsonb_build_object(
                    'resolution','target_override',
                    'values',
                    jsonb_build_array('test')
                  )
                ),
              'materializedRelationships',
                jsonb_build_array()
            ),
          'rationale',
          'Rollback-only merge closure acceptance.'
        )
      )
    )
  `);
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  assert.match(
    message,
    /Company context RDL061-NONEXISTENT-CONTEXT does not exist/i,
    `Unexpected RDL-061 fail-closed error: ${message}`
  );

  failedClosed = true;
}

assert.equal(
  failedClosed,
  true,
  "Invalid Company context must fail closed"
);

const mutationRows =
  await client.query<{ count:number|string }>(`
    SELECT count(*)::integer AS count
    FROM rdl.context_extension_change
    WHERE native_identifier='RDL061-COMPANY-TARGET'
  `);

assert.equal(
  Number(mutationRows[0]?.count ?? -1),
  0,
  "Fail-closed acceptance must not mutate extension state"
);

console.log(
  "PASS - RDL-061 database acceptance: canonical repository DB configuration works, migration 033 is installed, invalid merge execution fails closed, and no extension mutation occurs"
);
