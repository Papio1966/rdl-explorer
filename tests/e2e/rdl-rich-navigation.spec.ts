import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type RelationshipRow = {
  sourceKey: string;
  releaseKey: string;
  relationshipType: string;
  sourceEntityType: string;
  sourceNativeIdentifier: string;
};

async function relationshipAnchor(page: Page, sourceKey: string, releaseKey: string, relationshipType: string, minimumCount = 1) {
  return page.evaluate(async ({ sourceKey, releaseKey, relationshipType, minimumCount }) => {
    const rows = await fetch("/rdl-relationship-index.json").then((response) => response.json()) as RelationshipRow[];
    const groups = new Map<string, { sourceEntityType:string; sourceNativeIdentifier:string; count:number }>();
    for (const row of rows) {
      if (row.sourceKey !== sourceKey || row.releaseKey !== releaseKey || row.relationshipType !== relationshipType) continue;
      const key = `${row.sourceEntityType}|${row.sourceNativeIdentifier}`;
      const current = groups.get(key) ?? { sourceEntityType: row.sourceEntityType, sourceNativeIdentifier: row.sourceNativeIdentifier, count: 0 };
      current.count += 1;
      groups.set(key, current);
    }
    return [...groups.values()].sort((a,b)=>b.count-a.count).find((item)=>item.count >= minimumCount) ?? null;
  }, { sourceKey, releaseKey, relationshipType, minimumCount });
}

test("generic rich RDL detail preserves explicit release context", async ({ page }) => {
  await page.goto("/");
  const anchor = await relationshipAnchor(page, "water-desalination", "water-desalination-2.0-candidate", "class_property");
  expect(anchor).not.toBeNull();
  if (!anchor) return;

  await page.goto(`/rdl/water-desalination/water-desalination-2.0-candidate/${anchor.sourceEntityType}/${anchor.sourceNativeIdentifier}`);
  await expect(page.locator(".rdl-entity-source").getByText("2.0 candidate · candidate", { exact: true })).toBeVisible();

  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole("link", { name: "Definition", exact: true })).toHaveAttribute("href", "#rdl-definition");
  await expect(contents.getByRole("link", { name: "Properties", exact: true })).toHaveAttribute("href", "#rdl-properties");
  await expect(contents.getByRole("link", { name: "Provenance", exact: true })).toHaveAttribute("href", "#rdl-provenance");

  const hrefs = await page.locator("#rdl-properties a").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.every((href) => href.startsWith("/rdl/water-desalination/water-desalination-2.0-candidate/property/"))).toBeTruthy();
});

test("generic rich detail progressively discloses long relationship lists", async ({ page }) => {
  await page.goto("/");
  const anchor = await relationshipAnchor(page, "cfihos", "cfihos-2.0", "class_property", 11);
  expect(anchor).not.toBeNull();
  if (!anchor) return;

  await page.goto(`/rdl/cfihos/cfihos-2.0/${anchor.sourceEntityType}/${anchor.sourceNativeIdentifier}`);
  const propertyCards = page.locator("#rdl-properties .rdl-detail-relationship-card");
  await expect(propertyCards).toHaveCount(5);
  const showAll = page.getByRole("button", { name: /Show all \d+ properties/i });
  await expect(showAll).toHaveAttribute("aria-expanded", "false");
  await showAll.click();
  expect(await propertyCards.count()).toBeGreaterThan(10);
  await expect(page.getByRole("button", { name: "Show less", exact: true })).toBeVisible();
});

test("CCUS rich detail exposes source-native document relationships", async ({ page }) => {
  await page.goto("/");
  const anchor = await relationshipAnchor(page, "ccus", "ccus-2.0-candidate", "class_document");
  expect(anchor).not.toBeNull();
  if (!anchor) return;

  await page.goto(`/rdl/ccus/ccus-2.0-candidate/${anchor.sourceEntityType}/${anchor.sourceNativeIdentifier}`);
  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents.getByRole("link", { name: "Required Documents", exact: true })).toHaveAttribute("href", "#rdl-required-documents");
  await expect(page.locator("#rdl-required-documents .rdl-detail-relationship-card").first()).toBeVisible();
  const href = await page.locator("#rdl-required-documents a").first().getAttribute("href");
  expect(href).toMatch(/^\/rdl\/ccus\/ccus-2\.0-candidate\/document_type\//);
});

test("generic rich RDL detail has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const anchor = await relationshipAnchor(page, "water-desalination", "water-desalination-2.0-candidate", "class_property");
  expect(anchor).not.toBeNull();
  if (!anchor) return;
  await page.goto(`/rdl/water-desalination/water-desalination-2.0-candidate/${anchor.sourceEntityType}/${anchor.sourceNativeIdentifier}`);
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious).toEqual([]);
});
