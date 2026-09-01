import { expect, test } from "@playwright/test";

test("core Explorer navigation is available", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Explore reference data. Understand the source.", level: 1 }),
  ).toBeVisible();

  const scope = page.getByRole("combobox", { name: "Active RDL search scope" });
  await expect(scope).toHaveValue("all");
  await scope.selectOption("cfihos");
  await expect(scope).toHaveValue("cfihos");

  await page.getByRole("button", { name: /Information/i }).click();
  await page.getByRole("link", { name: "Document Types", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Document Types", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: /Help/i }).click();
  await page.getByRole("link", { name: "About RDL Explorer", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);

  await page.getByRole("link", { name: "User Guide", exact: true }).click();
  await expect(page).toHaveURL(/\/help$/);
});

test("legacy document requirement traceability converges to canonical generic detail", async ({ page }) => {
  await page.goto("/documents/CFIHOS-70000007");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/document_type\/CFIHOS-70000007$/);
  await expect(page.getByRole("heading", { name: "Required by Classes", level: 2 })).toBeVisible();
  await expect(page.locator("#rdl-required-by-classes .rdl-detail-relationship-card").first()).toBeVisible();
});

test("CIS Builder exposes the authoring workflow", async ({ page }) => {
  await page.goto("/cis");
  await expect(page.getByRole("heading", { name: "Contract Information Specification Builder" })).toBeVisible();
  await expect(page.getByLabel("Working CIS controls")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project & contract" })).toBeVisible();
  await expect(page.getByRole("button", { name: /2 Baseline review/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /3 Overrides/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /4 Export/i })).toBeVisible();
});

test("pilot status, provenance and feedback route are visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pilot", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Active RDL search scope")).toHaveValue("all");
  await expect(page.getByRole("search", { name: "Global RDL search" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Send pilot feedback" })).toHaveAttribute(
    "href",
    /mailto:alessandro@papioconsulting\.eu/,
  );
});


test("global RDL search preserves source and typed identity", async ({ page }) => {
  await page.goto("/");
  const globalSearch = page.getByRole("search", { name: "Global RDL search" });
  await globalSearch.getByRole("searchbox").fill("CFIHOS-30000521");
  await globalSearch.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page.getByText("Tag Class", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Equipment Class", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CFIHOS · 2.0 · reviewed", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Source").selectOption("water-desalination");
  await page.getByLabel("Global RDL search query").fill("water");
  await page.getByRole("button", { name: "Search", exact: true }).last().click();
  await expect(page.getByText("Water / Desalination · 2.0 candidate · candidate", { exact: true }).first()).toBeVisible();
});

test("cross-RDL intelligence keeps derived matches governed", async ({ page }) => {
  await page.goto("/intelligence?left=cfihos&right=water-desalination&type=unit_of_measure");
  await expect(page.getByRole("heading", { name: "Compare RDLs" })).toBeVisible();
  await expect(page.getByText("Governance boundary")).toBeVisible();
  await expect(page.getByText("possible match", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("exact name rule", { exact: false }).first()).toBeVisible();
});

test("mapping governance queue keeps review writes server-governed", async ({ page }) => {
  await page.goto("/governance");
  await expect(page.getByRole("heading", { name: "Mapping review queue" })).toBeVisible();
  await expect(page.getByText("Authenticated governance service boundary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" }).first()).toBeDisabled();
  await expect(page.getByText("Read-only mode")).toBeVisible();
});

test("authenticated mapping reviewer can submit a governed decision through the service boundary", async ({ page }) => {
  await page.route("**/api/governance/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, reviewer: "reviewer@example.test", roles: ["rdl-mapping-reviewer"], authenticatedAt: new Date().toISOString() }) });
  });
  await page.route("**/api/governance/queue?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reviewer: "reviewer@example.test", status: "candidate", items: [{
      mappingId: 42, status: "candidate", reviewVersion: 3, mappingType: "possible_match", provenanceMethod: "exact_name_rule", confidence: 0.85,
      sourceKey: "cfihos", sourceEntityType: "unit_of_measure", sourceNativeIdentifier: "CFIHOS-60000001", sourceName: "metre",
      targetKey: "water-desalination", targetEntityType: "unit_of_measure", targetNativeIdentifier: "WD-UOM-M", targetName: "metre"
    }] }) });
  });
  let reviewBody: any;
  await page.route("**/api/governance/review", async (route) => {
    reviewBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reviewer: "reviewer@example.test", result: { mapping_id: 42, status: "approved", review_version: 4 } }) });
  });

  await page.goto("/governance");
  await expect(page.getByText("Authenticated reviewer")).toBeVisible();
  const approve = page.getByRole("button", { name: "Approve" }).first();
  await expect(approve).toBeEnabled();
  await approve.click();
  await page.getByLabel("Rationale").fill("Reviewed against the engineering definition and accepted as the governed mapping.");
  await page.getByRole("button", { name: "Record governed decision" }).click();
  await expect.poll(() => reviewBody).toBeTruthy();
  expect(reviewBody).toMatchObject({ mappingId: 42, action: "approve", expectedVersion: 3 });
  expect(reviewBody).not.toHaveProperty("reviewer");
});



