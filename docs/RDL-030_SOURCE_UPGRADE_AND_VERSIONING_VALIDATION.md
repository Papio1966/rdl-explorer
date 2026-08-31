# RDL-030 — RDL Source Upgrade & Versioning Validation

## Objective

Prove the existing RDL release/package architecture with two genuine domain upgrades rather than synthetic fixtures. Water / Desalination and CCUS 0.1 remain historical releases; the release-safe 2.0 candidates are ingested alongside them.

## Release set

| Source | Release key | Product status | Purpose |
| --- | --- | --- | --- |
| CCUS | `ccus-0.1-draft` | Superseded | Historical baseline / pinning test |
| CCUS | `ccus-2.0-candidate` | Candidate | Current release-safe candidate |
| Water / Desalination | `water-desalination-0.1-draft` | Superseded | Historical baseline / pinning test |
| Water / Desalination | `water-desalination-2.0-candidate` | Candidate | Current release-safe candidate |

## Identity policy

1. The same release key cannot accept a different workbook fingerprint.
2. A native identifier cannot change entity type between releases.
3. Canonical identity changes under the same type are governance decisions, not similarity guesses. A declared predecessor release therefore requires the SHA-256-fingerprinted RDL-030 release-safety audit.
4. The v2 ingestion transaction is rolled back when an identity gate fails.
5. Existing exact package replays remain idempotent after a successor release exists.

## Browser behavior

The RDL catalogue lists all releases and their status. Selecting Water or CCUS exposes a separate release selector. Search results carry `releaseKey`, `releaseStatus`, package and native identity. Generic entity routes use `/rdl/:sourceKey/:releaseKey/:entityType/:nativeIdentifier`, so identical native IDs in 0.1 and 2.0 resolve independently. All-RDL search and cross-RDL intelligence use only each source's configured current/default release; historical releases are visible only when explicitly selected.

`/rdls/:sourceKey/compare` presents the real audited old→v2 delta and a detailed entity-level add/retire/rename list from the release-aware search projection.

## Real acceptance anchors

- CCUS: 45→61 equipment classes, 11→18 tag classes, 55→96 properties, 30→42 document types.
- CCUS relationships: +182 equipment→property, +121 tag→property, +42 tag→equipment, +65 class→required document.
- Water / Desalination: 50→50 equipment classes, 30→31 tag classes, 49→63 properties, 28→28 document types.
- Water relationships: +49 equipment→property, +34 tag→property, +4 tag→equipment, no class→required-document removals.
- `WATERRDL-31000012` proves rename continuity: `RO` in 0.1 becomes `reverse-osmosis system tag` in 2.0 under the same identifier.

## Commands after installation

```bash
npm run test:rdl-030
npm run test:regression
npm run build

# Database validation, when RDL_DATABASE_URL is configured:
npm run db:test:rdl-030
```

The database test runs migrations, preserves/seeds the historical releases, ingests both v2 candidates, supersedes the historical release metadata, validates exact real deltas, and proves that a deliberately repurposed identifier is rejected.

## Non-goals

RDL-030 does not automatically move consumers/projects from 0.1 to 2.0, and it does not replace the RDL-021 impact or RDL-022 migration/adoption workflows. It also does not yet build the full rich generic relationship pages; that is RDL-031.
