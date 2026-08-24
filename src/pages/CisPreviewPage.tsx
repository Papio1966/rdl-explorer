import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FileText,
  GitBranch,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  RefreshCw,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CisDerivationService } from "../cfihos/cis/CisDerivationService";
import { cfihosCisDerivationDataSource } from "../cfihos/cis/CfihosCisDerivationDataSource";
import {
  CIS_ASSET_CONTEXT_HIERARCHY,
  createEmptyProjectInformationProfile,
  type CisAssetContextType,
  type CisClassDomain,
  type ProjectInformationProfile,
} from "../cfihos/cis/projectInformationProfile";
import type { CfihosDiscipline } from "../cfihos/model/document";
import type { CfihosEquipmentClass } from "../cfihos/model/equipmentClass";
import type { CfihosTagClass } from "../cfihos/model/tagClass";
import { cfihosDocumentRepository } from "../cfihos/repository/CfihosDocumentRepository";
import { cfihosEquipmentRepository } from "../cfihos/repository/CfihosEquipmentRepository";
import { cfihosRepository } from "../cfihos/repository/CfihosRepository";
import { CFIHOS_SOURCE } from "../cfihos/source";
import "./CisPreviewPage.css";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      tagClasses: CfihosTagClass[];
      equipmentClasses: CfihosEquipmentClass[];
      disciplines: CfihosDiscipline[];
    }
  | { status: "error"; message: string };

type DeriveState =
  | { status: "idle" }
  | { status: "deriving" }
  | { status: "success"; profile: ProjectInformationProfile; warnings: string[] }
  | { status: "error"; message: string };

type LifecycleSortKey =
  | "discipline"
  | "documentType"
  | "phase"
  | "requiredStatus";

type SortDirection = "asc" | "desc";

const LIFECYCLE_PHASE_ORDER = new Map([
  ["detailed_engineering", 0],
  ["construction", 1],
  ["commissioning", 2],
  ["startup", 3],
  ["operations", 4],
]);

const derivationService = new CisDerivationService(cfihosCisDerivationDataSource);

