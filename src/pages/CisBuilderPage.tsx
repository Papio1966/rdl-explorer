import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ClipboardList,
  FileText,
  Download,
  Gauge,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cfihosRepository } from "../cfihos/repository/CfihosRepository";
import { cfihosEquipmentRepository } from "../cfihos/repository/CfihosEquipmentRepository";
import { cfihosDocumentRepository } from "../cfihos/repository/CfihosDocumentRepository";
import { CisDerivationService } from "../cfihos/cis/CisDerivationService";
import { cfihosCisDerivationDataSource } from "../cfihos/cis/CfihosCisDerivationDataSource";
import {
  createEmptyProjectInformationProfile,
  type CisClassDomain,
  type CisClassSelection,
  type CisDisciplineSelection,
  type CisRequirementProvenance,
  type ProjectInformationProfile,
} from "../cfihos/cis/projectInformationProfile";
import "./CisBuilderPage.css";

type ClassOption = { id: string; name: string; domain: CisClassDomain };
type DisciplineOption = { id: string; name: string };
type LoadState = "loading" | "ready" | "error";
type BuilderStage = "scope" | "review" | "overrides" | "export";
type OverrideDomain = "asset-data" | "documents" | "standards" | "lifecycle" | "custom";
type ContractOverride = {
  id: string;
  domain: OverrideDomain;
  action: "exclude" | "change" | "add";
  targetKey: string;
  targetLabel: string;
  baselineValue?: string;
  contractValue?: string;
  reason: string;
};
type ReviewTab = "asset-data" | "documents" | "standards" | "lifecycle";

type WorkingCisDocument = {
  schema: "cfihos-cis-document-v1";
  savedAt: string;
  workspace: {
    projectName: string;
    contractName: string;
    profileName: string;
    domain: CisClassDomain;
    selectedClasses: CisClassSelection[];
    selectedDisciplines: CisDisciplineSelection[];
    result: ProjectInformationProfile | null;
    warnings: string[];
    stage: BuilderStage;
    reviewTab: ReviewTab;
    overrides: ContractOverride[];
  };
};

const CIS_DRAFT_STORAGE_KEY = "cfihos-explorer:cis-builder:draft:v1";
const service = new CisDerivationService(cfihosCisDerivationDataSource);

