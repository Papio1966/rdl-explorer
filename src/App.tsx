import { lazy, Suspense, type ComponentType } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RdlLegacyEntityRedirect } from "./components/RdlLegacyEntityRedirect";
import { RdlScopedLegacyGuard } from "./components/RdlScopedLegacyGuard";
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
const RdlSourceReleaseComparePage = lazyNamed(() => import("./pages/RdlSourceReleaseComparePage"), "RdlSourceReleaseComparePage");
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
            <Route path="/rdls/:sourceKey/compare" element={<RdlSourceReleaseComparePage />} />
            <Route path="/rdl/:sourceKey/:releaseKey/:entityType/:nativeIdentifier" element={<RdlEntityPage />} />
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
            <Route path="/classes/tag" element={<RdlScopedLegacyGuard entityType="tag_class" title="Tag Classes"><TagClassesPage /></RdlScopedLegacyGuard>} />
            <Route path="/classes/tag/:tagClassId" element={<RdlLegacyEntityRedirect entityType="tag_class" paramName="tagClassId" />} />
            <Route path="/classes/equipment" element={<RdlScopedLegacyGuard entityType="equipment_class" title="Equipment Classes"><EquipmentClassesPage /></RdlScopedLegacyGuard>} />
            <Route path="/classes/equipment/:equipmentClassId" element={<RdlLegacyEntityRedirect entityType="equipment_class" paramName="equipmentClassId" />} />
            <Route path="/documents" element={<RdlScopedLegacyGuard entityType="document_type" title="Document Types"><DocumentTypesPage /></RdlScopedLegacyGuard>} />
            <Route path="/documents/:documentTypeId" element={<RdlLegacyEntityRedirect entityType="document_type" paramName="documentTypeId" />} />
            <Route path="/disciplines" element={<RdlScopedLegacyGuard entityType="discipline" title="Disciplines"><DisciplinesPage /></RdlScopedLegacyGuard>} />
            <Route path="/disciplines/:disciplineId" element={<RdlLegacyEntityRedirect entityType="discipline" paramName="disciplineId" />} />
            <Route path="/lifecycle" element={<Navigate to="/lifecycle/detailed-engineering" replace />} />
            <Route path="/lifecycle/:lifecyclePhase" element={<RdlScopedLegacyGuard title="Lifecycle Requirements" specialized><LifecycleRequirementsPage /></RdlScopedLegacyGuard>} />
            <Route path="/dictionary" element={<RdlScopedLegacyGuard entityType="property" title="Data Dictionary"><DataDictionaryPage /></RdlScopedLegacyGuard>} />
            <Route path="/dictionary/:propertyId" element={<RdlLegacyEntityRedirect entityType="property" paramName="propertyId" />} />
            <Route path="/standards" element={<RdlScopedLegacyGuard entityType="source_standard" title="Source Standards"><SourceStandardsPage /></RdlScopedLegacyGuard>} />
            <Route path="/standards/:sourceStandardId" element={<RdlLegacyEntityRedirect entityType="source_standard" paramName="sourceStandardId" />} />
            <Route path="/units" element={<RdlScopedLegacyGuard entityType="unit_of_measure" title="Units of Measure"><UnitsOfMeasurePage /></RdlScopedLegacyGuard>} />
            <Route path="/units/:unitId" element={<RdlLegacyEntityRedirect entityType="unit_of_measure" paramName="unitId" />} />
            <Route path="/model" element={<RdlScopedLegacyGuard title="Data Model" specialized><DataModelPage /></RdlScopedLegacyGuard>} />
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
