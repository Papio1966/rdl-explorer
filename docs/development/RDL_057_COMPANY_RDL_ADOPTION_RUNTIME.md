# RDL-057 — Company RDL Adoption Runtime

## Purpose

RDL-057 turns the existing RDL-054 composition model into a production runtime
foundation for governed Industry/L1 to Company/L2 adoption.

It does not create a second semantic model.

## Envelope rule

L1 contains immutable source standards.

L2 is a governed Company RDL assembled through explicit adoption, composition
and promotion decisions.

The existence of an L1 standard does not automatically place it in L2.

## Runtime capabilities

RDL-057 provides governed runtime operations to:

1. create a draft Company context;
2. pin an exact published Industry package to that draft Company context;
3. create an entity-level Company adoption composition;
4. retain the exact source package/entity contributors;
5. retain component-level decisions and rationale;
6. route the resulting Company extension through the existing Extension
   Governance lifecycle;
7. prevent publication of an effective standard that contains no governed
   entities.

## Whole-standard adoption

A complete published L1 standard can be adopted by pinning its exact package to
the draft Company context.

For the first operational DataGate baseline the intended source is published
CFIHOS 2.0.

## Selective adoption

Individual L1 entities can be adopted through a governed Company composition.

The existing composition kinds remain authoritative:

- `derived_copy`
- `multi_source_merge`
- `promotion`

The existing component resolutions remain authoritative:

- `use_source`
- `combine`
- `target_override`
- `keep_separate`
- `exclude`
- `reference_only`

## Collision governance

Same-name objects do not become equivalent automatically.

Collision identification and governance remain separate from the composition
write operation.

A later UI orchestration increment will combine Cross-RDL Intelligence, Mapping
Governance and Company composition into one administrator workflow.

## Defer

Defer is a governance lifecycle decision, not a component-resolution type.

A future governance increment will expose an explicit persisted defer action
based on the existing "Request further analysis" decision semantics.

## Publication invariant

An effective standard cannot be published if its resulting governed entity count
is zero.

This check is enforced before creation of an immutable
`effective_standard_release`.

## DataGate boundary

DataGate remains a downstream consumer.

DataGate:

- does not compose L1 standards;
- does not mutate RDL Explorer databases;
- consumes only governed published effective releases and their public
  distribution contracts.

## Source immutability

RDL-057 never updates or deletes:

- `rdl.rdl_source`
- `rdl.rdl_release`
- `rdl.rdl_package`
- `rdl.rdl_entity`

Company adoption creates downstream governed records only.

## Administrator workflow

RDL-057.2 adds `/company-adoption` as the orchestration entry point for L1 -> L2
governance.

The page does not replace the specialist governance surfaces. It connects them:

1. create the draft Company/L2 context;
2. adopt an exact published Industry package;
3. compare possible overlaps through Cross-RDL Intelligence;
4. govern possible equivalence/separation through Mapping Governance;
5. create selective exact-entity Company compositions;
6. submit Company extensions through Extension Governance;
7. review and publish through Effective Publication.

The initial selective-entity control deliberately uses the exact source entity
identifier. A later UX increment may replace this technical selector with direct
selection from the release-aware entity browser without changing the runtime
contract.

## API boundary

Authenticated endpoints are available under:

- `/api/company-adoption/session`
- `/api/company-adoption/packages`
- `/api/company-adoption/create-context`
- `/api/company-adoption/pin-package`
- `/api/company-adoption/create-composition`

They reuse the existing trusted RDL extension-governance identity boundary.

No endpoint grants DataGate composition authority.

## RDL-058 — Company adoption collision governance

Cross-RDL mappings remain semantic evidence. They are not modified merely because
a Company administrator makes an L2 adoption decision.

RDL-058 introduces a Company-context decision record with the following
dispositions:

- **Merge** — the concepts are intended to become one governed Company concept.
  Component-level composition remains an explicit subsequent governance step.
- **Keep Separate** — both concepts remain distinct without renaming.
- **Rename** — the concept remains separate and receives an explicit governed
  Company name.
- **Exclude** — the candidate is deliberately not adopted into the selective
  Company composition.
- **Defer** — the reviewer has considered the collision but requires additional
  evidence before deciding.

`Defer` is materially different from an unreviewed candidate. It records reviewer,
rationale, timestamp and review version.

A Company effective release cannot be published while explicit deferred collision
decisions remain unresolved.

### Direct L1 entity discovery

Company Adoption can query entities from an exact published Industry package.
This removes the need for administrators to know internal numeric entity IDs.

Entity discovery does not mutate the source package and is restricted to
published L1 releases.

## RDL-059 — Administrator collision workbench

The Company RDL Adoption page now provides a business-facing L1 selection flow:

1. select the published Industry standard;
2. search its entities by identifier, type or name;
3. select the exact L1 concept;
4. load known cross-RDL collision evidence;
5. record a Company-context disposition;
6. create the governed Company derivation only when the decision state permits it.

### Subject-sensitive decisions

`Rename` and `Exclude` identify the exact entity to which the decision applies.

This removes ambiguity from a two-sided collision:

- Rename **which** concept?
- Exclude **which** concept?

