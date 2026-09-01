import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type RuntimeBrowseRecord = {
  sourceKey: string;
  releaseKey: string;
  entityType: string;
  nativeIdentifier: string;
  name: string;
  definition?: string;
  aliases?: string[];
  searchText?: string[];
  secondaryLabel?: string;
  tertiaryLabel?: string;
  facets?: Record<string, { value: string; label?: string }>;
};

const sources = [
  {
    source: "cfihos",
    routeSource: "cfihos",
    releaseKey: "cfihos-2.0",
    tagId: "CFIHOS-30000001",
    equipmentId: "CFIHOS-30000001",
    documentId: "CFIHOS-70000004",
    propertyId: "CFIHOS-40000001",
    standardId: "CFIHOS-90000001",
    disciplineId: "CFIHOS-20000007",
    unitId: "CFIHOS-60000001",
  },
  {
    source: "water-desalination",
    routeSource: "water-desalination",
    releaseKey: "water-desalination-2.0-candidate",
    tagId: "WATERRDL-31000001",
    equipmentId: "WATERRDL-30000001",
    documentId: "WATERRDL-70000001",
    propertyId: "WATERRDL-40000001",
    standardId: "WATERRDL-90000001",
    disciplineId: "CFIHOS-20000007",
    unitId: "WATERRDL-60000001",
  },
  {
    source: "ccus",
    routeSource: "ccus",
    releaseKey: "ccus-2.0-candidate",
    tagId: "CCUSRDL-31000001",
    equipmentId: "CCUSRDL-30000001",
    documentId: "CCUSRDL-70000001",
    propertyId: "CCUSRDL-40000001",
    standardId: "CCUSRDL-90000001",
    disciplineId: "CFIHOS-20000007",
    unitId: "CCUSRDL-65000001",
  },
] as const;

const browseTypes = [
  { path: "/classes/tag", title: "Tag Classes", searchName: "Search tag classes", entityType: "tag_class", idField: "tagId", mode: "hierarchy" },
  { path: "/classes/equipment", title: "Equipment Classes", searchName: "Search equipment classes", entityType: "equipment_class", idField: "equipmentId", mode: "hierarchy" },
  { path: "/documents", title: "Document Types", searchName: "Search document types", entityType: "document_type", idField: "documentId", mode: "flat" },
  { path: "/dictionary", title: "Data Dictionary", searchName: "Search properties", entityType: "property", idField: "propertyId", mode: "flat" },
  { path: "/standards", title: "Source Standards", searchName: "Search source standards", entityType: "source_standard", idField: "standardId", mode: "flat" },
  { path: "/disciplines", title: "Disciplines", searchName: "Search disciplines", entityType: "discipline", idField: "disciplineId", mode: "flat" },
  { path: "/units", title: "Units of Measure", searchName: "Search units of measure", entityType: "unit_of_measure", idField: "unitId", mode: "flat" },
] as const;

async function runtimeRecord(page: Page, sourceKey: string, releaseKey: string): Promise<RuntimeBrowseRecord | null> {
  return page.evaluate(async ({ sourceKey: source, releaseKey: release }) => {
    const response = await fetch("/rdl-search-index.json");
    if (!response.ok) throw new Error(`Unable to load runtime search index: ${response.status}`);
    const records = await response.json() as RuntimeBrowseRecord[];
    return records.find((record) =>
      record.sourceKey === source &&
      record.releaseKey === release &&
      record.entityType === "unit_of_measure" &&
      Boolean(record.facets?.dimension?.value) &&
      Boolean(record.secondaryLabel || record.tertiaryLabel || record.searchText?.length || record.aliases?.length),
    ) ?? null;
  }, { sourceKey, releaseKey });
}

async function runtimeMetadataAnchor(
  page: Page,
  entityType: string,
): Promise<{ nativeIdentifier: string; query: string } | null> {
  return page.evaluate(async ({ type }) => {
    const response = await fetch("/rdl-search-index.json");
    if (!response.ok) throw new Error(`Unable to load runtime search index: ${response.status}`);
    const records = await response.json() as RuntimeBrowseRecord[];
    const scoped = records.filter((record) =>
      record.sourceKey === "cfihos" &&
      record.releaseKey === "cfihos-2.0" &&
      record.entityType === type,
    );

    const normalizedCandidates = (record: RuntimeBrowseRecord): string[] => {
      const raw = [
        ...(record.aliases ?? []),
        ...(record.searchText ?? []),
        record.secondaryLabel ?? "",
        record.tertiaryLabel ?? "",
      ];
      return [...new Set(raw
        .flatMap((value) => value.split(" · "))
        .map((value) => value.replace(/^Parent:\s*/i, "").trim())
        .filter((value) => value.length >= 2))];
    };

    for (const record of scoped) {
      const baseline = `${record.nativeIdentifier} ${record.name} ${record.definition ?? ""}`.toLocaleLowerCase();
      const query = normalizedCandidates(record).find((candidate) => !baseline.includes(candidate.toLocaleLowerCase()));
      if (query) return { nativeIdentifier: record.nativeIdentifier, query };
    }
    return null;
  }, { type: entityType });
}

