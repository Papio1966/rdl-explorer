# RDL-048 - Product Boundary, Navigation Simplification and Guided Governance UX

## Purpose

RDL-048 implements the product decision that RDL Explorer should focus on governed standards, proposal governance, publication, distribution and consumer contracts, while project CIS authoring and project validation belong to DataGate.

## Accepted decisions

- CIS capability belongs to DataGate.
- RDL Explorer should not present CIS Builder or CIS Preview as primary product capabilities.
- Operate and Govern screens require in-product helper guidance.
- Mapping governance must use clearer decision language than Approve / Reject / Supersede.
- Before recording governed decisions, users should understand consequences and evidence requirements.

## RDL Explorer owns

- Governed standards and RDL hierarchy.
- External proposal intake and governance decisions.
- Effective publication and package distribution.
- Consumer integration contracts for downstream consumers such as DataGate.

## DataGate owns

- Project CIS authoring and tailoring.
- Expected information baseline assembly for a project.
- EPC submission validation, findings, correction and resubmission.
- Project execution state and owner-operator stewardship data capture.

## RDL-048 implementation approach

- Hide CIS Builder and CIS Preview from primary RDL Explorer navigation.
- Keep direct legacy routes redirected to a boundary explanation page instead of deleting code in this sprint.
- Add an RDL / DataGate Boundary page under Help.
- Add guided help for complex Operate and Govern routes.
- Clarify proposal and mapping decision language.
- Preserve the RDL-047/RDL-046/RDL-045/RDL-044 contract stack.

## Out of scope

- DataGate implementation changes.
- Direct DataGate-to-RDL database writes.
- Database migrations.
- Broad deletion of legacy CIS code.
- Automatic publication or promotion changes.