The selected subject must be one of the two entities represented by the mapping
evidence.

### Merge behaviour

Selecting **Merge** records the governance intent that the concepts should become
one Company concept.

It does **not** automatically combine definitions, properties, document
requirements or relationships.

The existing RDL-054 component-level composition model remains authoritative for
that semantic resolution.

Until those component decisions are supplied, the Company Adoption workbench
fails closed and does not create a simplistic derived-copy result.

### Adoption readiness

A selective Company adoption cannot proceed while:

- collision evidence remains undecided;
- any collision is explicitly deferred;
- the selected concept is explicitly excluded;
- conflicting rename decisions exist; or
- a Merge decision still requires component-level resolution.

## RDL-060 — Merge publication materialization

A Company multi-source merge is not complete merely because provenance records
two contributors.

A publishable merge must represent one governed Company concept.

### Contributor suppression

When a merge contributor is inherited from a package that is pinned into the
Company context, that inherited source entity must be explicitly retired from
the Company effective view.

The Industry source remains unchanged.

The retirement affects only the Company/L2 composition.

### Merge component closure

A multi-source composition must include the governed component decision:

- component kind: `other`
- component key: `merge_component_closure`
- resolution: `target_override`
- schema: `rdl-company-merge-closure/v1`

The closure records the resolved semantic-component state and the effective
relationships created for the governed Company entity.

Publication fails closed when this closure is absent.

### Effective relationships

Relationships resulting from a governed merge are materialized into the
immutable publication `effectiveRelationships` array.

Each derived relationship retains:

- exact composition identity;
- exact contributor entity ids;
- exact contributor package keys;
- source relationship/component evidence in the merge closure;
- the governed Company target identity.

Source relationships are never mutated.

### Why this is required

Without materialization, a consumer such as DataGate could receive correct
composition provenance while still receiving only the relationship closure of
the pinned Industry packages.

That would make the effective Company semantics incomplete.

RDL-060 therefore ensures that the consumer contract represents both:

1. where the Company concept came from; and
2. what the governed Company concept actually means.

## RDL-061 — Company Merge Workbench

The Company Merge Workbench completes the semantic-resolution stage of an
L1-to-L2 collision that has already been governed as **Merge**.

### Sequence

1. Company RDL Adoption selects the exact L1 object and evaluates collision
   evidence.
2. An administrator explicitly records **Merge**.
3. Company Merge Workbench resolves the semantic content.
4. RDL Explorer creates:
   - one Company target extension draft;
   - one `multi_source_merge` derivation;
   - exact contributor provenance;
   - explicit component decisions;
   - `rdl-company-merge-closure/v1`;
   - retirement/suppression drafts for inherited source identities.
5. Normal Extension Governance reviews the target and suppression drafts.
6. Only approved governed state can enter effective publication.

### Generic projection

The merge editor does not contain a CFIHOS-specific merge engine.

It uses the generic PostgreSQL-backed RDL runtime detail and relationship
projection for both exact contributors. The same workbench can therefore
compare CFIHOS, CCUS, Water/Desalination, or another normalized RDL package.

### Explicit resolution

Equal components may be pre-resolved because the projected values are
identical.

Every semantic difference requires an administrator decision.

The workbench covers:

- definition;
- hierarchy;
- attributes;
- properties;
- document requirements;
- disciplines;
- information requirements;
- relationships;
- controlled values;
- units of measure.

### Relationship materialization

A retained source relationship is rewritten only at the contributor endpoint:
the L1 contributor identity becomes the governed Company identity.

The other endpoint, relationship type, attributes and evidence remain
traceable to the source projection.

The resulting relationship closure is consumed directly by RDL-060
publication. DataGate does not reinterpret the merge.

### Package prerequisite

RDL-061 currently performs multi-source collision merges only when both exact
source packages are already pinned into the draft Company context.

This is intentional for whole-standard adoption because retained relationship
endpoints must remain present in the effective Company package.

Selective single-object adoption remains a separate governed derivation
workflow and does not silently pin an entire source standard.

### Source immutability

Contributor suppression is an L2 composition action.

No L1 source entity, package, release or relationship is changed or deleted.

## RDL-058 — Company adoption collision governance

Cross-RDL mappings remain semantic evidence. They are not modified merely because
a Company administrator makes an L2 adoption decision.

RDL-058 introduces a Company-context decision record with the following
dispositions:

- **Merge** — the concepts are intended to become one governed Company concept.
  Component-level composition remains an explicit subsequent governance step.
- **Keep Separate** — both concepts remain distinct without renaming.
- **Rename** — the concept remains separate and receives an explicit governed
  Company name.
- **Exclude** — the candidate is deliberately not adopted into the selective
  Company composition.
- **Defer** — the reviewer has considered the collision but requires additional
  evidence before deciding.

`Defer` is materially different from an unreviewed candidate. It records reviewer,
rationale, timestamp and review version.

A Company effective release cannot be published while explicit deferred collision
decisions remain unresolved.

### Direct L1 entity discovery

Company Adoption can query entities from an exact published Industry package.
This removes the need for administrators to know internal numeric entity IDs.

Entity discovery does not mutate the source package and is restricted to
published L1 releases.
