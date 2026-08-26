import { lazy, Suspense, type ComponentType } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RdlScopeProvider } from "./rdl/RdlScopeContext";

function lazyNamed<T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });
}

const HomePage = lazyNamed(() => import("./pages/HomePage"), "HomePage");
const DataSourcePage = lazyNamed(() => import("./pages/DataSourcePage"), "DataSourcePage");
const TagClassesPage = lazyNamed(() => import("./pages/TagClassesPage"), "TagClassesPage");
const EquipmentClassesPage = lazyNamed(() => import("./pages/EquipmentClassesPage"), "EquipmentClassesPage");
const DataDictionaryPage = lazyNamed(() => import("./pages/DataDictionaryPage"), "DataDictionaryPage");
const DocumentSchemaInspectionPage = lazyNamed(
  () => import("./pages/DocumentSchemaInspectionPage"),
  "DocumentSchemaInspectionPage",
);
const SourceStandardsInspectionPage = lazyNamed(
  () => import("./pages/SourceStandardsInspectionPage"),
  "SourceStandardsInspectionPage",
);
const DocumentTypesPage = lazyNamed(() => import("./pages/DocumentTypesPage"), "DocumentTypesPage");
const DisciplinesPage = lazyNamed(() => import("./pages/DisciplinesPage"), "DisciplinesPage");
const SourceStandardsPage = lazyNamed(() => import("./pages/SourceStandardsPage"), "SourceStandardsPage");
const LifecycleRequirementsPage = lazyNamed(
  () => import("./pages/LifecycleRequirementsPage"),
  "LifecycleRequirementsPage",
);
const DataModelPage = lazyNamed(() => import("./pages/DataModelPage"), "DataModelPage");
const UnitsOfMeasurePage = lazyNamed(() => import("./pages/UnitsOfMeasurePage"), "UnitsOfMeasurePage");
const ValidationPage = lazyNamed(() => import("./pages/ValidationPage"), "ValidationPage");
const CisPreviewPage = lazyNamed(() => import("./pages/CisPreviewPage"), "CisPreviewPage");
const CisBuilderPage = lazyNamed(() => import("./pages/CisBuilderPage"), "CisBuilderPage");
const AssistantPage = lazyNamed(() => import("./pages/AssistantPage"), "AssistantPage");
const AboutPage = lazyNamed(() => import("./pages/AboutPage"), "AboutPage");
const HelpPage = lazyNamed(() => import("./pages/HelpPage"), "HelpPage");
const RdlCataloguePage = lazyNamed(() => import("./pages/RdlCataloguePage"), "RdlCataloguePage");
const RdlSearchPage = lazyNamed(() => import("./pages/RdlSearchPage"), "RdlSearchPage");
const RdlEntityPage = lazyNamed(() => import("./pages/RdlEntityPage"), "RdlEntityPage");
const RdlIntelligencePage = lazyNamed(() => import("./pages/RdlIntelligencePage"), "RdlIntelligencePage");
const RdlGovernancePage = lazyNamed(() => import("./pages/RdlGovernancePage"), "RdlGovernancePage");
const RdlHierarchyPage = lazyNamed(() => import("./pages/RdlHierarchyPage"), "RdlHierarchyPage");
const RdlExtensionsPage = lazyNamed(() => import("./pages/RdlExtensionsPage"), "RdlExtensionsPage");
const RdlPublicationPage = lazyNamed(() => import("./pages/RdlPublicationPage"), "RdlPublicationPage");
const RdlDistributionPage = lazyNamed(() => import("./pages/RdlDistributionPage"), "RdlDistributionPage");
const RdlConsumerIntegrationPage = lazyNamed(() => import("./pages/RdlConsumerIntegrationPage"), "RdlConsumerIntegrationPage");
const RdlReleaseImpactPage = lazyNamed(() => import("./pages/RdlReleaseImpactPage"), "RdlReleaseImpactPage");
const RdlMigrationPlanningPage = lazyNamed(() => import("./pages/RdlMigrationPlanningPage"), "RdlMigrationPlanningPage");
const RdlControlTowerPage = lazyNamed(() => import("./pages/RdlControlTowerPage"), "RdlControlTowerPage");
const RdlWorkQueuePage = lazyNamed(() => import("./pages/RdlWorkQueuePage"), "RdlWorkQueuePage");
const RdlAiStandardsIntelligencePage = lazyNamed(() => import("./pages/RdlAiStandardsIntelligencePage"), "RdlAiStandardsIntelligencePage");
const RdlAiTrustPage = lazyNamed(() => import("./pages/RdlAiTrustPage"), "RdlAiTrustPage");
const RdlIdentityAdministrationPage = lazyNamed(() => import("./pages/RdlIdentityAdministrationPage"), "RdlIdentityAdministrationPage");
const RdlTenantAdministrationPage = lazyNamed(() => import("./pages/RdlTenantAdministrationPage"), "RdlTenantAdministrationPage");

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ padding: "2rem", color: "var(--text-muted, #66756f)" }}
    >
      Loading page…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RdlScopeProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="/source" element={<DataSourcePage />} />
            <Route path="/rdls" element={<RdlCataloguePage />} />
            <Route path="/search" element={<RdlSearchPage />} />
            <Route path="/rdl/:sourceKey/:entityType/:nativeIdentifier" element={<RdlEntityPage />} />
            <Route path="/intelligence" element={<RdlIntelligencePage />} />
            <Route path="/governance" element={<RdlGovernancePage />} />
            <Route path="/hierarchy" element={<RdlHierarchyPage />} />
            <Route path="/extensions" element={<RdlExtensionsPage />} />
            <Route path="/publication" element={<RdlPublicationPage />} />
            <Route path="/distribution" element={<RdlDistributionPage />} />
            <Route path="/integration" element={<RdlConsumerIntegrationPage />} />
            <Route path="/impact" element={<RdlReleaseImpactPage />} />
            <Route path="/migration" element={<RdlMigrationPlanningPage />} />
            <Route path="/control-tower" element={<RdlControlTowerPage />} />
            <Route path="/work-queue" element={<RdlWorkQueuePage />} />
            <Route path="/ai-intelligence" element={<RdlAiStandardsIntelligencePage />} />
            <Route path="/ai-trust" element={<RdlAiTrustPage />} />
            <Route path="/identity-admin" element={<RdlIdentityAdministrationPage />} />
            <Route path="/tenant-admin" element={<RdlTenantAdministrationPage />} />
            <Route path="/inspect/documents" element={<DocumentSchemaInspectionPage />} />
            <Route path="/inspect/standards" element={<SourceStandardsInspectionPage />} />
            <Route path="/classes/tag" element={<TagClassesPage />} />
            <Route path="/classes/tag/:tagClassId" element={<TagClassesPage />} />
            <Route path="/classes/equipment" element={<EquipmentClassesPage />} />
            <Route path="/classes/equipment/:equipmentClassId" element={<EquipmentClassesPage />} />
            <Route path="/documents" element={<DocumentTypesPage />} />
            <Route path="/documents/:documentTypeId" element={<DocumentTypesPage />} />
            <Route path="/disciplines" element={<DisciplinesPage />} />
            <Route path="/disciplines/:disciplineId" element={<DisciplinesPage />} />
            <Route path="/lifecycle" element={<Navigate to="/lifecycle/detailed-engineering" replace />} />
            <Route path="/lifecycle/:lifecyclePhase" element={<LifecycleRequirementsPage />} />
            <Route path="/dictionary" element={<DataDictionaryPage />} />
            <Route path="/dictionary/:propertyId" element={<DataDictionaryPage />} />
            <Route path="/standards" element={<SourceStandardsPage />} />
            <Route path="/standards/:sourceStandardId" element={<SourceStandardsPage />} />
            <Route path="/units" element={<UnitsOfMeasurePage />} />
            <Route path="/units/:unitId" element={<UnitsOfMeasurePage />} />
            <Route path="/model" element={<DataModelPage />} />
            <Route path="/validation" element={<ValidationPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/cis" element={<CisBuilderPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/cis-preview" element={<CisPreviewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      </RdlScopeProvider>
    </BrowserRouter>
  );
}
