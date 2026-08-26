# Consumer Integration Contract

RDL-020 defines the downstream integration boundary after RDL Explorer publishes an immutable effective-standard release.

The preferred pattern is **push notification, pull content**:

1. RDL Explorer publishes an immutable release.
2. A transactional notification/outbox record announces the exact release ID and change classification.
3. The consumer acknowledges discovery.
4. The consumer pulls the immutable package through the RDL-019 distribution API and verifies SHA-256 integrity.
5. The consumer stages the exact release using an idempotent request key.
6. The consumer explicitly activates or rejects the staged release under its own governance.

Notification never transfers mutable authoring state and never auto-activates a downstream standard.

## Subscription model

A consumer subscription identifies the consumer, optional enterprise context, contract version and notification mode. `pull` is the operational default. `webhook-contract` records the callback contract for a future delivery adapter; RDL-020 does not introduce a generic outbound webhook dispatcher or store external secrets.

## Idempotent pull and staging

`consumer_pull_receipt` records a consumer-provided request key and package SHA-256. `(subscription_id, request_key)` is unique. Retries therefore cannot create duplicate staging receipts or silently select another release.

## Change notification

Publication creates a `release.published` notification for enabled subscriptions matching the release context. Deprecation and supersession create explicit lifecycle notifications. Notification records are idempotent by `event_key` and remain separate from immutable package bytes.

## Consumer lifecycle

The consumer state is explicit:

`discovered -> staged -> activated`

or

`discovered/staged -> rejected`

Activation cannot skip staging. Activated and rejected states are terminal in this contract. Publishing a new RDL release never modifies the active release in a consumer system.

## DataGate reference integration

DataGate should use the same boundary as any other consumer:

`RDL Explorer publication -> release notification -> DataGate discovery -> package pull -> SHA-256 verification -> DataGate staging/review -> explicit DataGate activation`

RDL Explorer must not write directly to DataGate tables and DataGate must not query RDL Explorer PostgreSQL tables. The immutable package and versioned APIs are the integration contract.

A DataGate implementation may later add enterprise messaging or webhook delivery around the notification contract, but transport must not change package identity, integrity, pinning or activation semantics.
