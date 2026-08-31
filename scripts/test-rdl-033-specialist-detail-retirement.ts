import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(path, "utf8");
const must = (condition: boolean, message: string) => assert.ok(condition, message);
const lineCount = (value: string) => value.split(/\r?\n/).length - 1;

const app = read("src/App.tsx");
const redirect = read("src/components/RdlLegacyEntityRedirect.tsx");
const guard = read("src/components/RdlScopedLegacyGuard.tsx");
const packageJson = read("package.json");
const regression = read("scripts/test-app-regression.ts");

const pages = [
  {
    path: "src/pages/TagClassesPage.tsx",
    route: "/classes/tag/",
    forbidden: [
      "useParams",
      "tagClassId",
      "TagClassDetails",
      "PropertyDrawer",
      "cfihosClassRelationshipRepository",
      "cfihosSourceStandardRepository",
      "cfihosClassDocumentRepository",
      "cfihosPropertyGroupingRepository",
      "cfihosJip33RequirementRepository",
    ],
  },
  {
    path: "src/pages/EquipmentClassesPage.tsx",
    route: "/classes/equipment/",
    forbidden: [
      "useParams",
      "equipmentClassId",
      "EquipmentClassDetails",
      "PropertyDrawer",
      "cfihosClassRelationshipRepository",
      "cfihosSourceStandardRepository",
      "cfihosClassDocumentRepository",
      "cfihosPropertyGroupingRepository",
    ],
  },
  {
    path: "src/pages/DocumentTypesPage.tsx",
    route: "/documents/",
    forbidden: [
      "useParams",
      "documentTypeId",
      "DetailState",
      "DocumentTypeDetails",
      "DisciplineDocumentTypeDrawer",
      "cfihosClassDocumentRepository",
      "cfihosJip33RequirementRepository",
    ],
  },
  {
    path: "src/pages/DataDictionaryPage.tsx",
    route: "/dictionary/",
    forbidden: [
      "useParams",
      "propertyId",
      "DetailState",
      "PropertyDetails",
      "cfihosUnitOfMeasureRepository",
      "CfihosPropertyUsage",
      "CfihosPropertyPicklistValue",
    ],
  },
  {
    path: "src/pages/SourceStandardsPage.tsx",
    route: "/standards/",
    forbidden: [
      "useParams",
      "sourceStandardId",
      "DetailState",
      "SourceStandardDetails",
      "cfihosJip33RequirementRepository",
      "CfihosSourceStandardUsage",
      "CfihosSourceStandardPicklistValue",
    ],
  },
  {
    path: "src/pages/DisciplinesPage.tsx",
    route: "/disciplines/",
    forbidden: [
      "useParams",
      "disciplineId",
      "DetailState",
      "DisciplineDetails",
      "DisciplineDocumentTypeDrawer",
      "CfihosDisciplineDocumentType",
    ],
  },
  {
    path: "src/pages/UnitsOfMeasurePage.tsx",
    route: "/units/",
    forbidden: [
      "useParams",
      "unitId",
      "UnitDetail",
      "DetailRow",
      "selectedUnit",
      "dimensionUnits",
    ],
  },
] as const;

let retiredPageLines = 0;
for (const page of pages) {
  const source = read(page.path);
  retiredPageLines += lineCount(source);
  must(source.includes("useNavigate"), `${page.path} lost browse-to-detail navigation`);
  must(source.includes(page.route), `${page.path} no longer opens its compatibility detail route`);
  for (const forbidden of page.forbidden) {
    must(!source.includes(forbidden), `${page.path} still contains retired specialist detail token: ${forbidden}`);
  }
}

must(retiredPageLines < 1800, `specialist page retirement did not materially reduce the page surface (${retiredPageLines} lines)`);

must(!guard.includes("useParams"), "legacy browse guard still depends on route parameters");
must(!guard.includes("useMemo"), "legacy browse guard still carries detail-selection memoization");
must(!guard.includes("detailParam"), "legacy browse guard still exposes retired detailParam API");
must(!guard.includes("Open generic entity view"), "legacy browse guard still renders the retired intermediate detail card");
must(guard.includes("item.releaseKey === releaseKey"), "legacy browse guard lost explicit release isolation");
must(guard.includes("CFIHOS data is never used as a silent fallback"), "legacy browse guard lost fail-closed scope messaging");

const routeExpectations = [
  ["/classes/tag/:tagClassId", "tag_class", "tagClassId"],
  ["/classes/equipment/:equipmentClassId", "equipment_class", "equipmentClassId"],
  ["/documents/:documentTypeId", "document_type", "documentTypeId"],
  ["/disciplines/:disciplineId", "discipline", "disciplineId"],
  ["/dictionary/:propertyId", "property", "propertyId"],
  ["/standards/:sourceStandardId", "source_standard", "sourceStandardId"],
  ["/units/:unitId", "unit_of_measure", "unitId"],
] as const;

for (const [path, entityType, paramName] of routeExpectations) {
  must(app.includes(`path="${path}"`), `legacy detail route missing after retirement: ${path}`);
  must(
    app.includes(`<RdlLegacyEntityRedirect entityType="${entityType}" paramName="${paramName}" />`),
    `legacy detail route no longer uses canonical redirect: ${path}`,
  );
}