test("enterprise RDL hierarchy preserves immutable upstream and project pinning semantics", async ({ page }) => {
  await page.goto("/hierarchy");
  await expect(page.getByRole("heading", { name: "RDL hierarchy & effective context" })).toBeVisible();
  await expect(page.getByText("Governance boundary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Industry RDL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Company RDL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asset RDL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project / CIS RDL" })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="hierarchy-heading"]').getByText(/does not auto-migrate/i)).toBeVisible();
});


test("enterprise extension authoring remains governed and previewable", async ({ page }) => {
  await page.goto("/extensions");
  await expect(page.getByRole("heading", { name: "Extension authoring & governance" })).toBeVisible();
  await expect(page.getByText("Governed authoring boundary")).toBeVisible();
  await expect(page.getByText("Read-only demonstration mode")).toBeVisible();
  await expect(page.getByRole("button", { name: "New extension" })).toBeDisabled();
  await expect(page.getByText("Vacuum toilet")).toBeVisible();
  await page.getByRole("button", { name: "Effective preview" }).first().click();
  await expect(page.getByRole("heading", { name: "Effective preview" })).toBeVisible();
  await expect(page.getByText(/inherited upstream package remains unchanged/i)).toBeVisible();
});


test("effective standard publication remains fail-closed and comparison is inspectable", async ({ page }) => {
  await page.goto("/publication");
  await expect(page.getByRole("heading", { name: "Effective standard comparison & publication" })).toBeVisible();
  await expect(page.getByText("Publication boundary")).toBeVisible();
  await expect(page.getByText("Read-only demonstration mode")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Change impact" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parent vs proposed effective standard" })).toBeVisible();
  await expect(page.getByText("Vacuum toilet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish immutable package" })).toBeDisabled();
});