export function CisPreviewPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [domain, setDomain] = useState<CisClassDomain>("equipment");
  const [classId, setClassId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [deriveState, setDeriveState] = useState<DeriveState>({ status: "idle" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [tagClasses, equipmentClasses, disciplines] = await Promise.all([
          cfihosRepository.getTagClasses(),
          cfihosEquipmentRepository.getEquipmentClasses(),
          cfihosDocumentRepository.getDisciplines(),
        ]);

        if (!active) return;

        const equipmentDefault =
          equipmentClasses.find(
            (item) =>
              !item.abstract && item.name.toLowerCase().includes("centrifugal pump"),
          ) ?? equipmentClasses.find((item) => !item.abstract) ?? equipmentClasses[0];

        const mechanicalDefault =
          disciplines.find((item) =>
            [item.code, item.name].some((value) =>
              value.toLowerCase().includes("mechanical"),
            ),
          ) ?? disciplines[0];

        setClassId(equipmentDefault?.id ?? "");
        setDisciplineId(mechanicalDefault?.id ?? "");
        setLoadState({
          status: "ready",
          tagClasses,
          equipmentClasses,
          disciplines,
        });
      } catch (error) {
        if (!active) return;
        setLoadState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS data for the CIS preview.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const classes = useMemo(() => {
    if (loadState.status !== "ready") return [];
    return domain === "tag" ? loadState.tagClasses : loadState.equipmentClasses;
  }, [domain, loadState]);

  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const selectedDiscipline =
    loadState.status === "ready"
      ? loadState.disciplines.find((item) => item.id === disciplineId) ?? null
      : null;

  function changeDomain(nextDomain: CisClassDomain) {
    setDomain(nextDomain);
    setDeriveState({ status: "idle" });
    if (loadState.status !== "ready") return;

    const nextClasses =
      nextDomain === "tag" ? loadState.tagClasses : loadState.equipmentClasses;
    const nextDefault = nextClasses.find((item) => !item.abstract) ?? nextClasses[0];
    setClassId(nextDefault?.id ?? "");
  }

  async function derive() {
    if (!selectedClass) return;

    setDeriveState({ status: "deriving" });

    const now = new Date().toISOString();
    const profile = createEmptyProjectInformationProfile({
      id: "cis-preview",
      name: "CFIHOS CIS derivation preview",
      projectName: "Preview project",
      contractName: "Preview EPC contract",
      description: "Temporary deterministic preview of CFIHOS-derived contract information requirements.",
      cfihosVersion: CFIHOS_SOURCE.version,
      workbookUrl: CFIHOS_SOURCE.officialUrl,
      now,
    });

    profile.scope.classes = [
      {
        domain,
        classId: selectedClass.id,
        className: selectedClass.name,
      },
    ];

    profile.scope.disciplines = selectedDiscipline
      ? [
          {
            disciplineId: selectedDiscipline.id,
            disciplineName: selectedDiscipline.name,
          },
        ]
      : [];

    try {
      const result = await derivationService.derive(profile);
      setDeriveState({
        status: "success",
        profile: result.profile,
        warnings: result.warnings.map((warning) => warning.message),
      });
    } catch (error) {
      setDeriveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to derive the CIS preview.",
      });
    }
  }

  if (loadState.status === "loading") {
    return (
      <div className="cis-preview-status">
        <LoaderCircle className="spin" size={26} />
        <div>
          <strong>Loading CFIHOS contract model</strong>
          <span>Preparing classes, disciplines and derivation repositories…</span>
        </div>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="cis-preview-page">
        <div className="cis-preview-alert cis-preview-alert-error">
          <AlertTriangle size={20} />
          <div>
            <strong>Unable to load the CIS preview</strong>
            <span>{loadState.message}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cis-preview-page">
      <header className="cis-preview-hero">
        <div className="cis-preview-eyebrow">Contract Information Specification · engineering preview</div>
        <h1>CFIHOS CIS derivation preview</h1>
        <p>
          Select one real CFIHOS class and an optional discipline. The preview derives the
          information requirements that could form part of an EPC Contract Information
          Specification. Nothing is saved or issued from this page.
        </p>
      </header>

      <section className="cis-preview-controls">
        <div className="cis-preview-control">
          <label htmlFor="cis-domain">Class domain</label>
          <select
            id="cis-domain"
            value={domain}
            onChange={(event) => changeDomain(event.target.value as CisClassDomain)}
          >
            <option value="equipment">Equipment Class</option>
            <option value="tag">Tag Class</option>
          </select>
        </div>

        <div className="cis-preview-control cis-preview-control-wide">
          <label htmlFor="cis-class">CFIHOS class</label>
          <select
            id="cis-class"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setDeriveState({ status: "idle" });
            }}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.id}{item.abstract ? " · abstract" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="cis-preview-control cis-preview-control-wide">
          <label htmlFor="cis-discipline">Discipline for lifecycle requirements</label>
          <select
            id="cis-discipline"
            value={disciplineId}
            onChange={(event) => {
              setDisciplineId(event.target.value);
              setDeriveState({ status: "idle" });
            }}
          >
            <option value="">No discipline selected</option>
            {loadState.disciplines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="cis-preview-derive"
          type="button"
          onClick={derive}
          disabled={!selectedClass || deriveState.status === "deriving"}
        >
          {deriveState.status === "deriving" ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <RefreshCw size={17} />
          )}
          Derive profile
        </button>
      </section>

      {selectedClass && (
        <div className="cis-preview-selection-note">
          {domain === "equipment" ? <Boxes size={17} /> : <Tags size={17} />}
          <span>
            Selected <strong>{selectedClass.name}</strong> ({selectedClass.id})
            {selectedDiscipline ? (
              <> with lifecycle context <strong>{selectedDiscipline.name}</strong>.</>
            ) : (
              <> without lifecycle discipline context.</>
            )}
          </span>
        </div>
      )}

      {deriveState.status === "idle" && (
        <section className="cis-preview-empty">
          <GitBranch size={28} />
          <h2>Ready to derive</h2>
          <p>Choose the scope above and click <strong>Derive profile</strong>.</p>
        </section>
      )}

      {deriveState.status === "error" && (
        <div className="cis-preview-alert cis-preview-alert-error">
          <AlertTriangle size={20} />
          <div>
            <strong>Derivation failed</strong>
            <span>{deriveState.message}</span>
          </div>
        </div>
      )}

      {deriveState.status === "success" && (
        <DerivedProfile profile={deriveState.profile} warnings={deriveState.warnings} />
      )}
    </div>
  );
}

