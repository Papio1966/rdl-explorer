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
  await expect(page.getByText("Governed write boundary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" }).first()).toBeDisabled();
  await expect(page.getByText("Read-only pilot projection").first()).toBeVisible();
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