export function CisBuilderPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [projectName, setProjectName] = useState("");
  const [contractName, setContractName] = useState("");
  const [profileName, setProfileName] = useState("Contract Information Specification");
  const [domain, setDomain] = useState<CisClassDomain>("tag");
  const [classQuery, setClassQuery] = useState("");
  const [disciplineQuery, setDisciplineQuery] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<CisClassSelection[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<CisDisciplineSelection[]>([]);
  const [result, setResult] = useState<ProjectInformationProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [deriving, setDeriving] = useState(false);
  const [stage, setStage] = useState<BuilderStage>("scope");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("asset-data");
  const [overrides, setOverrides] = useState<ContractOverride[]>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const openFileInputRef = useRef<HTMLInputElement | null>(null);
  const importCsvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CIS_DRAFT_STORAGE_KEY);
      if (raw) {
        const document = JSON.parse(raw) as WorkingCisDocument;
        if (document.schema === "cfihos-cis-document-v1" && document.workspace) {
          restoreWorkspace(document.workspace);
          setLastSavedAt(document.savedAt);
        }
      }
    } catch (error) {
      console.warn("Unable to restore the local CIS draft.", error);
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const savedAt = new Date().toISOString();
    const document = createWorkingDocument(savedAt);
    try {
      window.localStorage.setItem(CIS_DRAFT_STORAGE_KEY, JSON.stringify(document));
      setLastSavedAt(savedAt);
    } catch (error) {
      console.warn("Unable to save the local CIS draft.", error);
    }
  }, [
    draftHydrated,
    projectName,
    contractName,
    profileName,
    domain,
    selectedClasses,
    selectedDisciplines,
    result,
    warnings,
    stage,
    reviewTab,
    overrides,
  ]);

  useEffect(() => {
    let active = true;
    Promise.all([
      cfihosRepository.getTagClasses(),
      cfihosEquipmentRepository.getEquipmentClasses(),
      cfihosDocumentRepository.getDisciplines(),
    ])
      .then(([tags, equipment, disciplineRows]) => {
        if (!active) return;
        setClasses([
          ...tags.map((item) => ({ id: item.id, name: item.name, domain: "tag" as const })),
          ...equipment.map((item) => ({ id: item.id, name: item.name, domain: "equipment" as const })),
        ]);
        setDisciplines(disciplineRows.map((item) => ({ id: item.id, name: item.name })));
        setLoadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Unable to load CFIHOS scope data.");
        setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const classMatches = useMemo(() => {
    const q = classQuery.trim().toLowerCase();
    return classes
      .filter(
        (item) =>
          item.domain === domain &&
          !selectedClasses.some(
            (selected) => selected.domain === item.domain && selected.classId === item.id,
          ),
      )
      .filter(
        (item) =>
          !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [classes, domain, classQuery, selectedClasses]);

  const disciplineMatches = useMemo(() => {
    const q = disciplineQuery.trim().toLowerCase();
    return disciplines
      .filter(
        (item) =>
          !selectedDisciplines.some((selected) => selected.disciplineId === item.id),
      )
      .filter(
        (item) =>
          !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [disciplines, disciplineQuery, selectedDisciplines]);

  function createWorkingDocument(savedAt = new Date().toISOString()): WorkingCisDocument {
    return {
      schema: "cfihos-cis-document-v1",
      savedAt,
      workspace: {
        projectName,
        contractName,
        profileName,
        domain,
        selectedClasses,
        selectedDisciplines,
        result,
        warnings,
        stage,
        reviewTab,
        overrides,
      },
    };
  }

  function restoreWorkspace(workspace: WorkingCisDocument["workspace"]) {
    setProjectName(workspace.projectName ?? "");
    setContractName(workspace.contractName ?? "");
    setProfileName(workspace.profileName || "Contract Information Specification");
    setDomain(workspace.domain === "equipment" ? "equipment" : "tag");
    setSelectedClasses(Array.isArray(workspace.selectedClasses) ? workspace.selectedClasses : []);
    setSelectedDisciplines(
      Array.isArray(workspace.selectedDisciplines) ? workspace.selectedDisciplines : [],
    );
    setResult(workspace.result ?? null);
    setWarnings(Array.isArray(workspace.warnings) ? workspace.warnings : []);
    setStage(workspace.stage ?? "scope");
    setReviewTab(workspace.reviewTab ?? "asset-data");
    setOverrides(Array.isArray(workspace.overrides) ? workspace.overrides : []);
    setMessage("");
    setClassQuery("");
    setDisciplineQuery("");
  }

  function newCis() {
    const hasContent =
      projectName.trim() ||
      contractName.trim() ||
      selectedClasses.length ||
      selectedDisciplines.length ||
      result ||
      overrides.length;
    if (hasContent && !window.confirm("Create a new CIS and discard the current working draft?")) {
      return;
    }
    restoreWorkspace({
      projectName: "",
      contractName: "",
      profileName: "Contract Information Specification",
      domain: "tag",
      selectedClasses: [],
      selectedDisciplines: [],
      result: null,
      warnings: [],
      stage: "scope",
      reviewTab: "asset-data",
      overrides: [],
    });
    window.localStorage.removeItem(CIS_DRAFT_STORAGE_KEY);
    setLastSavedAt(null);
  }

  function saveCis() {
    const savedAt = new Date().toISOString();
    const document = createWorkingDocument(savedAt);
    downloadTextFile(
      `${safeFileName(profileName || result?.identity.name || "contract-information-specification")}.cis.json`,
      JSON.stringify(document, null, 2),
      "application/json;charset=utf-8",
    );
    try {
      window.localStorage.setItem(CIS_DRAFT_STORAGE_KEY, JSON.stringify(document));
      setLastSavedAt(savedAt);
    } catch (error) {
      console.warn("Unable to update the local CIS draft.", error);
    }
  }

  async function openCisFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as any;
      if (parsed?.schema === "cfihos-cis-document-v1" && parsed.workspace) {
        restoreWorkspace(parsed.workspace as WorkingCisDocument["workspace"]);
        const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString();
        setLastSavedAt(savedAt);
        window.localStorage.setItem(CIS_DRAFT_STORAGE_KEY, JSON.stringify(parsed));
        return;
      }

      if (parsed?.schema === "cfihos-cis-export-v1" && parsed.identity && parsed.scope && parsed.baseline) {
        const now = new Date().toISOString();
        const restored = createEmptyProjectInformationProfile({
          id: parsed.identity.id ?? `cis-${Date.now()}`,
          name: parsed.identity.name ?? "Contract Information Specification",
          projectName: parsed.identity.projectName ?? "Untitled project",
          contractName: parsed.identity.contractName ?? null,
          cfihosVersion: "2.0",
          now,
        });
        restored.identity = { ...restored.identity, ...parsed.identity };
        restored.scope = parsed.scope;
        restored.derived = parsed.baseline;
        restoreWorkspace({
          projectName: restored.identity.projectName,
          contractName: restored.identity.contractName ?? "",
          profileName: restored.identity.name,
          domain: restored.scope.classes?.[0]?.domain ?? "tag",
          selectedClasses: restored.scope.classes ?? [],
          selectedDisciplines: restored.scope.disciplines ?? [],
          result: restored,
          warnings: [],
          stage: "review",
          reviewTab: "asset-data",
          overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [],
        });
        setLastSavedAt(now);
        return;
      }

      throw new Error("Unsupported CIS file. Expected cfihos-cis-document-v1 or cfihos-cis-export-v1.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open the selected CIS file.");
    }
  }

  async function importCsvFile(file: File) {
    try {
      const csv = parseCsv(await file.text());
      const headers = csv.headers;
      const rows = csv.rows;
      const required = [
        "Area",
        "Item",
        "Baseline Value",
        "Contract Value",
        "Decision",
        "Reason / Rationale",
        "Requirement Domain",
        "Target Key",
        "CIS Snapshot Chunk",
        "Snapshot Part",
        "Snapshot Parts",
      ];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length > 0) {
        throw new Error(
          `This CSV is not a round-trip CIS export. Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
        );
      }

      const snapshotRows = rows
        .filter((row) => row["CIS Snapshot Chunk"]?.trim())
        .map((row) => ({
          part: Number(row["Snapshot Part"]),
          total: Number(row["Snapshot Parts"]),
          chunk: row["CIS Snapshot Chunk"],
        }))
        .sort((a, b) => a.part - b.part);

      if (snapshotRows.length === 0) {
        throw new Error("The CSV does not contain an embedded CIS snapshot and cannot restore an editable baseline.");
      }
      const expectedParts = snapshotRows[0].total;
      if (!Number.isFinite(expectedParts) || expectedParts < 1 || snapshotRows.length !== expectedParts) {
        throw new Error("The embedded CIS snapshot is incomplete. Re-export the CSV from the CIS Builder and try again.");
      }

      const snapshot = JSON.parse(snapshotRows.map((row) => row.chunk).join("")) as WorkingCisDocument;
      if (snapshot.schema !== "cfihos-cis-document-v1" || !snapshot.workspace) {
        throw new Error("The embedded CIS snapshot has an unsupported schema.");
      }

      const importedOverrides: ContractOverride[] = [];
      for (const row of rows) {
        const decision = row.Decision?.trim();
        if (!decision || decision === "Baseline" || decision === "Included") continue;

        const domainValue = row["Requirement Domain"]?.trim() as OverrideDomain;
        const targetKeyValue = row["Target Key"]?.trim();
        const label = row.Item?.trim();
        const baselineValue = row["Baseline Value"]?.trim();
        const contractValue = row["Contract Value"]?.trim();
        const reason = row["Reason / Rationale"]?.trim() ?? "";

        if (!label || !domainValue || !targetKeyValue) continue;

        if (decision === "Excluded") {
          importedOverrides.push({
            id: `override-import-${Date.now()}-${importedOverrides.length}`,
            domain: domainValue,
            action: "exclude",
            targetKey: targetKeyValue,
            targetLabel: label,
            baselineValue: baselineValue || undefined,
            reason,
          });
          continue;
        }

        if (decision === "Changed") {
          importedOverrides.push({
            id: `override-import-${Date.now()}-${importedOverrides.length}`,
            domain: domainValue,
            action: "change",
            targetKey: targetKeyValue,
            targetLabel: label,
            baselineValue: baselineValue || undefined,
            contractValue: contractValue || undefined,
            reason,
          });
          continue;
        }

        if (decision === "Added") {
          importedOverrides.push({
            id: `override-import-${Date.now()}-${importedOverrides.length}`,
            domain: "custom",
            action: "add",
            targetKey: targetKeyValue,
            targetLabel: label,
            baselineValue: baselineValue || "Not in baseline",
            contractValue: contractValue || label,
            reason,
          });
          continue;
        }

        throw new Error(`Unsupported Decision value in CSV: ${decision}`);
      }

      const restoredWorkspace: WorkingCisDocument["workspace"] = {
        ...snapshot.workspace,
        overrides: importedOverrides,
        stage: "export",
      };
      restoreWorkspace(restoredWorkspace);
      const savedAt = new Date().toISOString();
      const restoredDocument: WorkingCisDocument = {
        schema: "cfihos-cis-document-v1",
        savedAt,
        workspace: restoredWorkspace,
      };
      window.localStorage.setItem(CIS_DRAFT_STORAGE_KEY, JSON.stringify(restoredDocument));
      setLastSavedAt(savedAt);
      setMessage(`Imported ${rows.filter((row) => row.Area?.trim()).length} CIS schedule rows from CSV.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import the selected CIS CSV file.");
    }
  }

  function invalidateBaseline() {
    setResult(null);
    setOverrides([]);
    setStage("scope");
  }

  function addClass(item: ClassOption) {
    setSelectedClasses((current) => [
      ...current,
      { domain: item.domain, classId: item.id, className: item.name },
    ]);
    setClassQuery("");
    invalidateBaseline();
  }

  function addDiscipline(item: DisciplineOption) {
    setSelectedDisciplines((current) => [
      ...current,
      { disciplineId: item.id, disciplineName: item.name },
    ]);
    setDisciplineQuery("");
    invalidateBaseline();
  }

  async function generateBaseline() {
    setDeriving(true);
    setWarnings([]);
    setMessage("");
    try {
      const now = new Date().toISOString();
      const profile = createEmptyProjectInformationProfile({
        id: `cis-${Date.now()}`,
        name: profileName.trim() || "Contract Information Specification",
        projectName: projectName.trim() || "Untitled project",
        contractName: contractName.trim() || null,
        cfihosVersion: "2.0",
        now,
      });
      profile.scope.classes = selectedClasses;
      profile.scope.disciplines = selectedDisciplines;
      const derived = await service.derive(profile);
      setResult(derived.profile);
      setWarnings(derived.warnings.map((warning) => warning.message));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate CIS baseline.");
    } finally {
      setDeriving(false);
    }
  }

  if (loadState !== "ready") {
    return (
      <div className="cis-builder-status">
        {loadState === "loading" ? (
          <>
            <LoaderCircle className="cis-builder-spin" /> Loading CFIHOS scope…
          </>
        ) : (
          message
        )}
      </div>
    );
  }

  const contextCounts = result
    ? result.derived.documentRequirements.reduce<Record<string, number>>((acc, item) => {
        acc[item.assetContext] = (acc[item.assetContext] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <div className="cis-builder-page">
      <div className="cis-builder-inner">
        <header className="cis-builder-header">
          <div className="cis-builder-eyebrow">
            <ClipboardList size={15} /> Contract information
          </div>
          <h1>Contract Information Specification Builder</h1>
          <p>
            Define project scope, select CFIHOS classes and disciplines, then generate a
            traceable contractual information baseline.
          </p>
        </header>

        <div className="cis-builder-review-note" role="note" aria-label="Recommended CIS file workflow">
          <ShieldCheck size={16} />
          <div>
            <strong>Recommended CIS workflow</strong>
            <span>
              Use Save CIS (JSON) while developing and reviewing the specification. JSON preserves the complete editable CIS, including scope, the locked CFIHOS baseline, provenance and contract overrides. Use CSV primarily when the CIS is ready to issue or when the EPC requires a spreadsheet-based requirement schedule.
            </span>
          </div>
        </div>

        <div className="cis-builder-action" aria-label="Working CIS controls">
          <div>
            <strong>Working CIS</strong>
            <span>
              {lastSavedAt
                ? `Draft saved locally · ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Local draft persistence is active."}
              {" "}JSON is the recommended format for continued CIS authoring.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={newCis}>New CIS</button>
            <button type="button" onClick={() => openFileInputRef.current?.click()}>Open CIS</button>
            <button type="button" onClick={() => importCsvInputRef.current?.click()}>Import CSV</button>
            <button type="button" className="cis-builder-primary" onClick={saveCis}>Save CIS</button>
            <input
              ref={openFileInputRef}
              type="file"
              accept=".json,.cis.json,application/json"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void openCisFile(file);
                event.currentTarget.value = "";
              }}
            />
            <input
              ref={importCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsvFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <div className="cis-builder-steps">
          <button className={stage === "scope" ? "active" : "complete"} onClick={() => setStage("scope")}>
            1 Scope
          </button>
          <button
            className={stage === "review" ? "active" : result ? "available" : ""}
            disabled={!result}
            onClick={() => result && setStage("review")}
          >
            2 Baseline review
          </button>
          <button
            className={stage === "overrides" ? "active" : result ? "available" : ""}
            disabled={!result}
            onClick={() => result && setStage("overrides")}
          >
            3 Overrides{overrides.length ? ` (${overrides.length})` : ""}
          </button>
          <button
            className={stage === "export" ? "active" : result ? "available" : ""}
            disabled={!result}
            onClick={() => result && setStage("export")}
          >
            4 Export
          </button>
        </div>

        {stage === "scope" ? (
          <>
            <section className="cis-builder-card">
              <h2>Project & contract</h2>
              <div className="cis-builder-form-grid">
                <label>
                  Project name
                  <input
                    value={projectName}
                    onChange={(event) => {
                      setProjectName(event.target.value);
                      invalidateBaseline();
                    }}
                    placeholder="e.g. North Sea Compression Project"
                  />
                </label>
                <label>
                  Contract / package
                  <input
                    value={contractName}
                    onChange={(event) => {
                      setContractName(event.target.value);
                      invalidateBaseline();
                    }}
                    placeholder="e.g. EPC Package 01"
                  />
                </label>
                <label className="wide">
                  Specification name
                  <input
                    value={profileName}
                    onChange={(event) => {
                      setProfileName(event.target.value);
                      invalidateBaseline();
                    }}
                  />
                </label>
              </div>
            </section>

            <div className="cis-builder-scope-grid">
              <section className="cis-builder-card">
                <div className="cis-builder-card-heading">
                  <div>
                    <h2>Asset information scope</h2>
                    <p>Select one or more Tag and Equipment Classes.</p>
                  </div>
                  <span>{selectedClasses.length} selected</span>
                </div>
                <div className="cis-builder-domain-toggle">
                  <button className={domain === "tag" ? "active" : ""} onClick={() => setDomain("tag")}>
                    Tag Classes
                  </button>
                  <button
                    className={domain === "equipment" ? "active" : ""}
                    onClick={() => setDomain("equipment")}
                  >
                    Equipment Classes
                  </button>
                </div>
                <div className="cis-builder-search">
                  <Search size={15} />
                  <input
                    value={classQuery}
                    onChange={(event) => setClassQuery(event.target.value)}
                    placeholder={`Search ${domain === "tag" ? "Tag" : "Equipment"} Classes…`}
                  />
                </div>
                {classQuery && (
                  <div className="cis-builder-results">
                    {classMatches.map((item) => (
                      <button key={`${item.domain}-${item.id}`} onClick={() => addClass(item)}>
                        <span>
                          {item.name}
                          <small>{item.id}</small>
                        </span>
                        <Plus size={15} />
                      </button>
                    ))}
                  </div>
                )}
                <SelectionList
                  empty="No classes selected yet."
                  items={selectedClasses.map((item) => ({
                    key: `${item.domain}-${item.classId}`,
                    title: item.className,
                    meta: `${item.domain === "tag" ? "Tag" : "Equipment"} · ${item.classId}`,
                  }))}
                  onRemove={(key) => {
                    setSelectedClasses((current) =>
                      current.filter((item) => `${item.domain}-${item.classId}` !== key),
                    );
                    invalidateBaseline();
                  }}
                />
              </section>

              <section className="cis-builder-card">
                <div className="cis-builder-card-heading">
                  <div>
                    <h2>Discipline scope</h2>
                    <p>Disciplines are explicit contract scope and are never inferred.</p>
                  </div>
                  <span>{selectedDisciplines.length} selected</span>
                </div>
                <div className="cis-builder-search cis-builder-discipline-search">
                  <Search size={15} />
                  <input
                    value={disciplineQuery}
                    onChange={(event) => setDisciplineQuery(event.target.value)}
                    placeholder="Search Disciplines…"
                  />
                </div>
                {disciplineQuery && (
                  <div className="cis-builder-results">
                    {disciplineMatches.map((item) => (
                      <button key={item.id} onClick={() => addDiscipline(item)}>
                        <span>
                          {item.name}
                          <small>{item.id}</small>
                        </span>
                        <Plus size={15} />
                      </button>
                    ))}
                  </div>
                )}
                <SelectionList
                  empty="No disciplines selected yet."
                  items={selectedDisciplines.map((item) => ({
                    key: item.disciplineId,
                    title: item.disciplineName,
                    meta: item.disciplineId,
                  }))}
                  onRemove={(key) => {
                    setSelectedDisciplines((current) =>
                      current.filter((item) => item.disciplineId !== key),
                    );
                    invalidateBaseline();
                  }}
                />
              </section>
            </div>

            <div className="cis-builder-action">
              <div>
                <strong>CFIHOS 2.0 baseline</strong>
                <span>The validated derivation engine remains unchanged.</span>
              </div>
              <button disabled={selectedClasses.length === 0 || deriving} onClick={generateBaseline}>
                {deriving ? <LoaderCircle className="cis-builder-spin" size={16} /> : <Check size={16} />}
                Generate baseline
              </button>
            </div>
            {message && <div className="cis-builder-warning">{message}</div>}
            {warnings.length > 0 && (
              <div className="cis-builder-warning">
                {warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            )}

            {result && (
              <section className="cis-builder-baseline">
                <BaselineHeading result={result} />
                <BaselineMetrics result={result} contextCounts={contextCounts} />
                <div className="cis-builder-next cis-builder-next-action">
                  <span>
                    <strong>Baseline generated successfully.</strong>
                    <small>Review every derived requirement with its CFIHOS provenance before applying contract overrides.</small>
                  </span>
                  <button onClick={() => setStage("review")}>Review baseline</button>
                </div>
              </section>
            )}
          </>
        ) : stage === "review" && result ? (
          <BaselineReview
            result={result}
            contextCounts={contextCounts}
            activeTab={reviewTab}
            onTabChange={setReviewTab}
            onBack={() => setStage("scope")}
            onProceed={() => setStage("overrides")}
          />
        ) : stage === "overrides" && result ? (
          <OverridesWorkspace
            result={result}
            overrides={overrides}
            onChange={setOverrides}
            onBack={() => setStage("review")}
            onProceed={() => setStage("export")}
          />
        ) : stage === "export" && result ? (
          <ExportWorkspace
            result={result}
            overrides={overrides}
            onBack={() => setStage("overrides")}
          />
        ) : null}
      </div>
    </div>
  );
}

function BaselineReview({
  result,
  contextCounts,
  activeTab,
  onTabChange,
  onBack,
  onProceed,
}: {
  result: ProjectInformationProfile;
  contextCounts: Record<string, number>;
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  onBack: () => void;
  onProceed: () => void;
}) {
  return (
    <section className="cis-builder-review">
      <div className="cis-builder-review-toolbar">
        <button className="cis-builder-back" onClick={onBack}>← Edit scope</button>
        <div>
          <div className="cis-builder-eyebrow">CFIHOS 2.0 baseline</div>
          <h2>{result.identity.name}</h2>
          <p>
            {result.identity.projectName}
            {result.identity.contractName ? ` · ${result.identity.contractName}` : ""}
          </p>
        </div>
        <span className="cis-builder-baseline-lock"><ShieldCheck size={14}/> Baseline locked</span>
      </div>

      <BaselineMetrics result={result} contextCounts={contextCounts} compact />

      <div className="cis-builder-review-note">
        <ShieldCheck size={16}/>
        <div>
          <strong>Baseline = what CFIHOS says.</strong>
          <span>All items are initially Included. Contract deviations will be recorded separately as overrides in Stage 3; the CFIHOS baseline itself is never mutated.</span>
        </div>
      </div>

      <div className="cis-builder-review-tabs">
        <ReviewTabButton icon={<Layers3 size={15}/>} label="Asset data" count={result.derived.properties.length} active={activeTab === "asset-data"} onClick={() => onTabChange("asset-data")} />
        <ReviewTabButton icon={<FileText size={15}/>} label="Documents" count={result.derived.documentTypes.length} active={activeTab === "documents"} onClick={() => onTabChange("documents")} />
        <ReviewTabButton icon={<ShieldCheck size={15}/>} label="Standards" count={result.derived.sourceStandards.length} active={activeTab === "standards"} onClick={() => onTabChange("standards")} />
        <ReviewTabButton icon={<Gauge size={15}/>} label="Lifecycle" count={result.derived.lifecycleRequirements.length} active={activeTab === "lifecycle"} onClick={() => onTabChange("lifecycle")} />
      </div>

      <div className="cis-builder-review-panel">
        {activeTab === "asset-data" && <AssetDataReview result={result} />}
        {activeTab === "documents" && <DocumentReview result={result} />}
        {activeTab === "standards" && <StandardsReview result={result} />}
        {activeTab === "lifecycle" && <LifecycleReview result={result} />}
      </div>

      <div className="cis-builder-stage-action">
        <div><strong>Baseline review complete?</strong><span>Continue to record explicit contract deviations. The CFIHOS baseline remains locked.</span></div>
        <button onClick={onProceed}>Continue to overrides →</button>
      </div>
    </section>
  );
}

function OverridesWorkspace({
  result,
  overrides,
  onChange,
  onBack,
  onProceed,
}: {
  result: ProjectInformationProfile;
  overrides: ContractOverride[];
  onChange: (items: ContractOverride[]) => void;
  onBack: () => void;
  onProceed: () => void;
}) {
  const [domain, setDomain] = useState<OverrideDomain>("documents");
  const [action, setAction] = useState<"exclude" | "change" | "add">("exclude");
  const [targetKey, setTargetKey] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [reason, setReason] = useState("");

  const targets = useMemo(() => {
    if (domain === "asset-data") return result.derived.properties.map((item) => ({ key: item.propertyId, label: item.propertyName, baseline: "Included" }));
    if (domain === "documents") return result.derived.documentTypes.map((item) => ({ key: item.documentTypeId, label: item.documentTypeName, baseline: "Included" }));
    if (domain === "standards") return result.derived.sourceStandards.map((item) => ({ key: item.sourceStandardId, label: item.sourceStandardCode, baseline: "Included" }));
    if (domain === "lifecycle") return result.derived.lifecycleRequirements.map((item) => ({ key: `${item.disciplineId}|${item.documentTypeId}|${item.lifecyclePhase}`, label: `${item.lifecyclePhaseName} · ${item.documentTypeName} · ${item.disciplineName}`, baseline: item.requiredStatus }));
    return [];
  }, [domain, result]);

  const selected = targets.find((item) => item.key === targetKey);
  const effectiveAction = domain === "custom" ? "add" : action;

  function resetForDomain(next: OverrideDomain) {
    setDomain(next);
    setTargetKey("");
    setContractValue("");
    setReason("");
    if (next === "custom") setAction("add");
  }

  function addOverride() {
    const label = domain === "custom" ? contractValue.trim() : selected?.label ?? "";
    if (!label || !reason.trim()) return;
    if (effectiveAction === "change" && !contractValue.trim()) return;
    const item: ContractOverride = {
      id: `override-${Date.now()}`,
      domain,
      action: effectiveAction,
      targetKey: domain === "custom" ? `custom-${Date.now()}` : targetKey,
      targetLabel: label,
      baselineValue: selected?.baseline,
      contractValue: effectiveAction === "change" || effectiveAction === "add" ? contractValue.trim() : undefined,
      reason: reason.trim(),
    };
    onChange([...overrides.filter((existing) => !(existing.domain === item.domain && existing.targetKey === item.targetKey)), item]);
    setTargetKey("");
    setContractValue("");
    setReason("");
  }

  const counts = overrides.reduce<Record<string, number>>((acc, item) => {
    acc[item.action] = (acc[item.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="cis-builder-overrides">
      <div className="cis-builder-review-toolbar">
        <button className="cis-builder-back" onClick={onBack}>← Baseline review</button>
        <div><div className="cis-builder-eyebrow">Contract deviations</div><h2>Overrides</h2><p>{result.identity.name}</p></div>
        <span className="cis-builder-baseline-lock"><ShieldCheck size={14}/> Baseline protected</span>
      </div>

      <div className="cis-builder-override-summary">
        <Metric value={overrides.length} label="Total overrides" />
        <Metric value={counts.exclude ?? 0} label="Excluded" />
        <Metric value={counts.change ?? 0} label="Changed" />
        <Metric value={counts.add ?? 0} label="Owner additions" />
      </div>

      <div className="cis-builder-review-note">
        <ShieldCheck size={16}/><div><strong>Overrides never mutate the CFIHOS baseline.</strong><span>Every deviation records the baseline, the contractual decision and a mandatory rationale.</span></div>
      </div>

      <div className="cis-builder-override-grid">
        <section className="cis-builder-card cis-builder-override-form">
          <h2>Record a deviation</h2>
          <label>Requirement area<select value={domain} onChange={(e) => resetForDomain(e.target.value as OverrideDomain)}><option value="asset-data">Asset data</option><option value="documents">Documents</option><option value="standards">Standards</option><option value="lifecycle">Lifecycle</option><option value="custom">Owner addition</option></select></label>
          {domain !== "custom" && <label>Decision<select value={action} onChange={(e) => setAction(e.target.value as "exclude" | "change" | "add")}><option value="exclude">Exclude</option><option value="change">Change</option></select></label>}
          {domain !== "custom" && <label>Baseline requirement<select value={targetKey} onChange={(e) => { setTargetKey(e.target.value); setContractValue(""); }}><option value="">Select a requirement…</option>{targets.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>}
          {selected && <div className="cis-builder-baseline-value"><span>CFIHOS baseline</span><strong>{selected.baseline}</strong></div>}
          {(effectiveAction === "change" || domain === "custom") && <label>{domain === "custom" ? "Owner requirement" : "Contract value"}<input value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder={domain === "custom" ? "Describe the additional contractual requirement" : "Enter the contractual value or status"}/></label>}
          <label>Reason / rationale<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this contract deviates from the CFIHOS baseline." rows={4}/></label>
          <button className="cis-builder-primary" disabled={!reason.trim() || (domain !== "custom" && !targetKey) || ((effectiveAction === "change" || domain === "custom") && !contractValue.trim())} onClick={addOverride}>+ Add override</button>
        </section>

        <section className="cis-builder-card cis-builder-override-list">
          <div className="cis-builder-card-heading"><div><h2>Contract deviations</h2><p>Only differences from the locked baseline are shown here.</p></div><span>{overrides.length}</span></div>
          {!overrides.length ? <div className="cis-builder-empty">No overrides recorded. The contract currently follows the CFIHOS baseline.</div> : <div className="cis-builder-deviations">{overrides.map((item) => <div key={item.id} className="cis-builder-deviation"><div className="cis-builder-deviation-top"><span className={`cis-builder-deviation-action ${item.action}`}>{item.action}</span><strong>{item.targetLabel}</strong><button aria-label="Restore baseline" onClick={() => onChange(overrides.filter((entry) => entry.id !== item.id))}><Trash2 size={14}/></button></div><div className="cis-builder-deviation-values"><span><small>CFIHOS</small><b>{item.baselineValue ?? "Not in baseline"}</b></span><span><small>Contract</small><b>{item.action === "exclude" ? "Excluded" : item.contractValue}</b></span></div><p>{item.reason}</p></div>)}</div>}
        </section>
      </div>

      <div className="cis-builder-stage-action"><div><strong>Ready to produce the contract CIS?</strong><span>Export uses the locked baseline plus these explicit deviations. Excluded items remain in the audit trail.</span></div><button onClick={onProceed}>Continue to export →</button></div>
    </section>
  );
}

function ExportWorkspace({
  result,
  overrides,
  onBack,
}: {
  result: ProjectInformationProfile;
  overrides: ContractOverride[];
  onBack: () => void;
}) {
  const rows = useMemo(() => buildFinalContractRows(result, overrides), [result, overrides]);
  const included = rows.filter((row) => row.contractDecision !== "Excluded");
  const excluded = rows.length - included.length;
  const changed = rows.filter((row) => row.decision === "Changed").length;
  const added = rows.filter((row) => row.decision === "Added").length;

  function downloadJson() {
    const payload = {
      schema: "cfihos-cis-export-v1",
      generatedAt: new Date().toISOString(),
      identity: result.identity,
      scope: result.scope,
      baseline: result.derived,
      overrides,
      finalContract: {
        counts: { totalAuditRows: rows.length, effectiveRequirements: included.length, excluded, changed, added },
        requirements: rows,
      },
    };
    downloadTextFile(`${safeFileName(result.identity.name)}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function downloadCsv() {
    const headers = [
      "Area",
      "Item",
      "CFIHOS ID",
      "Baseline Value",
      "Contract Value",
      "Decision",
      "Reason / Rationale",
      "Provenance",
      "Row Key",
      "Requirement Domain",
      "Target Key",
      "CIS Snapshot Chunk",
      "Snapshot Part",
      "Snapshot Parts",
    ];

    const snapshot: WorkingCisDocument = {
      schema: "cfihos-cis-document-v1",
      savedAt: new Date().toISOString(),
      workspace: {
        projectName: result.identity.projectName,
        contractName: result.identity.contractName ?? "",
        profileName: result.identity.name,
        domain: result.scope.classes?.[0]?.domain ?? "tag",
        selectedClasses: result.scope.classes ?? [],
        selectedDisciplines: result.scope.disciplines ?? [],
        result,
        warnings: [],
        stage: "export",
        reviewTab: "asset-data",
        overrides,
      },
    };
    const snapshotChunks = chunkText(JSON.stringify(snapshot), 16000);
    const recordCount = Math.max(rows.length, snapshotChunks.length);
    const records = Array.from({ length: recordCount }, (_, index) => {
      const row = rows[index];
      return [
        row?.area ?? "",
        row?.item ?? "",
        row?.cfihosId ?? "",
        row?.baselineValue ?? "",
        row?.contractValue ?? "",
        row?.decision ?? "",
        row?.reason ?? "",
        row?.provenance ?? "",
        row?.key ?? "",
        row?.domain ?? "",
        row?.targetKey ?? "",
        snapshotChunks[index] ?? "",
        snapshotChunks[index] ? String(index + 1) : "",
        snapshotChunks[index] ? String(snapshotChunks.length) : "",
      ];
    });

    const csvBody = [headers, ...records]
      .map((line) => line.map(csvCell).join(","))
      .join("\r\n");

    // UTF-8 BOM + Excel separator directive make the export open reliably
    // in Excel installations whose regional list separator is not a comma.
    // Technical columns at the right make Builder-generated CSV files round-trip editable.
    const excelCsv = `\uFEFFsep=,\r\n${csvBody}`;
    downloadTextFile(
      `${safeFileName(result.identity.name)}.csv`,
      excelCsv,
      "text/csv;charset=utf-8",
    );
  }

  return (
    <section className="cis-builder-export">
      <div className="cis-builder-review-toolbar">
        <button className="cis-builder-back" onClick={onBack}>← Overrides</button>
        <div><div className="cis-builder-eyebrow">Final contract</div><h2>Export</h2><p>{result.identity.name}</p></div>
        <span className="cis-builder-baseline-lock"><ShieldCheck size={14}/> Traceable CIS</span>
      </div>

      <div className="cis-builder-export-equation">
        <div><strong>{rows.length - added}</strong><span>Baseline requirements</span></div>
        <b>+</b>
        <div><strong>{overrides.length}</strong><span>Explicit overrides</span></div>
        <b>=</b>
        <div className="emphasized"><strong>{included.length}</strong><span>Effective contract rows</span></div>
      </div>

      <div className="cis-builder-override-summary">
        <Metric value={included.length} label="Effective" />
        <Metric value={excluded} label="Excluded" />
        <Metric value={changed} label="Changed" />
        <Metric value={added} label="Owner additions" />
      </div>

      <div className="cis-builder-review-note">
        <ShieldCheck size={16}/><div><strong>Final contract = CFIHOS baseline + explicit Owner/Operator decisions.</strong><span>Excluded requirements remain visible in the audit export but are not effective EPC requirements.</span></div>
      </div>

      <section className="cis-builder-card cis-builder-final-preview">
        <div className="cis-builder-card-heading"><div><h2>Final Contract Preview</h2><p>Audit-ready view of the effective requirement set and every deviation from CFIHOS.</p></div><span>{rows.length} rows</span></div>
        <div className="cis-builder-review-table-wrap">
          <table className="cis-builder-review-table">
            <thead><tr><th>Area</th><th>Requirement</th><th>CFIHOS baseline</th><th>Contract</th><th>Decision</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.key} className={row.contractDecision === "Excluded" ? "cis-builder-row-excluded" : ""}><td>{row.area}</td><td><ReviewIdentity title={row.item} code={row.cfihosId || "Owner requirement"}/></td><td>{row.baselineValue}</td><td>{row.contractValue}</td><td><span className={`cis-builder-final-decision ${row.decision.toLowerCase()}`}>{row.contractDecision}</span>{row.reason && <small className="cis-builder-final-reason">{row.reason}</small>}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="cis-builder-review-note" role="note" aria-label="Export format guidance">
        <ShieldCheck size={16} />
        <div>
          <strong>Keep JSON as the editable master until the CIS is finalized.</strong>
          <span>Save CIS / JSON preserves the complete authoring and audit model. Export CSV at issue or exchange stage when the EPC needs a spreadsheet schedule. Builder-generated CSV remains importable, but JSON is the recommended format for continued governance and editing.</span>
        </div>
      </div>

      <div className="cis-builder-export-actions">
        <div><strong>Editable master</strong><span>JSON preserves the complete baseline, scope, provenance and override model. Recommended for continued authoring and governance.</span></div>
        <button className="cis-builder-primary" onClick={downloadJson}><Download size={15}/> Export JSON</button>
      </div>

      <div className="cis-builder-export-actions">
        <div><strong>Issue / exchange</strong><span>CSV is the EPC-friendly spreadsheet requirement schedule. Use it primarily when the CIS is finalized or spreadsheet exchange is required.</span></div>
        <button onClick={downloadCsv}><Download size={15}/> Export CSV</button>
      </div>
    </section>
  );
}

type FinalContractRow = {
  key: string;
  domain: OverrideDomain;
  targetKey: string;
  area: string;
  item: string;
  cfihosId: string;
  baselineValue: string;
  contractValue: string;
  decision: "Baseline" | "Changed" | "Added" | "Excluded";
  contractDecision: string;
  reason: string;
  provenance: string;
};

function buildFinalContractRows(result: ProjectInformationProfile, overrides: ContractOverride[]): FinalContractRow[] {
  const overrideMap = new Map(overrides.filter((item) => item.domain !== "custom").map((item) => [`${item.domain}|${item.targetKey}`, item]));
  const rows: FinalContractRow[] = [];

  const addBaseline = (domain: OverrideDomain, key: string, area: string, item: string, cfihosId: string, baselineValue: string, provenance: CisRequirementProvenance[]) => {
    const override = overrideMap.get(`${domain}|${key}`);
    const decision: FinalContractRow["decision"] = override?.action === "exclude" ? "Excluded" : override?.action === "change" ? "Changed" : "Baseline";
    rows.push({ key: `${domain}|${key}`, domain, targetKey: key, area, item, cfihosId, baselineValue, contractValue: override?.action === "exclude" ? "Excluded" : override?.contractValue ?? baselineValue, decision, contractDecision: decision === "Baseline" ? "Included" : decision, reason: override?.reason ?? "", provenance: provenanceText(provenance) });
  };

  result.derived.properties.forEach((item) => addBaseline("asset-data", item.propertyId, "Asset data", item.propertyName, item.propertyId, "Included", item.provenance));
  result.derived.documentTypes.forEach((item) => addBaseline("documents", item.documentTypeId, "Document", item.documentTypeName, item.documentTypeId, "Included", item.provenance));
  result.derived.sourceStandards.forEach((item) => addBaseline("standards", item.sourceStandardId, "Standard", item.sourceStandardCode, item.sourceStandardId, "Included", item.provenance));
  result.derived.lifecycleRequirements.forEach((item) => addBaseline("lifecycle", `${item.disciplineId}|${item.documentTypeId}|${item.lifecyclePhase}`, `Lifecycle · ${item.lifecyclePhaseName}`, `${item.documentTypeName} · ${item.disciplineName}`, item.documentTypeId, item.requiredStatus, item.provenance));

  overrides.filter((item) => item.domain === "custom").forEach((item) => rows.push({ key: item.id, domain: "custom", targetKey: item.targetKey, area: "Owner addition", item: item.targetLabel, cfihosId: "", baselineValue: "Not in baseline", contractValue: item.contractValue ?? item.targetLabel, decision: "Added", contractDecision: "Added", reason: item.reason, provenance: "Owner / Operator" }));
  return rows;
}

function provenanceText(provenance: CisRequirementProvenance[]) {
  return Array.from(new Set(provenance.map((item) => item.selectedClass ? `${item.assetContext ? `${formatContext(item.assetContext)} · ` : ""}${item.selectedClass.className}` : item.disciplineName ?? item.sourceStandardCode ?? "CFIHOS"))).join("; ");
}

function chunkText(value: string, chunkSize: number) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }
  return chunks.length ? chunks : [""];
}

function parseCsv(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  let text = raw.replace(/^\uFEFF/, "");
  if (text.startsWith("sep=")) {
    const newline = text.indexOf("\n");
    text = newline >= 0 ? text.slice(newline + 1) : "";
  }

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }
  if (!records.length) throw new Error("The selected CSV file is empty.");

  const headers = records[0].map((header) => header.trim());
  const rows = records.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
  return { headers, rows };
}

function csvCell(value: string) {
  const escaped = String(value ?? "").replaceAll('"', '""');
  return `"${escaped}"`;
}

function safeFileName(value: string) {
  return (value.trim() || "contract-information-specification").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function AssetDataReview({ result }: { result: ProjectInformationProfile }) {
  return (
    <ReviewTable
      title="Asset data requirements"
      description="Effective CFIHOS properties across the selected Tag and Equipment Classes."
      headers={["Property", "Type / dimension", "Required by", "Decision"]}
      rows={result.derived.properties.map((item) => [
        <ReviewIdentity key="property" title={item.propertyName} code={item.propertyId} />,
        <span key="type">{item.dataType ?? "—"}{item.unitOfMeasureDimensionCode ? ` · ${item.unitOfMeasureDimensionCode}` : ""}</span>,
        <ProvenanceSummary key="prov" provenance={item.provenance} />,
        <IncludedBadge key="decision" />,
      ])}
    />
  );
}

function DocumentReview({ result }: { result: ProjectInformationProfile }) {
  return (
    <ReviewTable
      title="Document deliverables"
      description="Unique Document Types, deduplicated from CFIHOS requirement rows while retaining every asset-context mapping."
      headers={["Document type", "Asset context", "Required by", "Decision"]}
      rows={result.derived.documentTypes.map((item) => [
        <ReviewIdentity key="document" title={item.documentTypeName} code={item.documentTypeId} meta={`${item.requirementIds.length} requirement mapping${item.requirementIds.length === 1 ? "" : "s"}`} />,
        <div key="contexts" className="cis-builder-context-badges">{item.assetContexts.map((context) => <span key={context}>{formatContext(context)}</span>)}</div>,
        <ProvenanceSummary key="prov" provenance={item.provenance} />,
        <IncludedBadge key="decision" />,
      ])}
    />
  );
}

function StandardsReview({ result }: { result: ProjectInformationProfile }) {
  return (
    <ReviewTable
      title="Applicable Source Standards"
      description="Resolved and deduplicated standards with traceability to the selected scope and derived requirements."
      headers={["Source Standard", "Description", "Provenance", "Decision"]}
      rows={result.derived.sourceStandards.map((item) => [
        <ReviewIdentity key="standard" title={item.sourceStandardCode} code={item.sourceStandardId} meta={item.explicitlySelected ? "Explicitly selected" : undefined} />,
        <span key="description">{item.description ?? "—"}</span>,
        <ProvenanceSummary key="prov" provenance={item.provenance} />,
        <IncludedBadge key="decision" />,
      ])}
    />
  );
}

function LifecycleReview({ result }: { result: ProjectInformationProfile }) {
  const phaseOrder = ["detailed-engineering", "construction", "commissioning", "startup", "operations"];
  const rows = [...result.derived.lifecycleRequirements].sort((a, b) => {
    const phase = phaseOrder.indexOf(a.lifecyclePhase) - phaseOrder.indexOf(b.lifecyclePhase);
    if (phase !== 0) return phase;
    const discipline = a.disciplineName.localeCompare(b.disciplineName);
    return discipline !== 0 ? discipline : a.documentTypeName.localeCompare(b.documentTypeName);
  });
  return (
    <ReviewTable
      title="Lifecycle obligations"
      description="Discipline × Document Type obligations shown in CFIHOS engineering lifecycle order."
      headers={["Phase", "Document type", "Discipline", "Required status", "Decision"]}
      rows={rows.map((item) => [
        <strong key="phase" className="cis-builder-phase">{item.lifecyclePhaseName}</strong>,
        <ReviewIdentity key="document" title={item.documentTypeName} code={item.documentTypeId} />,
        <ReviewIdentity key="discipline" title={item.disciplineName} code={item.disciplineId} />,
        <span key="status" className="cis-builder-status-code">{item.requiredStatus}</span>,
        <IncludedBadge key="decision" />,
      ])}
    />
  );
}

function ReviewTable({
  title,
  description,
  headers,
  rows,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <>
      <div className="cis-builder-review-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <span>{rows.length.toLocaleString()} items</span>
      </div>
      {rows.length === 0 ? (
        <div className="cis-builder-review-empty">No CFIHOS requirements are present for this part of the selected scope.</div>
      ) : (
        <div className="cis-builder-review-table-wrap">
          <table className="cis-builder-review-table">
            <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {rows.map((cells, rowIndex) => (
                <tr key={rowIndex}>{cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ReviewIdentity({ title, code, meta }: { title: string; code: string; meta?: string }) {
  return <div className="cis-builder-review-identity"><strong>{title}</strong><small>{code}</small>{meta && <em>{meta}</em>}</div>;
}

function ProvenanceSummary({ provenance }: { provenance: CisRequirementProvenance[] }) {
  const entries = Array.from(
    new Map(
      provenance.map((item) => {
        const selected = item.selectedClass;
        const context = item.assetContext ? formatContext(item.assetContext) : null;
        const label = selected ? `${context ? `${context} · ` : ""}${selected.className}` : item.disciplineName ?? item.sourceStandardCode ?? "CFIHOS";
        return [label, label];
      }),
    ).values(),
  );
  const visible = entries.slice(0, 3);
  return <div className="cis-builder-provenance">{visible.map((entry) => <span key={entry}>{entry}</span>)}{entries.length > visible.length && <small>+{entries.length - visible.length} more</small>}</div>;
}

function IncludedBadge() {
  return <span className="cis-builder-included"><Check size={12}/> Included</span>;
}

function ReviewTabButton({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span><strong>{count}</strong></button>;
}

function BaselineHeading({ result }: { result: ProjectInformationProfile }) {
  return <div className="cis-builder-baseline-heading"><div><div className="cis-builder-eyebrow">Generated baseline</div><h2>{result.identity.name}</h2><p>{result.identity.projectName}{result.identity.contractName ? ` · ${result.identity.contractName}` : ""}</p></div><span>Draft</span></div>;
}

function BaselineMetrics({ result, contextCounts, compact = false }: { result: ProjectInformationProfile; contextCounts: Record<string, number>; compact?: boolean }) {
  return <div className={compact ? "cis-builder-baseline-summary compact" : "cis-builder-baseline-summary"}>
    <div className="cis-builder-metrics"><Metric value={result.derived.properties.length} label="Properties"/><Metric value={result.derived.documentRequirements.length} label="Requirement rows"/><Metric value={result.derived.documentTypes.length} label="Document types"/><Metric value={result.derived.sourceStandards.length} label="Standards"/><Metric value={result.derived.lifecycleRequirements.length} label="Lifecycle obligations"/></div>
    <div className="cis-builder-contexts">{[["Plant","Plant"],["Process_Unit","Process Unit"],["Tag","Tag"],["Equipment","Equipment"],["Model_Part","Model / Part"]].map(([key,label])=><div key={key}><strong>{contextCounts[key] ?? 0}</strong><span>{label}</span></div>)}</div>
  </div>;
}

function SelectionList({ items, empty, onRemove }: { items: Array<{ key: string; title: string; meta: string }>; empty: string; onRemove: (key: string) => void }) {
  if (!items.length) return <div className="cis-builder-empty">{empty}</div>;
  return <div className="cis-builder-selected">{items.map((item)=><div key={item.key}><span><strong>{item.title}</strong><small>{item.meta}</small></span><button aria-label={`Remove ${item.title}`} onClick={()=>onRemove(item.key)}><Trash2 size={14}/></button></div>)}</div>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div><strong>{value.toLocaleString()}</strong><span>{label}</span></div>;
}

function formatContext(value: string) {
  if (value === "Process_Unit") return "Process Unit";
  if (value === "Model_Part") return "Model / Part";
  return value.replaceAll("_", " ");
}