for (const browseType of browseTypes) {
  for (const scope of sources) {
    test(`${scope.source} ${browseType.title} use the shared browse navigation paradigm`, async ({ page }) => {
      await page.goto(browseType.path);
      const selector = page.getByRole("combobox", { name: "Active RDL search scope" });
      await selector.selectOption(scope.source);

      const browse = page.locator(".rdl-release-browse");
      await expect(browse).toBeVisible();
      await expect(browse).toHaveAttribute("data-source-key", scope.source);
      await expect(browse).toHaveAttribute("data-release-key", scope.releaseKey);
      await expect(browse).toHaveAttribute("data-browse-mode", browseType.mode);
      await expect(browse.getByRole("heading", { name: browseType.title, level: 1 })).toBeVisible();
      const search = browse.getByRole("searchbox", { name: browseType.searchName });
      await expect(search).toBeVisible();
      const nativeIdentifier = scope[browseType.idField];
      await search.fill(nativeIdentifier);
      await expect(browse.getByText(nativeIdentifier, { exact: true })).toBeVisible();
      await browse.getByText(nativeIdentifier, { exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/rdl/${scope.routeSource}/${scope.releaseKey}/${browseType.entityType}/${nativeIdentifier}$`));
    });
  }
}

for (const scope of sources) {
  test(`${scope.source} Units of Measure expose source-neutral metadata search and dimension filtering`, async ({ page }) => {
    await page.goto("/units");
    await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption(scope.source);

    const browse = page.locator(".rdl-release-browse");
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("data-release-key", scope.releaseKey);
    await expect(browse).toHaveAttribute("data-browse-mode", "flat");

    const record = await runtimeRecord(page, scope.source, scope.releaseKey);
    expect(record, `${scope.source} must expose at least one Unit metadata/facet record`).not.toBeNull();

    const dimension = record!.facets!.dimension;
    const facet = browse.getByRole("combobox", { name: "Filter Units of Measure by Dimension" });
    await expect(facet).toBeVisible();
    expect(await facet.locator("option").count()).toBeGreaterThan(1);

    await facet.selectOption(dimension.value);
    await expect.poll(() => new URL(page.url()).searchParams.get("dimension")).toBe(dimension.value);
    await expect(browse).not.toHaveAttribute("data-filtered-record-count", "0");

    const query = record!.secondaryLabel?.split(" · ")[0] || record!.tertiaryLabel || record!.searchText?.[0] || record!.aliases?.[0];
    expect(query, `${scope.source} Unit metadata search anchor missing`).toBeTruthy();
    const search = browse.getByRole("searchbox", { name: "Search units of measure" });
    await search.fill(query!);
    await expect(browse.getByText(record!.nativeIdentifier, { exact: true })).toBeVisible();
  });
}

const cfihosMetadataBrowseTypes = browseTypes.filter((item) =>
  ["tag_class", "equipment_class", "document_type", "property", "discipline"].includes(item.entityType),
);

for (const browseType of cfihosMetadataBrowseTypes) {
  test(`CFIHOS metadata search covers ${browseType.title} specialist browse semantics`, async ({ page }) => {
    await page.goto(browseType.path);
    await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption("cfihos");

    const browse = page.locator(".rdl-release-browse");
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("data-source-key", "cfihos");
    await expect(browse).toHaveAttribute("data-release-key", "cfihos-2.0");

    const anchor = await runtimeMetadataAnchor(page, browseType.entityType);
    expect(anchor, `CFIHOS ${browseType.title} metadata search anchor missing`).not.toBeNull();

    const search = browse.getByRole("searchbox", { name: browseType.searchName });
    await search.fill(anchor!.query);
    await expect(browse.getByText(anchor!.nativeIdentifier, { exact: true })).toBeVisible();
  });
}

for (const browseType of browseTypes) {
  test(`Water ${browseType.title} shared browse has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(browseType.path);
    await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption("water-desalination");
    const browse = page.locator(".rdl-release-browse");
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("data-browse-mode", browseType.mode);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking, `${browseType.title}: ${blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")}`).toEqual([]);
  });

  test(`CFIHOS ${browseType.title} shared browse has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(browseType.path);
    await page.getByRole("combobox", { name: "Active RDL search scope" }).selectOption("cfihos");
    const browse = page.locator(".rdl-release-browse");
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("data-source-key", "cfihos");
    await expect(browse).toHaveAttribute("data-release-key", "cfihos-2.0");
    await expect(browse).toHaveAttribute("data-browse-mode", browseType.mode);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking, `CFIHOS ${browseType.title}: ${blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")}`).toEqual([]);
  });
}
