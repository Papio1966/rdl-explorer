import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("generic CFIHOS property detail reaches unit and controlled-value parity", async ({ page }) => {
  await page.goto("/rdl/cfihos/cfihos-2.0/property/CFIHOS-40000509");
  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents.getByRole("link", { name: "Units of Measure", exact: true })).toHaveAttribute("href", "#rdl-units-of-measure");
  await expect(contents.getByRole("link", { name: "Used by Classes", exact: true })).toHaveAttribute("href", "#rdl-used-by-classes");
  await expect(page.locator("#rdl-units-of-measure .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-used-by-classes .rdl-detail-relationship-card").first()).toBeVisible();

  await page.goto("/rdl/cfihos/cfihos-2.0/property/CFIHOS-40000132");
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Allowed Values", exact: true })).toHaveAttribute("href", "#rdl-allowed-values");
  const values = page.locator("#rdl-allowed-values .rdl-detail-relationship-card");
  await expect(values).toHaveCount(5);
  const showAll = page.getByRole("button", { name: /Show all \d+ allowed values/i });
  await expect(showAll).toHaveAttribute("aria-expanded", "false");
  await expect(showAll).toHaveAttribute("aria-controls", "rdl-allowed-values-list");
  await showAll.click();
  expect(await values.count()).toBeGreaterThan(10);
});

test("generic CFIHOS document and discipline detail are bidirectionally navigable", async ({ page }) => {
  await page.goto("/rdl/cfihos/cfihos-2.0/document_type/CFIHOS-70000007");
  const documentContents = page.getByRole("navigation", { name: "On this page" });
  await expect(documentContents.getByRole("link", { name: "Discipline Requirements", exact: true })).toHaveAttribute("href", "#rdl-disciplines");
  await expect(documentContents.getByRole("link", { name: "Required by Classes", exact: true })).toHaveAttribute("href", "#rdl-required-by-classes");
  await expect(page.locator("#rdl-disciplines .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-required-by-classes .rdl-detail-relationship-card").first()).toBeVisible();

  await page.goto("/rdl/cfihos/cfihos-2.0/discipline/CFIHOS-20000015");
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Document Types", exact: true })).toHaveAttribute("href", "#rdl-document-types");
  const documents = page.locator("#rdl-document-types .rdl-detail-relationship-card");
  await expect(documents).toHaveCount(5);
  await expect(page.getByRole("button", { name: /Show all \d+ document types/i })).toBeVisible();
});

test("generic CFIHOS Source Standard exposes classes property mappings and controlled values", async ({ page }) => {
  await page.goto("/rdl/cfihos/cfihos-2.0/source_standard/CFIHOS-90000061");
  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents.getByRole("link", { name: "Classes", exact: true })).toHaveAttribute("href", "#rdl-used-by-classes");
  await expect(contents.getByRole("link", { name: "Property Mappings", exact: true })).toHaveAttribute("href", "#rdl-property-mappings");
  await expect(contents.getByRole("link", { name: "Picklist Values", exact: true })).toHaveAttribute("href", "#rdl-picklist-values");
  await expect(page.locator("#rdl-property-mappings .rdl-detail-relationship-card").first()).toBeVisible();
  await expect(page.locator("#rdl-picklist-values .rdl-detail-relationship-card").first()).toBeVisible();
});

test("RDL-032 generic parity detail has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/rdl/cfihos/cfihos-2.0/property/CFIHOS-40000132");
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious).toEqual([]);
});
