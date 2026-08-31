import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const sources = [
  { source: "water-desalination", routeSource: "water-desalination", tagId: "WATERRDL-31000001", equipmentId: "WATERRDL-30000001" },
  { source: "ccus", routeSource: "ccus", tagId: "CCUSRDL-31000001", equipmentId: "CCUSRDL-30000001" },
] as const;

const browseTypes = [
  { path: "/classes/tag", title: "Tag Classes", searchName: "Search tag classes", entityType: "tag_class", idField: "tagId" },
  { path: "/classes/equipment", title: "Equipment Classes", searchName: "Search equipment classes", entityType: "equipment_class", idField: "equipmentId" },
] as const;

for (const browseType of browseTypes) {
  for (const scope of sources) {
    test(`${scope.source} ${browseType.title} use the shared browse navigation paradigm`, async ({ page }) => {
      await page.goto(browseType.path);
      const selector = page.getByRole("combobox", { name: "Active RDL search scope" });
      await selector.selectOption(scope.source);

      const browse = page.locator(".rdl-release-browse");
      await expect(browse).toBeVisible();
      await expect(browse).toHaveAttribute("data-source-key", scope.source);
      await expect(browse.getByRole("heading", { name: browseType.title, level: 1 })).toBeVisible();
      const search = browse.getByRole("searchbox", { name: browseType.searchName });
      await expect(search).toBeVisible();
      const nativeIdentifier = scope[browseType.idField];
      await search.fill(nativeIdentifier);
      await expect(browse.getByText(nativeIdentifier, { exact: true })).toBeVisible();
      await browse.getByText(nativeIdentifier, { exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/rdl/${scope.routeSource}/[^/]+/${browseType.entityType}/${nativeIdentifier}$`));
    });
  }
}

test("Water shared class browse shells have no serious or critical accessibility violations", async ({ page }) => {
  for (const browseType of browseTypes) {
    await page.goto(browseType.path);
    await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption("water-desalination");
    await expect(page.locator(".rdl-release-browse")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking, `${browseType.title}: ${blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")}`).toEqual([]);
  }
});
