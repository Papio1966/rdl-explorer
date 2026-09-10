#!/usr/bin/env bash
set -euo pipefail
DATABASE_URL="${RDL_DATABASE_URL:-${DATABASE_URL:-postgresql://localhost:5432/rdl_explorer}}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/sql/test_rdl_047_proposal_governance_decision_workflow.sql
