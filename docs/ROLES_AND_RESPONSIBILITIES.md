# CFIHOS Explorer — Roles & Responsibilities

## 1. Purpose

This document defines operational ownership for CFIHOS Explorer. In a small team, one person may perform several roles; the responsibilities should still remain explicit.

## 2. Roles

### Application Owner

Accountable for the service and its intended use. Approves material releases, prioritizes changes, accepts operational risk and ensures an appropriate support model exists.

### CFIHOS / Data Steward

Accountable for semantic interpretation of CFIHOS source changes. Reviews upstream change reports, validation findings, model-impact changes and proposed adoption of new CFIHOS releases.

### Technical Maintainer

Responsible for source code, dependencies, local/build tooling, generated snapshots, regression tests, defect correction and technical release preparation.

### AI Service Owner

Responsible for the approved OpenAI account/project, API credentials, model selection, usage/cost oversight and AI-specific governance decisions.

### GitHub / Vercel Administrator

Responsible for repository permissions, branch/review controls, GitHub Actions, Vercel project access, environment variables, deployment configuration and production-domain administration.

### User / Engineering Reviewer

Uses the Explorer, Validation, CIS Builder and Assistant for approved workflows; verifies AI interpretations against evidence and reports defects or data concerns.

## 3. RACI matrix

R = Responsible, A = Accountable, C = Consulted, I = Informed.

| Activity | Application Owner | CFIHOS/Data Steward | Technical Maintainer | AI Service Owner | GitHub/Vercel Admin |
| --- | --- | --- | --- | --- | --- |
| Product scope and priorities | A/R | C | C | C | I |
| Approve application release | A | C | R | C | C |
| Develop/fix application | I | C | A/R | C | I |
| Review CFIHOS upstream change | I | A/R | C | I | I |
| Generate workbook snapshot | I | C | A/R | I | I |
| Generate validation snapshot | I | A/C | R | I | I |
| Approve adoption of new CFIHOS source | A | R | C | I | I |
| Run regression/build checks | I | I | A/R | I | I |
| GitHub branch/PR administration | I | I | R | I | A/R |
| Vercel Preview/Production administration | I | I | C | I | A/R |
| Manage OpenAI API key | I | I | C | A/R | R/C |
| Approve model/provider changes | A | I | C | R | I |
| Monitor AI usage/cost | I | I | C | A/R | I |
| Review dependency/security findings | A | C | R | C | C |
| Production rollback | A | I | R | I | R |
| User support / triage | A | C | R | C | C |
| Maintain O&M documentation | A | C | R | C | C |

## 4. Control points

### Upstream CFIHOS change

Automation may detect and report a change, but adoption requires human review. The CFIHOS/Data Steward reviews semantic impact; the Technical Maintainer regenerates and validates artifacts; the Application Owner approves release.

### AI configuration change

Changes to API credentials, model/provider or material AI behaviour require the AI Service Owner. Application behaviour changes still follow normal PR and release controls.

### Production release

No individual developer workstation is the production source of truth. Production should derive from reviewed `main`, automated checks and the connected Vercel deployment.

### Emergency rollback

The Application Owner authorizes rollback where practical; the Technical Maintainer and GitHub/Vercel Administrator execute repository/deployment recovery.

## 5. Access expectations

Use least privilege. Operational ownership should ensure:

- GitHub write/merge access is limited to maintainers who need it.
- Vercel production/environment-variable access is limited to approved administrators.
- OpenAI keys are available only to roles that require secret management.
- Users do not require repository, Vercel or OpenAI administrative access to use the application.

## 6. Handover acceptance

A new operational owner should be able to demonstrate, without relying on the outgoing developer:

1. clone and install the application;
2. run regression tests and a production build;
3. create a feature branch and PR;
4. inspect a Vercel Preview and Production deployment;
5. run the CFIHOS upstream monitor manually;
6. interpret an upstream change signal and locate the report artifact;
7. regenerate workbook and validation snapshots in a controlled branch;
8. configure/rotate the OpenAI API key without exposing it;
9. perform a production smoke test;
10. execute or coordinate a rollback.

