import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const sources = [
  {
    source: "water-desalination",
    routeSource: "water-desalination",
    tagId: "WATERRDL-31000001",
    equipmentId: "WATERRDL-30000001",
    documentId: "WATERRDL-70000001",
    propertyId: "WATERRDL-40000001",
  },
  {
    source: "ccus",
    routeSource: "ccus",
    tagId: "CCUSRDL-31000001",
    equipmentId: "CCUSRDL-30000001",
    documentId: "CCUSRDL-70000001",
    propertyId: "CCUSRDL-40000001",
  },
] as const;

const browseTypes = [
  { path: "/classes/tag", title: "Tag Classes", searchName: "Search tag classes", entityType: "tag_class", idField: "tagId", mode: "hierarchy" },
  { path: "/classes/equipment", title: "Equipment Classes", searchName: "Search equipment classes", entityType: "equipment_class", idField: "equipmentId", mode: "hierarchy" },
  { path: "/documents", title: "Document Types", searchName: "Search document types", entityType: "document_type", idField: "documentId", mode: "flat" },
  { path: "/dictionary", title: "Data Dictionary", searchName: "Search properties", entityType: "property", idField: "propertyId", mode: "flat" },
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
      await expect(browse).toHaveAttribute("data-browse-mode", browseType.mode);
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

test("Water shared browse shells have no serious or critical accessibility violations", async ({ page }) => {
  for (const browseType of browseTypes) {
    await page.goto(browseType.path);
    await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption("water-desalination");
    const browse = page.locator(".rdl-release-browse");
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("data-browse-mode", browseType.mode);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking, `${browseType.title}: ${blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")}`).toEqual([]);
  }
});
