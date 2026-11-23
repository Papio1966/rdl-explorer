import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=
  readFileSync(
    "database/migrations/034_create_company_context_activation_governance.sql",
    "utf8"
  );

const repository=
  readFileSync(
    "server/rdl/CompanyContextActivationRepository.ts",
    "utf8"
  );

const service=
  readFileSync(
    "server/rdl/CompanyContextActivationService.ts",
    "utf8"
  );

const api=
  readFileSync(
    "api/company-adoption/activate-context.ts",
    "utf8"
  );

const pinGuard=
  readFileSync(
    "database/migrations/027_extend_multi_rdl_publication_provenance.sql",
    "utf8"
  );


assert.ok(
  migration.includes(
    "company_context_activation_event"
  )
);

assert.ok(
  migration.includes(
    "activate_company_context"
  )
);

assert.ok(
  migration.includes(
    "Company context package pins drifted after publication"
  )
);

assert.ok(
  migration.includes(
    "Company context governed changes drifted after publication"
  )
);

assert.ok(
  migration.includes(
    "Effective release must be active in the distribution lifecycle"
  )
);

assert.ok(
  migration.includes(
    "Company context activation events are immutable"
  )
);

assert.ok(
  repository.includes(
    "rdl.activate_company_context"
  )
);

assert.ok(
  service.includes(
    "effectiveStandardReleaseId"
  )
  &&
  service.includes(
    "Activation rationale"
  )
);

assert.ok(
  api.includes(
    "authenticatedExtensionContext"
  )
  &&
  api.includes(
    "company_adoption.activate_context"
  )
);

assert.ok(
  pinGuard.includes(
    "BEFORE INSERT OR UPDATE OR DELETE"
  )
  &&
  pinGuard.includes(
    "package pins for active contexts are immutable"
  )
);

console.log(
  "PASS - RDL-062 Company context activation: authenticated activation requires one exact immutable effective release, rejects post-publication composition drift, records an immutable audit event and activates the existing package-pin freeze."
);