for (const browseRoute of [
  "/classes/tag",
  "/classes/equipment",
  "/documents",
  "/disciplines",
  "/dictionary",
  "/standards",
  "/units",
]) {
  must(app.includes(`path="${browseRoute}"`), `browse route removed during specialist retirement: ${browseRoute}`);
}

must(redirect.includes('const CFIHOS_SOURCE_KEY = "cfihos"'), "legacy redirect lost explicit CFIHOS source pin");
must(redirect.includes('const CFIHOS_RELEASE_KEY = "cfihos-2.0"'), "legacy redirect lost explicit CFIHOS release pin");
must(redirect.includes("rdlEntityRoute("), "legacy redirect no longer targets canonical entity detail");
must(!redirect.includes("getDefaultReleaseKey"), "legacy redirect must not infer a mutable release default");

must(regression.includes("canonical entity detail UX"), "application regression contract was not moved to the canonical detail renderer");
must(regression.includes("RdlRelationshipSection.tsx"), "application regression contract does not verify canonical progressive disclosure");
must(!regression.includes('id="dictionary-units"'), "application regression contract still requires retired specialist property anchors");
must(!regression.includes('id="source-standard-properties"'), "application regression contract still requires retired specialist Source Standard anchors");
must(packageJson.includes('"test:rdl-033"'), "RDL-033 package test script missing");

function collectTsx(dir: string): string[] {
  const values: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) values.push(...collectTsx(path));
    else if (name.endsWith(".tsx")) values.push(read(path));
  }
  return values;
}

const allTsx = collectTsx("src").join("\n");
const cssClassPattern = /\.([A-Za-z][A-Za-z0-9_-]*)/g;
const cssTargets = [
  {
    path: "src/pages/TagClassesPage.css",
    required: ["tag-explorer", "tag-browser-panel", "tag-tree-row", "tag-detail-panel", "tag-empty-selection"],
    forbidden: ["tag-property-drawer", "tag-required-documents-section", "tag-jip33-section", "tag-standards-section", "tag-properties-section"],
  },
  {
    path: "src/pages/EquipmentClassesPage.css",
    required: ["equipment-explorer", "equipment-browser-panel", "equipment-tree-row", "equipment-detail-panel", "equipment-empty-selection"],
    forbidden: ["equipment-property-drawer", "equipment-required-documents-section", "equipment-standards-section", "equipment-properties-section", "equipment-related-classes-section"],
  },
  {
    path: "src/pages/DocumentTypesPage.css",
    required: ["document-explorer", "document-browser", "document-list-item", "document-detail", "document-empty"],
    forbidden: ["document-details-content", "document-class-requirement-table", "document-jip33-list", "document-on-this-page", "document-usage-section"],
  },
  {
    path: "src/pages/DataDictionaryPage.css",
    required: ["dictionary-explorer", "dictionary-browser", "dictionary-property-item", "dictionary-detail", "dictionary-empty"],
    forbidden: ["dictionary-details-content", "dictionary-picklist-table", "dictionary-unit-grid", "dictionary-page-contents", "dictionary-section-anchor"],
  },
  {
    path: "src/pages/SourceStandardsPage.css",
    required: ["source-standard-explorer", "source-standard-browser", "source-standard-list-item", "source-standard-detail", "source-standard-empty"],
    forbidden: ["source-standard-details-content", "source-standard-picklist-table", "source-standard-property-table", "source-standard-page-contents", "source-standard-class-table"],
  },
  {
    path: "src/pages/DisciplinesPage.css",
    required: ["discipline-explorer", "discipline-browser", "discipline-list-item", "discipline-detail", "discipline-empty"],
    forbidden: ["discipline-details-content", "discipline-table", "discipline-documents-section", "discipline-lifecycle-summary", "discipline-details-button"],
  },
  {
    path: "src/pages/UnitsOfMeasurePage.css",
    required: ["uom-explorer", "uom-browser", "uom-list-item", "uom-detail", "uom-empty-selection"],
    forbidden: ["uom-detail-inner", "uom-detail-header", "uom-detail-row", "uom-family-grid", "uom-card-grid"],
  },
] as const;

let retainedCssLines = 0;
let retainedCssClasses = 0;
for (const target of cssTargets) {
  const css = read(target.path);
  retainedCssLines += lineCount(css);
  const classes = new Set(Array.from(css.matchAll(cssClassPattern), (match) => match[1]));
  retainedCssClasses += classes.size;

  for (const required of target.required) {
    must(classes.has(required), `${target.path} lost browse selector: ${required}`);
  }
  for (const forbidden of target.forbidden) {
    must(!classes.has(forbidden), `${target.path} still contains retired detail selector: ${forbidden}`);
  }
  for (const cssClass of classes) {
    must(allTsx.includes(cssClass), `${target.path} contains orphan CSS class with no TSX reference: ${cssClass}`);
  }
}

must(retainedCssLines < 2200, `specialist CSS retirement did not materially reduce the stylesheet surface (${retainedCssLines} lines)`);
must(retainedCssClasses < 150, `specialist CSS retirement left too many page-local classes (${retainedCssClasses})`);

console.log(
  `PASS RDL-033 specialist detail retirement and CSS simplification (${retiredPageLines} browse TSX lines; ${retainedCssLines} browse CSS lines; ${retainedCssClasses} referenced CSS classes)`,
);
