import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const scope of [
  { source: "water-desalination", id: "WATERRDL-31000001", routeSource: "water-desalination" },
  { source: "ccus", id: "CCUSRDL-31000001", routeSource: "ccus" },
]) {
  test(`${scope.source} Tag Classes use the shared browse navigation paradigm`, async ({ page }) => {
    await page.goto("/classes/tag");
    const selector = page.getByRole("combobox", { name: "Active RDL search scope" });
    await selector.selectOption(scope.source);

    const browse = page.locator(".rdl-release-browse");
    await expect(browse).toBeVisible();
    await expect(browse.getByRole("heading", { name: "Tag Classes", level: 1 })).toBeVisible();
    const search = browse.getByRole("searchbox", { name: "Search tag classes" });
    await expect(search).toBeVisible();
    await search.fill(scope.id);
    await expect(browse.getByText(scope.id, { exact: true })).toBeVisible();
    await browse.getByText(scope.id, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/rdl/${scope.routeSource}/[^/]+/tag_class/${scope.id}$`));
  });
}

test("Water Tag Class shared browse shell has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/classes/tag");
  await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption("water-desalination");
  await expect(page.locator(".rdl-release-browse")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});
