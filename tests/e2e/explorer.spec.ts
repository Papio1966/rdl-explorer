import { expect, test } from "@playwright/test";

test("core Explorer navigation is available", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Explore reference data. Understand the source.", level: 1 }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Document Types", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Document Types", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "About RDL Explorer" }).click();
  await expect(page).toHaveURL(/\/about$/);

  await page.getByRole("link", { name: "User Guide", exact: true }).click();
  await expect(page).toHaveURL(/\/help$/);
});

test("document requirement traceability renders as a table", async ({ page }) => {
  await page.goto("/documents/CFIHOS-70000007");
  await expect(page.getByRole("heading", { name: "Required by Classes" })).toBeVisible();
  const table = page.locator(".document-class-requirement-table");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr").first()).toBeVisible();
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
  await expect(page.getByText("CFIHOS · 2.0", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Source").selectOption("water-desalination");
  await page.getByLabel("Global RDL search query").fill("water");
  await page.getByRole("button", { name: "Search", exact: true }).last().click();
  await expect(page.getByText(/Water \/ Desalination · 0.1 draft/).first()).toBeVisible();
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

test("class detail pages provide contents navigation and progressive disclosure", async ({ page }) => {
  await page.goto("/classes/tag/CFIHOS-30000521");

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole("link", { name: "Properties", exact: true })).toHaveAttribute(
    "href",
    "#tag-properties",
  );
  await expect(contents.getByRole("link", { name: "Required Documents", exact: true })).toHaveAttribute(
    "href",
    "#tag-required-documents",
  );

  await expect(
    page.getByRole("heading", { name: "Related Equipment Classes", level: 2 }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Required Documents", level: 2 }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "JIP33 Information Requirements", level: 2 }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Source Standards", level: 2 }),
  ).toHaveCount(1);

  const propertyRows = page.locator("#tag-properties-list tbody tr");
  await expect(propertyRows).toHaveCount(5);

  const showAllProperties = page.getByRole("button", { name: /Show all \d+ properties/i });
  await expect(showAllProperties).toBeVisible();
  await showAllProperties.click();
  await expect(page.getByRole("button", { name: "Show less", exact: true }).first()).toBeVisible();
  expect(await propertyRows.count()).toBeGreaterThan(10);
});


test("document detail pages provide contents navigation", async ({ page }) => {
  await page.goto("/documents/CFIHOS-70000007");

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(
    contents.getByRole("link", { name: "Discipline requirements", exact: true }),
  ).toHaveAttribute("href", "#document-discipline-requirements");
  await expect(
    contents.getByRole("link", { name: "Required by Classes", exact: true }),
  ).toHaveAttribute("href", "#document-required-by-classes");

  await expect(
    page.getByRole("heading", { name: "Discipline requirements", level: 2 }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Required by Classes", level: 2 }),
  ).toHaveCount(1);
});

test("property detail pages provide contents navigation and progressive disclosure", async ({ page }) => {
  await page.goto("/dictionary/CFIHOS-40000509");

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(
    contents.getByRole("link", { name: "Units of Measure", exact: true }),
  ).toHaveAttribute("href", "#dictionary-units");
  await expect(
    contents.getByRole("link", { name: "Used by Tag Classes", exact: true }),
  ).toHaveAttribute("href", "#dictionary-tag-classes");

  await expect(
    page.getByRole("heading", { name: "Units of Measure", level: 2 }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Used by Tag Classes", level: 2 }),
  ).toHaveCount(1);

  const unitCards = page.locator("#dictionary-units-list .dictionary-unit-card");
  await expect(unitCards).toHaveCount(5);
  const showAllUnits = page.getByRole("button", { name: /Show all \d+ units/i });
  await expect(showAllUnits).toBeVisible();
  await showAllUnits.click();
  expect(await unitCards.count()).toBeGreaterThan(10);

  const classCards = page.locator("#dictionary-tag-classes-list .dictionary-class-card");
  await expect(classCards).toHaveCount(5);
  const showAllClasses = page.getByRole("button", { name: /Show all \d+ Tag Classes/i });
  await expect(showAllClasses).toBeVisible();
  await showAllClasses.click();
  expect(await classCards.count()).toBeGreaterThan(10);

  await page.goto("/dictionary/CFIHOS-40000132");
  const picklistContents = page.getByRole("navigation", { name: "On this page" });
  await expect(
    picklistContents.getByRole("link", { name: "Allowed Values", exact: true }),
  ).toHaveAttribute("href", "#dictionary-picklist-values");

  const picklistRows = page.locator("#dictionary-picklist-values-list tbody tr");
  await expect(picklistRows).toHaveCount(5);
  const showAllValues = page.getByRole("button", { name: /Show all \d+ values/i });
  await expect(showAllValues).toBeVisible();
  await showAllValues.click();
  expect(await picklistRows.count()).toBeGreaterThan(10);
});

test("Source Standard detail pages provide contents navigation and progressive disclosure", async ({ page }) => {
  await page.goto("/standards/CFIHOS-90000061");

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole("link", { name: "Classes", exact: true })).toHaveAttribute(
    "href",
    "#source-standard-classes",
  );
  await expect(
    contents.getByRole("link", { name: "Property mappings", exact: true }),
  ).toHaveAttribute("href", "#source-standard-properties");
  await expect(
    contents.getByRole("link", { name: "Picklist values", exact: true }),
  ).toHaveAttribute("href", "#source-standard-picklist-values");

  await expect(page.getByRole("heading", { name: "Classes", level: 2 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "JIP33 Information Requirements", level: 2 }),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Property mappings", level: 2 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Picklist values", level: 2 })).toHaveCount(1);

  const propertyRows = page.locator("#source-standard-properties-list tbody tr");
  await expect(propertyRows).toHaveCount(5);
  const showAllProperties = page.getByRole("button", { name: /Show all \d+ property mappings/i });
  await expect(showAllProperties).toBeVisible();
  await showAllProperties.click();
  expect(await propertyRows.count()).toBeGreaterThan(10);

  const picklistRows = page.locator("#source-standard-picklist-values-list tbody tr");
  await expect(picklistRows).toHaveCount(5);
  const showAllPicklistValues = page.getByRole("button", { name: /Show all \d+ picklist values/i });
  await expect(showAllPicklistValues).toBeVisible();

  const jip33Rows = page.locator("#source-standard-jip33-list .source-standard-jip33-row");
  await expect(jip33Rows).toHaveCount(5);
  const showAllJip33 = page.getByRole("button", { name: /Show all \d+ JIP33 mappings/i });
  await expect(showAllJip33).toBeVisible();
});


test("Discipline detail pages progressively disclose long Document Type relationships", async ({ page }) => {
  await page.goto("/disciplines/CFIHOS-20000015");

  await expect(
    page.getByRole("heading", { name: "Document Types", level: 2 }),
  ).toHaveCount(1);

  const rows = page.locator("#discipline-document-types-list tbody tr");
  await expect(rows).toHaveCount(5);

  const showAll = page.getByRole("button", { name: /Show all \d+ Document Types/i });
  await expect(showAll).toBeVisible();
  await expect(showAll).toHaveAttribute("aria-expanded", "false");

  await showAll.click();
  await expect(page.getByRole("button", { name: "Show less", exact: true })).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(10);

  await page.getByRole("button", { name: "Show less", exact: true }).click();
  await expect(rows).toHaveCount(5);
});
