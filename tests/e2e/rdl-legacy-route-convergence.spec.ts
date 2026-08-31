import { expect, test } from "@playwright/test";

const legacyRedirects = [
  ["/classes/tag/CFIHOS-30000521", "/rdl/cfihos/cfihos-2.0/tag_class/CFIHOS-30000521"],
  ["/classes/equipment/CFIHOS-30000395", "/rdl/cfihos/cfihos-2.0/equipment_class/CFIHOS-30000395"],
  ["/documents/CFIHOS-70000007", "/rdl/cfihos/cfihos-2.0/document_type/CFIHOS-70000007"],
  ["/disciplines/CFIHOS-20000015", "/rdl/cfihos/cfihos-2.0/discipline/CFIHOS-20000015"],
  ["/dictionary/CFIHOS-40000509", "/rdl/cfihos/cfihos-2.0/property/CFIHOS-40000509"],
  ["/standards/CFIHOS-90000061", "/rdl/cfihos/cfihos-2.0/source_standard/CFIHOS-90000061"],
  ["/units/CFIHOS-60000001", "/rdl/cfihos/cfihos-2.0/unit_of_measure/CFIHOS-60000001"],
] as const;

test("legacy CFIHOS detail routes converge to explicit CFIHOS 2.0 canonical routes", async ({ page }) => {
  for (const [legacy, canonical] of legacyRedirects) {
    await page.goto(legacy);
    await expect.poll(() => new URL(page.url()).pathname).toBe(canonical);
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
    await expect(page.getByText("Release-isolated rich detail", { exact: true })).toBeVisible();
  }
});

test("legacy convergence preserves query-string browse context", async ({ page }) => {
  await page.goto("/classes/tag/CFIHOS-30000521?from=legacy&view=compact");
  await expect.poll(() => {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  }).toBe("/rdl/cfihos/cfihos-2.0/tag_class/CFIHOS-30000521?from=legacy&view=compact");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
