# RDL-062 — Governed Company Context Activation

Sprint 035 establishes an explicit operational transition for a published
Company/L2 RDL.

Activation is not a direct status edit.

The transition:

1. requires an authenticated `rdl-extension-reviewer`;
2. requires the Company context to be `draft`;
3. requires one exact immutable effective-standard release belonging to that
   context;
4. requires that release to be active in the distribution lifecycle;
5. verifies current package pins still exactly match the immutable publication
   manifest;
6. rejects unresolved extension changes or governed-change drift;
7. changes the context from `draft` to `active`;
8. records an immutable activation event containing release, actor, rationale
   and timestamp;
9. relies on the existing active-context database trigger to make package pins
   immutable.

The operation is idempotent for retries against the same context and exact
effective release.

The first operational Sprint 035 Company baseline is:

- context: `company-rdl-cfihos-2-0-v1`
- effective release ID: `21`
- release: `company-rdl-cfihos-2-0 / 1.0.0`
- Industry source: CFIHOS 2.0 only

CCUS and Water / Desalination remain Industry/L1 candidates and are not part of
this operational Company baseline.