function DerivedProfile({
  profile,
  warnings,
}: {
  profile: ProjectInformationProfile;
  warnings: string[];
}) {
  const { derived } = profile;
  const directProperties = derived.properties.filter((item) =>
    item.provenance.some((provenance) => provenance.assignmentType === "direct"),
  ).length;
  const inheritedProperties = derived.properties.filter((item) =>
    item.provenance.some((provenance) => provenance.assignmentType === "inherited"),
  ).length;

  const [lifecycleSortKey, setLifecycleSortKey] =
    useState<LifecycleSortKey>("documentType");
  const [lifecycleSortDirection, setLifecycleSortDirection] =
    useState<SortDirection>("asc");

  const sortedLifecycleRequirements = useMemo(() => {
    const direction = lifecycleSortDirection === "asc" ? 1 : -1;

    return [...derived.lifecycleRequirements].sort((a, b) => {
      let comparison = 0;

      switch (lifecycleSortKey) {
        case "discipline":
          comparison = compareText(a.disciplineName, b.disciplineName);
          break;
        case "documentType":
          comparison = compareText(a.documentTypeName, b.documentTypeName);
          break;
        case "phase":
          comparison =
            lifecyclePhaseRank(a.lifecyclePhase) -
            lifecyclePhaseRank(b.lifecyclePhase);
          break;
        case "requiredStatus":
          comparison = compareText(a.requiredStatus, b.requiredStatus);
          break;
      }

      if (comparison !== 0) return comparison * direction;

      // Stable engineering-friendly tie breakers. When sorting by phase,
      // documents are alphabetical within each lifecycle phase.
      const documentComparison = compareText(
        a.documentTypeName,
        b.documentTypeName,
      );
      if (documentComparison !== 0) return documentComparison;

      const phaseComparison =
        lifecyclePhaseRank(a.lifecyclePhase) -
        lifecyclePhaseRank(b.lifecyclePhase);
      if (phaseComparison !== 0) return phaseComparison;

      return compareText(a.requiredStatus, b.requiredStatus);
    });
  }, [derived.lifecycleRequirements, lifecycleSortDirection, lifecycleSortKey]);

  function changeLifecycleSort(nextKey: LifecycleSortKey) {
    if (nextKey === lifecycleSortKey) {
      setLifecycleSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }

    setLifecycleSortKey(nextKey);
    setLifecycleSortDirection("asc");
  }

  return (
    <div className="cis-preview-results">
      <section className="cis-preview-metrics">
        <Metric value={derived.properties.length} label="Effective properties" note={`${directProperties} direct · ${inheritedProperties} inherited`} />
        <Metric value={derived.documentRequirements.length} label="Document requirement rows" note="All CFIHOS asset contexts" />
        <Metric value={derived.documentTypes.length} label="Unique document types" note="Deduplicated requirement rows" />
        <Metric value={derived.sourceStandards.length} label="Applicable standards" note="Resolved & deduplicated" />
        <Metric value={derived.lifecycleRequirements.length} label="Lifecycle obligations" note="Discipline × document × phase" />
      </section>

      {warnings.length > 0 && (
        <div className="cis-preview-alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Derivation warnings</strong>
            {warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        </div>
      )}

      <PreviewSection
        icon={<CheckCircle2 size={19} />}
        title="Effective properties"
        subtitle="Direct and inherited properties retained with their CFIHOS class provenance."
      >
        {derived.properties.length === 0 ? (
          <EmptyRow text="No effective properties were derived for this class." />
        ) : (
          <div className="cis-preview-table-wrap">
            <table className="cis-preview-table">
              <thead>
                <tr><th>Property</th><th>Assignment</th><th>Source class</th><th>Data type / dimension</th></tr>
              </thead>
              <tbody>
                {derived.properties.map((item) => {
                  const primary = item.provenance[0];
                  return (
                    <tr key={item.propertyId}>
                      <td><strong>{item.propertyName}</strong><small>{item.propertyId}</small></td>
                      <td>{primary?.assignmentType ?? "—"}{primary?.inheritanceDepth ? ` · depth ${primary.inheritanceDepth}` : ""}</td>
                      <td>{primary?.sourceClassName ?? "—"}</td>
                      <td>{[item.dataType, item.unitOfMeasureDimensionCode].filter(Boolean).join(" · ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PreviewSection>

      <PreviewSection
        icon={<FileText size={19} />}
        title="Required documents"
        subtitle="All CFIHOS document-requirement rows for the selected object ID, preserving Plant → Process Unit → Tag → Equipment → Model / Part context."
      >
        {derived.documentRequirements.length === 0 ? (
          <EmptyRow text="No class-document requirements were derived for this CFIHOS object." />
        ) : (
          <>
            <div className="cis-preview-context-chain">
              {CIS_ASSET_CONTEXT_HIERARCHY.map((context, index) => (
                <span key={context}>
                  {index > 0 && <em>→</em>}
                  {formatAssetContext(context)}
                  <b>{derived.documentRequirements.filter((item) => item.assetContext === context).length}</b>
                </span>
              ))}
            </div>

            <div className="cis-preview-table-wrap">
              <table className="cis-preview-table">
                <thead>
                  <tr><th>Asset context</th><th>Document Type</th><th>Requirement</th><th>Source Standard</th></tr>
                </thead>
                <tbody>
                  {derived.documentRequirements.map((item) => (
                    <tr key={item.requirementId}>
                      <td><span className="cis-preview-context-badge">{formatAssetContext(item.assetContext)}</span></td>
                      <td><strong>{item.documentTypeName}</strong><small>{item.documentTypeId}</small></td>
                      <td>{item.requirementId}</td>
                      <td>{item.sourceStandardCode ?? item.sourceStandardId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cis-preview-subheading">
              <strong>{derived.documentTypes.length} unique document type{derived.documentTypes.length === 1 ? "" : "s"}</strong>
              <span>deduplicated from {derived.documentRequirements.length} CFIHOS requirement row{derived.documentRequirements.length === 1 ? "" : "s"}</span>
            </div>

            <div className="cis-preview-card-grid">
              {derived.documentTypes.map((item) => (
                <article className="cis-preview-card" key={item.documentTypeId}>
                  <strong>{item.documentTypeName}</strong>
                  <small>{item.documentTypeId}</small>
                  <span>{item.requirementIds.length} source requirement{item.requirementIds.length === 1 ? "" : "s"} · {item.assetContexts.map(formatAssetContext).join(", ")}</span>
                  <p>{item.provenance[0]?.reason}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </PreviewSection>

      <PreviewSection
        icon={<GitBranch size={19} />}
        title="Applicable Source Standards"
        subtitle="Deduplicated standards with traceability from class, property, picklist or document requirements."
      >
        {derived.sourceStandards.length === 0 ? (
          <EmptyRow text="No Source Standards were derived for this selection." />
        ) : (
          <div className="cis-preview-card-grid">
            {derived.sourceStandards.map((item) => (
              <article className="cis-preview-card" key={item.sourceStandardId}>
                <strong>{item.sourceStandardCode}</strong>
                <small>{item.sourceStandardId}</small>
                <span>{item.provenance.length} provenance path{item.provenance.length === 1 ? "" : "s"}</span>
                <p>{item.description ?? item.provenance[0]?.reason}</p>
              </article>
            ))}
          </div>
        )}
      </PreviewSection>

      <PreviewSection
        icon={<Boxes size={19} />}
        title="Lifecycle requirements"
        subtitle="Lifecycle statuses are matched against the unique Document Types derived across all CFIHOS asset contexts."
      >
        {derived.lifecycleRequirements.length === 0 ? (
          <EmptyRow text="No matching lifecycle obligations were derived. Try another discipline or class." />
        ) : (
          <>
            <div className="cis-preview-sort-note">
              Click a column heading to sort. Phase sorting follows the CFIHOS
              lifecycle sequence: Detailed Engineering → Construction →
              Commissioning → Startup → Operations.
            </div>
            <div className="cis-preview-table-wrap">
              <table className="cis-preview-table">
                <thead>
                  <tr>
                    <SortableHeader
                      label="Discipline"
                      sortKey="discipline"
                      activeKey={lifecycleSortKey}
                      direction={lifecycleSortDirection}
                      onSort={changeLifecycleSort}
                    />
                    <SortableHeader
                      label="Document Type"
                      sortKey="documentType"
                      activeKey={lifecycleSortKey}
                      direction={lifecycleSortDirection}
                      onSort={changeLifecycleSort}
                    />
                    <SortableHeader
                      label="Phase"
                      sortKey="phase"
                      activeKey={lifecycleSortKey}
                      direction={lifecycleSortDirection}
                      onSort={changeLifecycleSort}
                    />
                    <SortableHeader
                      label="Required status"
                      sortKey="requiredStatus"
                      activeKey={lifecycleSortKey}
                      direction={lifecycleSortDirection}
                      onSort={changeLifecycleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedLifecycleRequirements.map((item) => (
                    <tr key={item.id}>
                      <td>{item.disciplineName}</td>
                      <td><strong>{item.documentTypeName}</strong></td>
                      <td>{item.lifecyclePhaseName}</td>
                      <td>{item.requiredStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PreviewSection>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: LifecycleSortKey;
  activeKey: LifecycleSortKey;
  direction: SortDirection;
  onSort: (key: LifecycleSortKey) => void;
}) {
  const active = sortKey === activeKey;
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th scope="col" aria-sort={
      active
        ? direction === "asc"
          ? "ascending"
          : "descending"
        : "none"
    }>
      <button
        type="button"
        className={`cis-preview-sort-button${active ? " is-active" : ""}`}
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

function lifecyclePhaseRank(value: string): number {
  return LIFECYCLE_PHASE_ORDER.get(value) ?? Number.MAX_SAFE_INTEGER;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function formatAssetContext(value: CisAssetContextType): string {
  if (value === "Process_Unit") return "Process Unit";
  if (value === "Model_Part") return "Model / Part";
  return value;
}

function Metric({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <article className="cis-preview-metric">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function PreviewSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cis-preview-section">
      <div className="cis-preview-section-heading">
        <div className="cis-preview-section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="cis-preview-empty-row">{text}</div>;
}
