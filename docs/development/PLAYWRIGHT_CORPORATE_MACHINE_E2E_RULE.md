# RDL Explorer — Browser E2E / Corporate Machine Development Rule

**Status:** Permanent development rule
**Applies to:** RDL Explorer development on Alessandro's corporate-managed Mac
**Established:** 31-Aug-2026
**Reason:** Repeated time loss caused by attempting to run Playwright browser automation locally on a corporate-managed machine.

---

## 1. Permanent environment constraint

The corporate Mac does **not** provide a reliable local Playwright browser execution environment.

Two failure modes have been observed:

### A. Microsoft Edge automation is blocked by corporate policy

Typical error:

```text
DevTools remote debugging is disallowed by the system admin.
```

Playwright requires browser remote-debugging / automation capabilities.
**Do not attempt to bypass this corporate policy.**

If a local Edge Playwright run fails immediately (typically in 1–2 ms per test) with this message, classify it as an **environment limitation, not an application failure**.

### B. Playwright bundled Chromium may not be installed locally

Typical error:

```text
browserType.launch: Executable doesn't exist at .../ms-playwright/chromium_headless_shell...
Looks like Playwright was just installed or updated.
Please run:
    npx playwright install
```

On the corporate machine, **do not assume browser installation will be allowed** and do not make installation the default troubleshooting path.

---

## 2. Local vs CI responsibility

### Local corporate-machine gate

The mandatory local validation gate is:

1. `git diff --check`
2. sprint-specific contract test, e.g. `npm run test:rdl-030`
3. `npm run test:regression`
4. `npm run build`
5. inspect `git status`

These checks must be green before committing/pushing.

Example:

```bash
cd /Users/A.Allodi/Documents/App_Development/RDL-Explorer

{
  echo "===== LOCAL FINAL GATE ====="
  date
  echo

  echo "===== STATUS ====="
  git status --short
  echo

  echo "===== DIFF CHECK ====="
  git diff --check
  echo

  echo "===== SPRINT CONTRACT ====="
  npm run test:rdl-030
  echo

  echo "===== REGRESSION ====="
  npm run test:regression
  echo

  echo "===== BUILD ====="
  npm run build
} > /Users/A.Allodi/Downloads/RDL-local-final-gate.log 2>&1
```

### GitHub Actions gate

**GitHub Actions is the authoritative browser E2E and accessibility gate.**

The CI runner can use Playwright Chromium without the corporate Mac restrictions.

Required CI checks include:

- full `npm run test:e2e`
- accessibility / axe checks
- browser navigation / interaction tests
- sprint-specific browser acceptance tests

**Do not merge a PR until GitHub browser E2E is green.**

---

## 3. Important workflow rule

Before a sprint is considered ready to merge:

### Mandatory sequence

1. Complete implementation.
2. Run sprint contract locally.
3. Run full regression locally.
4. Run production build locally.
5. Run `git diff --check`.
6. Commit and push.
7. Let GitHub Actions run full Playwright Chromium E2E.
8. If GitHub E2E fails, inspect the **first real browser failure**.
9. Fix the application or stale test contract as appropriate.
10. Repeat until GitHub E2E is green.
11. Merge only after all required checks pass.

### Do NOT

- treat local Edge Playwright failure as an application defect when corporate policy blocks DevTools remote debugging;
- repeatedly try to install browsers on the corporate machine;
- spend time trying to bypass corporate browser controls;
- omit GitHub E2E from the final merge gate;
- declare a sprint fully green based only on static regression + build.

---

## 4. Failure classification rule

When Playwright fails, classify before changing code.

### Environment failure

Signs:

- failures occur at `0ms`, `1ms`, `2ms`, etc.;
- browser never reaches application;
- error contains:
  - `DevTools remote debugging is disallowed by the system admin`
  - `Executable doesn't exist`
  - browser launch / executable / policy errors.

**Action:** stop the run; do not change application code.

### Genuine browser/application failure

Signs:

- page loads;
- screenshots/traces are generated from actual UI state;
- failure is selector, accessibility, navigation, content, state, or timeout related;
- test takes hundreds of milliseconds or seconds.

**Action:** inspect the first failure and determine whether:
- the UI is wrong, or
- the test is stale because the intended UI contract changed.

Never weaken a valid test merely to make CI green.

---

## 5. RDL-030 lesson recorded

During RDL-030, the browser E2E suite was not included in the pre-commit validation, which allowed:

- accessibility contrast regressions;
- stale selectors after navigation changes;
- changed release provenance text;
- table accessibility-name regressions;
- release selector accessibility mismatch;
- sidebar behavior/test-contract mismatch.

The corrective rule is:

> **Static regression and production build are necessary but are not substitutes for browser E2E. GitHub Actions browser E2E is a mandatory merge gate.**

---

## 6. Current Playwright configuration behavior

RDL Explorer currently uses:

- **local:** Microsoft Edge
- **CI:** Chromium

This is intentional, but on the corporate Mac local Edge automation may be blocked by policy.

Therefore:

> **Do not rely on local Playwright execution on the corporate Mac. Use GitHub Actions for browser automation.**

---

## 7. Guidance for future ChatGPT sessions

When resuming RDL Explorer development in a new chat:

1. Read this file before proposing browser-validation steps.
2. Do not ask Alessandro to install Playwright Chromium by default.
3. Do not ask Alessandro to repeatedly run Edge E2E locally.
4. Use local contract/regression/build/diff checks.
5. Use GitHub Actions as the authoritative Playwright browser gate.
6. If GitHub E2E fails, diagnose the actual CI failure from the logs.
7. Preserve the established workflow:
   - small sprints;
   - complete replacement files;
   - downloadable installer ZIPs with safety checks;
   - commands may be provided directly in chat;
   - long command output should be redirected to a file and uploaded.

---

## 8. Repository location

Recommended repository path for this file:

```text
docs/development/PLAYWRIGHT_CORPORATE_MACHINE_E2E_RULE.md
```

This document should remain in the repository so that future development sessions can recover this constraint without relying on chat history.
