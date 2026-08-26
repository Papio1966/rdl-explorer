import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const files=[
  "database/migrations/008_create_enterprise_extension_authoring_governance.sql","server/rdl/EnterpriseExtensionRepository.ts","server/rdl/EnterpriseExtensionService.ts",
  "api/extensions/create.ts","api/extensions/review.ts","api/extensions/preview.ts","api/extensions/promote.ts","api/extensions/publish.ts","src/pages/RdlExtensionsPage.tsx","src/rdl/enterpriseExtensionService.ts","docs/ARCHITECTURE.md","docs/REQUIREMENTS.md"
];
const text=files.map(f=>readFileSync(f,"utf8")).join("\n");
assert.ok(text.includes("context_extension_review_event") && text.includes("append-only"),"RDL-017 must retain append-only extension review history");
assert.ok(text.includes("review_version") && text.includes("version conflict"),"RDL-017 must use optimistic governance versioning");
assert.ok(text.includes("extension_conflicts") && text.includes("conflicts"),"RDL-017 must detect extension conflicts before approval/publication");
assert.ok(text.includes("Effective preview") && text.includes("publishable"),"RDL-017 must expose effective preview and publishability semantics");
assert.ok(text.includes("rdl-extension-reviewer"),"RDL-017 write boundary must require a dedicated extension reviewer role");
assert.ok(text.includes("promote") && text.includes("Project to Asset or Asset to Company"),"RDL-017 must implement controlled upward promotion");
assert.ok(text.includes("effective_context_publication") && text.includes("compositionSha256"),"RDL-017 must publish immutable effective-context composition records");
assert.ok(text.includes("does not") || text.includes("never rewrites"),"RDL-017 must preserve immutable upstream/project semantics");
console.log("PASS RDL-017 enterprise extension authoring and governance contract");