test("published package distribution remains fail-closed and release pinning is explicit", async ({ page }) => {
  await page.goto("/distribution");
  await expect(page.getByRole("heading", { name: "Published package distribution & consumption" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consumption boundary" })).toBeVisible();
  await expect(page.getByText("Read-only distribution demonstration", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published release catalogue" })).toBeVisible();
  await expect(page.getByText("project-alpha-effective · 1.0.0", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deprecation and supersession" })).toBeVisible();
  await expect(page.getByText(/Consumers pin a release identifier/i)).toBeVisible();
});

test("consumer integration remains fail-closed and activation is explicit", async ({ page }) => {
  await page.goto("/integration");
  await expect(page.getByRole("heading", { name: "Consumer integration & change notification" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notify, pull, stage, activate" })).toBeVisible();
  await expect(page.getByText("Read-only integration demonstration", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Release inbox" })).toBeVisible();
  await expect(page.getByText("project-alpha-effective · 1.1.0", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stage package" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Activate release" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Idempotent pull contract" })).toBeVisible();
});

test("release impact analysis remains advisory and explains breaking changes", async ({ page }) => {
  await page.goto("/impact");
  await expect(page.getByRole("heading", { name: "Release change intelligence & impact analysis" })).toBeVisible();
  await expect(page.getByText("Read-only impact demonstration", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Semantic release delta" })).toBeVisible();
  await expect(page.getByText("Potentially breaking", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Breaking", exact: true }).click();
  await expect(page.getByRole("button", { name: "Breaking", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Migration decision support" })).toBeVisible();
});



test("migration planning remains fail-closed and activation stays explicit", async ({ page }) => {
  await page.goto("/migration");
  await expect(page.getByRole("heading", { name: "Migration planning & controlled adoption" })).toBeVisible();
  await expect(page.getByText("Read-only migration demonstration", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Impacted entity checklist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approval gate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve migration plan" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Stage target release" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Explicit activation only" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate target release" })).toBeDisabled();
  await expect(page.getByText(/draft → in review → approved → staged → activated/i)).toBeVisible();
});

test("enterprise standards control tower is fail-closed and drills through to governed workflows", async ({ page }) => {
  await page.goto("/control-tower");
  await expect(page.getByRole("heading", { name: "Enterprise standards dashboard & control tower" })).toBeVisible();
  await expect(page.getByText("Read-only control tower demonstration", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Portfolio health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Governance & adoption queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published release health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Migration readiness" })).toBeVisible();
  const queue = page.getByRole("table", { name: "Enterprise standards governance and adoption queue" });
  await expect(queue.getByRole("link", { name: "Open workflow" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control tower principles" })).toBeVisible();
});

test("enterprise work queue is fail-closed and preserves governed workflow ownership", async ({ page }) => {
  await page.goto("/work-queue");
  await expect(page.getByRole("heading", { name: "Enterprise notifications & work queue" })).toBeVisible();
  await expect(page.getByText("Read-only work queue demonstration", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My workload" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reviewer inbox" })).toBeVisible();
  const queue = page.getByRole("table", { name: "Enterprise standards reviewer work queue" });
  await expect(queue.getByRole("link", { name: "Open governed workflow" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operational workflow" })).toBeVisible();
  await expect(page.getByText(/never auto-approve/i).first()).toBeVisible();
});

test("AI standards intelligence is fail-closed and evidence-backed", async ({ page }) => {
  await page.goto("/ai-intelligence");
  await expect(page.getByRole("heading", { name: "AI Standards Intelligence" })).toBeVisible();
  await expect(page.getByText("Read-only demonstration mode", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Governance guardrails" })).toBeVisible();
  await expect(page.getByText(/cannot approve extensions/i)).toBeVisible();
});

test("AI trust and evaluation is fail-closed and measurable", async ({ page }) => {
  await page.goto("/ai-trust");
  await expect(page.getByRole("heading", { name: "AI trust & evaluation" })).toBeVisible();
  await expect(page.getByText("Read-only trust demonstration", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trust metrics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluation regression" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trust-control principles" })).toBeVisible();
  await expect(page.getByText(/No automatic promotion/i)).toBeVisible();
});


test("tenant administration is fail-closed and exposes explicit isolation boundaries", async ({ page }) => {
  await page.goto("/tenant-admin");
  await expect(page.getByRole("heading", { name: "Organization isolation & configuration" })).toBeVisible();
  await expect(page.getByText("Read-only tenant demonstration", { exact: true })).toBeVisible();
  await expect(page.getByText("Cross-tenant access is denied, not filtered after retrieval.", { exact: false })).toBeVisible();
  await expect(page.getByRole("table", { name: "Organization member directory" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Tenant-bound private resources" })).toBeVisible();
});

test("enterprise identity administration is fail-closed and separates authentication from privilege", async ({ page }) => {
  await page.goto("/identity-admin");
  await expect(page.getByRole("heading", { name: "Identity & access administration" })).toBeVisible();
  await expect(page.getByText("Read-only identity demonstration", { exact: true })).toBeVisible();
  await expect(page.getByText("No automatic privilege promotion.", { exact: false })).toBeVisible();
  await expect(page.getByRole("table", { name: "Enterprise identity directory" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Enterprise group to role mappings" })).toBeVisible();
});

test("legacy CFIHOS Tag Class detail route converges to generic detail", async ({ page }) => {
  await page.goto("/classes/tag/CFIHOS-30000521");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/tag_class\/CFIHOS-30000521$/);

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole("link", { name: "Properties", exact: true })).toHaveAttribute(
    "href",
    "#rdl-properties",
  );

  // RDL-032.3C: no empty optional relationship section.
  // CFIHOS-30000521 has no Tag / Model_Part row in "document required per class".
  await expect(contents.getByRole("link", { name: "Required Documents", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Required Documents", level: 2 })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Related Equipment Classes", level: 2 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Information Requirements", level: 2 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Source Standards", level: 2 })).toHaveCount(1);

  const propertyCards = page.locator("#rdl-properties .rdl-detail-relationship-card");
  await expect(propertyCards).toHaveCount(5);
  const showAllProperties = page.getByRole("button", { name: /Show all \d+ properties/i });
  await expect(showAllProperties).toBeVisible();
  await expect(showAllProperties).toHaveAttribute("aria-controls", "rdl-properties-list");
  await showAllProperties.click();
  await expect(page.getByRole("button", { name: "Show less", exact: true }).first()).toBeVisible();
  expect(await propertyCards.count()).toBeGreaterThan(10);

  // RDL-032.3C: authoritative Tag requirements remain visible when they exist.
  await page.goto("/classes/tag/CFIHOS-30000912");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/tag_class\/CFIHOS-30000912$/);
  const requiredContents = page.getByRole("navigation", { name: "On this page" });
  await expect(requiredContents.getByRole("link", { name: "Required Documents", exact: true })).toHaveAttribute(
    "href",
    "#rdl-required-documents",
  );
  await expect(page.getByRole("heading", { name: "Required Documents", level: 2 })).toHaveCount(1);
  await expect(page.locator("#rdl-required-documents .rdl-detail-relationship-card")).toHaveCount(5);
});
test("legacy CFIHOS Document Type detail route converges to generic detail", async ({ page }) => {
  await page.goto("/documents/CFIHOS-70000007");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/document_type\/CFIHOS-70000007$/);

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole("link", { name: "Discipline Requirements", exact: true })).toHaveAttribute(
    "href",
    "#rdl-disciplines",
  );
  await expect(contents.getByRole("link", { name: "Required by Classes", exact: true })).toHaveAttribute(
    "href",
    "#rdl-required-by-classes",
  );
  await expect(page.locator("#rdl-disciplines .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-required-by-classes .rdl-detail-relationship-card").first()).toBeVisible();
});

test("legacy CFIHOS Property detail route converges to generic detail and disclosure", async ({ page }) => {
  await page.goto("/dictionary/CFIHOS-40000509");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/property\/CFIHOS-40000509$/);

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents.getByRole("link", { name: "Units of Measure", exact: true })).toHaveAttribute(
    "href",
    "#rdl-units-of-measure",
  );
  await expect(contents.getByRole("link", { name: "Used by Classes", exact: true })).toHaveAttribute(
    "href",
    "#rdl-used-by-classes",
  );
  await expect(page.locator("#rdl-units-of-measure .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-used-by-classes .rdl-detail-relationship-card").first()).toBeVisible();

  await page.goto("/dictionary/CFIHOS-40000132");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/property\/CFIHOS-40000132$/);
  const allowedValuesContents = page.getByRole("navigation", { name: "On this page" });
  await expect(allowedValuesContents.getByRole("link", { name: "Allowed Values", exact: true })).toHaveAttribute(
    "href",
    "#rdl-allowed-values",
  );

  const valueCards = page.locator("#rdl-allowed-values .rdl-detail-relationship-card");
  await expect(valueCards).toHaveCount(5);
  const showAllValues = page.getByRole("button", { name: /Show all \d+ allowed values/i });
  await expect(showAllValues).toHaveAttribute("aria-expanded", "false");
  await expect(showAllValues).toHaveAttribute("aria-controls", "rdl-allowed-values-list");
  await showAllValues.click();
  expect(await valueCards.count()).toBeGreaterThan(10);
});

test("legacy CFIHOS Source Standard detail route converges to generic provenance", async ({ page }) => {
  await page.goto("/standards/CFIHOS-90000061");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/source_standard\/CFIHOS-90000061$/);

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents.getByRole("link", { name: "Classes", exact: true })).toHaveAttribute(
    "href",
    "#rdl-used-by-classes",
  );
  await expect(contents.getByRole("link", { name: "Property Mappings", exact: true })).toHaveAttribute(
    "href",
    "#rdl-property-mappings",
  );
  await expect(contents.getByRole("link", { name: "Picklist Values", exact: true })).toHaveAttribute(
    "href",
    "#rdl-picklist-values",
  );

  await expect(page.locator("#rdl-used-by-classes .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-property-mappings .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-picklist-values .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Information Requirements", level: 2 })).toBeVisible();
});

test("legacy CFIHOS Discipline detail route converges to generic Document Types", async ({ page }) => {
  await page.goto("/disciplines/CFIHOS-20000015");
  await expect(page).toHaveURL(/\/rdl\/cfihos\/cfihos-2\.0\/discipline\/CFIHOS-20000015$/);

  await expect(page.getByRole("heading", { name: "Document Types", level: 2 })).toHaveCount(1);
  const cards = page.locator("#rdl-document-types .rdl-detail-relationship-card");
  await expect(cards).toHaveCount(5);

  const showAll = page.getByRole("button", { name: /Show all \d+ document types/i });
  await expect(showAll).toBeVisible();
  await expect(showAll).toHaveAttribute("aria-expanded", "false");
  await expect(showAll).toHaveAttribute("aria-controls", "rdl-document-types-list");

  await showAll.click();
  await expect(page.getByRole("button", { name: "Show less", exact: true })).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(10);
});

test("RDL scope switch never falls back to CFIHOS content", async ({ page }) => {
  await page.goto("/classes/tag");
  const selector = page.getByRole("combobox", { name: "Active RDL search scope" });

  await selector.selectOption("water-desalination");
  let browse = page.locator(".rdl-release-browse");
  await expect(browse).toBeVisible();
  await expect(browse).toHaveAttribute("data-source-key", "water-desalination");
  await expect(browse).toHaveAttribute("data-release-key", "water-desalination-2.0-candidate");
  let search = browse.getByRole("searchbox", { name: "Search tag classes" });
  await search.fill("WATERRDL-31000001");
  await expect(browse.getByText("WATERRDL-31000001", { exact: true })).toBeVisible();
  await expect(page.getByText(/CFIHOS-30000001/)).toHaveCount(0);

  await selector.selectOption("ccus");
  browse = page.locator(".rdl-release-browse");
  await expect(browse).toHaveAttribute("data-source-key", "ccus");
  await expect(browse).toHaveAttribute("data-release-key", "ccus-2.0-candidate");
  search = browse.getByRole("searchbox", { name: "Search tag classes" });
  await search.fill("CCUSRDL-31000001");
  await expect(browse.getByText("CCUSRDL-31000001", { exact: true })).toBeVisible();
  await expect(page.getByText(/WATERRDL-31000001/)).toHaveCount(0);
});

test("enterprise workflow pages are truthful all-RDL views", async ({ page }) => {
  await page.goto("/migration");
  const enterpriseView = page.getByRole("combobox", { name: "Enterprise workflow RDL view" });
  await expect(enterpriseView).toHaveValue("all");
  await expect(enterpriseView).toBeDisabled();
  await expect(page.getByText("RDL VIEW", { exact: true })).toBeVisible();
});

test("sidebar keeps the active section open and permits inactive sections to collapse", async ({ page }) => {
  await page.goto("/control-tower");
  const operate = page.getByRole("button", { name: /Operate/i });
  await expect(operate).toHaveAttribute("aria-expanded", "true");

  // The active route keeps its section visible even when the persisted expansion is toggled off.
  await operate.click();
  await expect(operate).toHaveAttribute("aria-expanded", "true");

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Operate/i })).toHaveAttribute("aria-expanded", "false");

  await page.goto("/work-queue");
  await expect(page.getByRole("button", { name: /Operate/i })).toHaveAttribute("aria-expanded", "true");
});

test("RDL releases remain isolated and version selectable", async ({ page }) => {
  await page.goto("/search?source=water-desalination&release=water-desalination-0.1-draft&q=WATERRDL-31000012");
  await expect(page.getByRole("heading", { name: "RO", exact: true })).toBeVisible();
  const release = page.getByLabel("Release", { exact: true });
  await expect(release).toHaveValue("water-desalination-0.1-draft");

  await release.selectOption("water-desalination-2.0-candidate");
  await expect(page.getByRole("heading", { name: "reverse-osmosis system tag", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "RO", exact: true })).toHaveCount(0);

  await page.getByRole("heading", { name: "reverse-osmosis system tag", exact: true }).click();
  await expect(page).toHaveURL(/\/rdl\/water-desalination\/water-desalination-2\.0-candidate\/tag_class\/WATERRDL-31000012/);
  await expect(
    page.getByLabel("Release", { exact: true }).locator("option:checked"),
  ).toHaveText("2.0 candidate · candidate");
});
